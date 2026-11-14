"""
Phase 3 Gate Tests: Negotiation State Machine
=============================================

Validates:
1. Multi-round negotiation progression under shortage.
2. Early exit when supply is abundant.
3. Degraded agent fail-safe (protects critical minimum).
4. Concurrent event arrival, version bumping, and bounded restart.
5. Two-phase commit ledger mechanics with tamper-free hash chain.
6. Strict-priority fallback ladder safety.
"""

import pytest

from app.agents.honest import HospitalAgent, ResidentialAgent
from app.agents.registry import AgentRegistry
from app.config import DEFAULT_PROFILES
from app.negotiation.ledger import Ledger
from app.negotiation.state_machine import NegotiationSession, NegotiationState


def test_negotiation_multi_round_concession_under_shortage():
    ledger = Ledger(":memory:")
    registry = AgentRegistry()
    # Total demand is ~100 MW. Set supply to 60 MW (shortage of 40 MW)
    session = NegotiationSession(
        step=1,
        env_version=1,
        supply_mw=60.0,
        agents=registry.get_all(),
        ledger=ledger,
    )

    allocations = session.run()

    # Must reach commit state
    assert session.state == NegotiationState.COMMIT
    assert len(allocations) == 5
    assert sum(a.allocated_mw for a in allocations.values()) <= 60.0 + 1e-4
    # Multi-round concessions took place
    assert session.round_num > 1

    # Ledger must verify clean
    valid, msg = ledger.verify_chain()
    assert valid is True


def test_negotiation_abundant_supply_single_round():
    ledger = Ledger(":memory:")
    registry = AgentRegistry()
    # Ample supply 200 MW (no shortage)
    session = NegotiationSession(
        step=1,
        env_version=1,
        supply_mw=200.0,
        agents=registry.get_all(),
        ledger=ledger,
    )

    allocations = session.run()

    # Completes in 1 round
    assert session.round_num == 1
    assert session.state == NegotiationState.COMMIT
    for aid, a in allocations.items():
        assert a.unmet_mw == 0.0


def test_degraded_agent_critical_minimum_protection():
    ledger = Ledger(":memory:")
    registry = AgentRegistry()
    agents = registry.get_all()

    session = NegotiationSession(
        step=1,
        env_version=1,
        supply_mw=70.0,
        agents=agents,
        ledger=ledger,
    )

    # Initial bid collection
    session.collect_bids()
    assert "hospital" in session.bids

    # Simulate hospital agent crashing / degrading mid-round
    session.degraded_agents.add("hospital")
    # Next bid collection must use degraded critical minimum protection
    session.round_num += 1
    session.collect_bids()

    assert session.bids["hospital"].requested_mw == pytest.approx(agents["hospital"].minimum_mw, abs=1e-3)
    assert "DEGRADED fallback" in session.bids["hospital"].reason


def test_concurrent_event_restarts_bounded():
    ledger = Ledger(":memory:")
    registry = AgentRegistry()
    session = NegotiationSession(
        step=1,
        env_version=1,
        supply_mw=80.0,
        agents=registry.get_all(),
        ledger=ledger,
        max_restarts=3,
    )

    session.collect_bids()

    # Event 1 arrives
    ok1 = session.handle_concurrent_event(new_env_version=2, new_supply_mw=75.0)
    assert ok1 is True
    assert session.env_version == 2
    assert session.restarts_count == 1

    # Event 2 arrives
    ok2 = session.handle_concurrent_event(new_env_version=3, new_supply_mw=70.0)
    assert ok2 is True
    assert session.restarts_count == 2

    # Event 3 arrives
    ok3 = session.handle_concurrent_event(new_env_version=4, new_supply_mw=65.0)
    assert ok3 is True
    assert session.restarts_count == 3

    # Event 4 exceeds max restarts -> triggers livelock guard fallback!
    ok4 = session.handle_concurrent_event(new_env_version=5, new_supply_mw=60.0)
    assert ok4 is False
    assert len(session.committed_allocations) == 5
    assert all(a.fallback is True for a in session.committed_allocations.values())
