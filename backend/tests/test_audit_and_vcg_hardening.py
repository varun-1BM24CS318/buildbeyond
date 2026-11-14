"""
Unit Tests for Features 3 & 4: Reputation, Ledger Hardening & Advanced VCG
==========================================================================
"""

import pytest
from app.api.routes import (
    export_audit_ledger,
    get_reputation_history,
    sim_ctrl,
    simulate_audit_tamper,
)
from app.mechanism.vcg import VCGMechanism
from app.negotiation.ledger import Ledger
from app.simulation.runner import SimulationRunner


def test_ledger_audit_verify_report():
    ledger = Ledger(":memory:")
    # Empty ledger check
    rep_empty = ledger.get_audit_verification_report()
    assert rep_empty["valid"] is True
    assert rep_empty["length"] == 0

    # Append valid transactions
    t1 = ledger.append("BID", 1, 1, "hospital", {"mw": 25.0})
    t2 = ledger.append("COMMITTED", 1, 1, "hospital", {"allocated": 25.0})
    ledger.checkpoint(step=1, env_version=1)

    rep_valid = ledger.get_audit_verification_report()
    assert rep_valid["valid"] is True
    assert rep_valid["length"] == 3
    assert rep_valid["first_invalid_index"] is None
    assert rep_valid["head_hash"] != "GENESIS"


def test_simulate_tamper_preserves_live_ledger():
    # Setup live ledger transactions directly
    sim_ctrl.reset(scenario="normal")
    sim_ctrl.ledger.append("BID_VERIFIED", 1, 1, "hospital", {"requested_mw": 18.0})
    sim_ctrl.ledger.append("COMMITTED", 1, 1, "hospital", {"allocated": 18.0})
    sim_ctrl.ledger.checkpoint(step=1, env_version=1)

    # Record real ledger head hash
    real_hash_before = sim_ctrl.ledger.get_audit_verification_report()["head_hash"]

    # Call tamper simulation endpoint function
    data = simulate_audit_tamper()
    assert data["status"] == "simulation_complete"
    assert data["tamper_detected"] is True
    assert data["clone_verification"]["valid"] is False
    assert data["real_ledger_intact"] is True

    # Real ledger must remain completely unchanged
    real_hash_after = sim_ctrl.ledger.get_audit_verification_report()["head_hash"]
    assert real_hash_before == real_hash_after
    assert sim_ctrl.ledger.verify_hash_chain() is True


def test_audit_export_and_reputation_history():
    sim_ctrl.ledger.append("COMMITTED", 1, 1, "water", {"allocated": 10.0})
    sim_ctrl.reputation_auditor.audit_step(1, {"hospital": 18.0}, {"hospital": 18.0})

    # Test audit export endpoint function
    export_data = export_audit_ledger()
    assert "transactions" in export_data
    assert export_data["total_count"] > 0

    # Test reputation history endpoint function
    rep_data = get_reputation_history(agent_id="hospital")
    assert "history" in rep_data


def test_advanced_vcg_budget_and_rationality():
    bids = {aid: a.generate_bid(1) for aid, a in sim_ctrl.registry.get_all().items()}
    mins = {aid: a.minimum_mw for aid, a in sim_ctrl.registry.get_all().items()}

    # Solve allocations
    res = sim_ctrl.pipeline.solve(
        bids=bids,
        supply_mw=60.0,
        env_version=1,
        minimums=mins,
        criticalities={aid: b.criticality for aid, b in bids.items()},
        topology=sim_ctrl.network,
    )

    payments = VCGMechanism.calculate_payments(
        allocations=res.allocations,
        bids=bids,
        supply_mw=60.0,
        minimums=mins,
        topology=sim_ctrl.network,
    )

    analysis = VCGMechanism.analyze_budget_and_rationality(
        allocations=res.allocations,
        bids=bids,
        payments=payments,
    )

    assert "total_credit_revenue" in analysis
    assert analysis["budget_balanced"] is True
    assert analysis["all_individually_rational"] is True
    assert len(analysis["agents"]) == 5


def test_seed_42_determinism():
    """Verify determinism: identical seed + scenario produces identical results."""
    runner1 = SimulationRunner(seed=42)
    recs1, met1 = runner1.run_strategy("proposed", "cyclone", horizon_steps=4)

    runner2 = SimulationRunner(seed=42)
    recs2, met2 = runner2.run_strategy("proposed", "cyclone", horizon_steps=4)

    # Identical damage
    assert met1.cumulative_damage == met2.cumulative_damage
    # Identical allocations across all steps
    for r1, r2 in zip(recs1, recs2):
        assert r1["allocations"] == r2["allocations"]
