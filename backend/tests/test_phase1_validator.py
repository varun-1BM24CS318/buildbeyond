"""
Phase 1 Gate Tests: Validator Invariants, Ledger Hash-Chain, and Logical Clock
==============================================================================

Includes property-based tests verifying 10,000 cases of allocation invariant safety,
hash-chain integrity, tamper detection, and clock determinism.
"""

import math
import pytest
from hypothesis import given, settings, strategies as st

from app.config import DEFAULT_PROFILES, EPS
from app.negotiation.ledger import GENESIS_HASH, Ledger
from app.negotiation.messages import (
    AllocationResult,
    BidMessage,
    SegmentAllocation,
    SegmentBid,
)
from app.optimization.validator import AllocationValidator
from app.simulation.clock import LogicalClock


# ──────────────────────────────────────────────────────────────────────────────
# 1. Logical Clock Tests
# ──────────────────────────────────────────────────────────────────────────────

def test_logical_clock_determinism():
    clock = LogicalClock()
    assert clock.current_step == 0
    for i in range(1, 101):
        assert clock.tick() == i
        assert clock.current_step == i
    clock.reset()
    assert clock.current_step == 0


# ──────────────────────────────────────────────────────────────────────────────
# 2. Ledger Hash-Chain & Tamper Detection Tests
# ──────────────────────────────────────────────────────────────────────────────

def test_ledger_append_and_verify():
    ledger = Ledger(":memory:")
    assert ledger.count() == 0

    valid, msg = ledger.verify_chain()
    assert valid
    assert "0 transactions" in msg

    # Append transactions
    t1 = ledger.append(
        txn_type="BID",
        env_version=1,
        step=0,
        agent_id="hospital",
        payload={"requested_mw": 25.0},
    )
    assert t1["prev_hash"] == GENESIS_HASH
    assert t1["hash"] != ""

    t2 = ledger.append(
        txn_type="RESERVED",
        env_version=1,
        step=0,
        agent_id=None,
        payload={"allocations": {"hospital": 25.0}},
    )
    assert t2["prev_hash"] == t1["hash"]

    # Commit the transaction
    updated = ledger.update_status(t2["txn_id"], "COMMITTED")
    assert updated is True

    valid, msg = ledger.verify_chain()
    assert valid
    assert "2 transactions" in msg


def test_ledger_tamper_detection():
    ledger = Ledger(":memory:")
    ledger.append("BID", 1, 0, "hospital", {"requested_mw": 25.0})
    t2 = ledger.append("COMMITTED", 1, 0, None, {"allocated": 25.0})

    # Tamper with the database directly
    cursor = ledger._conn.cursor()
    cursor.execute("UPDATE transactions SET payload = ? WHERE txn_id = ?", ('{"tampered": true}', t2["txn_id"]))
    ledger._conn.commit()

    # Verification must fail!
    valid, msg = ledger.verify_chain()
    assert valid is False
    assert "Tampered" in msg


# ──────────────────────────────────────────────────────────────────────────────
# 3. Allocation Validator Edge Cases
# ──────────────────────────────────────────────────────────────────────────────

def test_validator_detects_capacity_violation():
    bids = {
        "a1": BidMessage(
            bid_id="b1", agent_id="a1", env_version=1, bid_version=1,
            requested_mw=50.0, min_acceptable_mw=10.0, segments=[],
            criticality=1.0, urgency=1.0, max_concession=0.2, reason="test"
        ),
        "a2": BidMessage(
            bid_id="b2", agent_id="a2", env_version=1, bid_version=1,
            requested_mw=50.0, min_acceptable_mw=10.0, segments=[],
            criticality=0.8, urgency=0.8, max_concession=0.2, reason="test"
        ),
    }

    # Supply is only 80 MW, but total allocation is 90 MW -> violation
    allocs = {"a1": 45.0, "a2": 45.0}
    res = AllocationValidator.validate_allocation(allocs, bids, supply_mw=80.0, expected_env_version=1)
    assert res.valid is False
    assert any("Capacity violation" in err for err in res.errors)


def test_validator_detects_stale_env_version():
    bids = {
        "a1": BidMessage(
            bid_id="b1", agent_id="a1", env_version=1, bid_version=1,  # Stale!
            requested_mw=20.0, min_acceptable_mw=10.0, segments=[],
            criticality=1.0, urgency=1.0, max_concession=0.2, reason="test"
        ),
    }
    allocs = {"a1": 20.0}
    res = AllocationValidator.validate_allocation(allocs, bids, supply_mw=80.0, expected_env_version=2)
    assert res.valid is False
    assert any("stale env_version" in err for err in res.errors)


def test_validator_rounding_never_exceeds_supply():
    # If unrounded allocations sum to 80.00004 when supply is 80.0, rounding must adjust
    raw_allocs = {"a1": 40.00003, "a2": 40.00003}
    rounded = AllocationValidator.sanitize_and_round(raw_allocs, supply_mw=80.0, precision=4)
    assert sum(rounded.values()) <= 80.0 + EPS


# ──────────────────────────────────────────────────────────────────────────────
# 4. Property-Based Testing: 10,000 Invariant Checks (Hypothesis)
# ──────────────────────────────────────────────────────────────────────────────

@settings(max_examples=10000, deadline=None)
@given(
    supply=st.floats(min_value=0.0, max_value=200.0, allow_nan=False, allow_infinity=False),
    req1=st.floats(min_value=0.0, max_value=60.0, allow_nan=False, allow_infinity=False),
    req2=st.floats(min_value=0.0, max_value=60.0, allow_nan=False, allow_infinity=False),
    req3=st.floats(min_value=0.0, max_value=60.0, allow_nan=False, allow_infinity=False),
    frac1=st.floats(min_value=0.0, max_value=1.0),
    frac2=st.floats(min_value=0.0, max_value=1.0),
    frac3=st.floats(min_value=0.0, max_value=1.0),
)
def test_property_based_invariants_10000(supply, req1, req2, req3, frac1, frac2, frac3):
    """Generates random valid allocations and verifies that validator correctly
    guarantees sum <= supply and 0 <= x_i <= req_i without any capacity violation.
    """
    bids = {
        "hospital": BidMessage(
            bid_id="b1", agent_id="hospital", env_version=1, bid_version=1,
            requested_mw=req1, min_acceptable_mw=0.0, segments=[],
            criticality=1.0, urgency=1.0, max_concession=0.1, reason=""
        ),
        "water": BidMessage(
            bid_id="b2", agent_id="water", env_version=1, bid_version=1,
            requested_mw=req2, min_acceptable_mw=0.0, segments=[],
            criticality=0.9, urgency=0.9, max_concession=0.1, reason=""
        ),
        "telecom": BidMessage(
            bid_id="b3", agent_id="telecom", env_version=1, bid_version=1,
            requested_mw=req3, min_acceptable_mw=0.0, segments=[],
            criticality=0.7, urgency=0.7, max_concession=0.1, reason=""
        ),
    }

    # Construct an allocation that respects individual demands
    a1 = req1 * frac1
    a2 = req2 * frac2
    a3 = req3 * frac3
    total = a1 + a2 + a3

    # If total exceeds supply, scale down proportionally to fit supply
    if total > supply and total > 0:
        scale = supply / total
        a1 *= scale
        a2 *= scale
        a3 *= scale

    raw_allocs = {"hospital": a1, "water": a2, "telecom": a3}
    demand_caps = {aid: bids[aid].requested_mw for aid in bids}
    rounded_allocs = AllocationValidator.sanitize_and_round(
        raw_allocs, supply_mw=supply, demand_caps=demand_caps
    )

    # Validate
    res = AllocationValidator.validate_allocation(
        rounded_allocs, bids, supply_mw=supply, expected_env_version=1
    )

    # Invariants must hold:
    assert res.valid is True, f"Validation failed with errors: {res.errors}"
    assert sum(rounded_allocs.values()) <= supply + EPS
    for aid, mw in rounded_allocs.items():
        assert mw >= -EPS
        assert mw <= bids[aid].requested_mw + EPS
