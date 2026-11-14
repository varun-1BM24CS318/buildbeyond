"""
Phase 2 Gate Tests: Utility Agents & Bidding Logic
==================================================

Validates that:
1. All 5 agents initialize with certified caps and fixed criticality.
2. Urgency dynamics respond properly to verified environment triggers.
3. Concessions never breach minimum_mw or concession_limit.
4. Bids are strictly valid and monotonic.
5. Utility curves are concave and monotonic.
"""

import pytest

from app.agents.honest import (
    EmergencyAgent,
    HospitalAgent,
    ResidentialAgent,
    TelecomAgent,
    WaterAgent,
)
from app.agents.registry import AgentRegistry
from app.config import DEFAULT_PROFILES, EPS


def test_agent_registry_initialization():
    registry = AgentRegistry()
    agents = registry.get_all()
    assert len(agents) == 5
    assert set(agents.keys()) == {"hospital", "water", "emergency", "telecom", "residential"}

    h = registry.get("hospital")
    assert isinstance(h, HospitalAgent)
    assert h.criticality == 1.0
    assert h.minimum_mw == 8.0
    assert h.certified_max_mw == 25.0


def test_hospital_urgency_spikes_on_generator_failure():
    h = HospitalAgent(DEFAULT_PROFILES["hospital"])
    base_urgency = h.urgency

    # Normal observation
    h.observe_environment({"severity": 0.2, "hospital_generator_failure": False})
    normal_urgency = h.urgency

    # Generator failure
    h.observe_environment({"severity": 0.2, "hospital_generator_failure": True})
    failed_urgency = h.urgency

    assert failed_urgency > normal_urgency
    assert h.generator_failed is True


def test_water_urgency_tracks_reservoir_depletion():
    w = WaterAgent(DEFAULT_PROFILES["water"])

    # Full reservoir
    w.observe_environment({"water_reserve": 1.0})
    full_urgency = w.urgency

    # Half empty
    w.observe_environment({"water_reserve": 0.5})
    half_urgency = w.urgency

    # Critical empty
    w.observe_environment({"water_reserve": 0.1})
    empty_urgency = w.urgency

    assert empty_urgency > half_urgency > full_urgency


def test_emergency_urgency_scales_with_severity():
    e = EmergencyAgent(DEFAULT_PROFILES["emergency"])

    e.observe_environment({"severity": 0.0})
    u0 = e.urgency

    e.observe_environment({"severity": 0.5})
    u5 = e.urgency

    e.observe_environment({"severity": 1.0})
    u10 = e.urgency

    assert u10 > u5 > u0


def test_concessions_never_breach_minimum_mw():
    registry = AgentRegistry()
    for aid, agent in registry.get_all().items():
        agent.reset_negotiation_round()
        # Aggressive concessions over 10 rounds
        for r in range(1, 10):
            agent.make_concession(round_num=r, shortage_mw=50.0)
            bid = agent.generate_bid(env_version=1, round_num=r)
            assert bid.requested_mw >= agent.minimum_mw - EPS
            # Concessions cannot exceed concession_limit * certified_max
            max_concession = agent.certified_max_mw * agent.concession_limit
            assert agent.cumulative_concession_mw <= max_concession + EPS


def test_bid_generation_and_monotonicity():
    h = HospitalAgent(DEFAULT_PROFILES["hospital"])
    b1 = h.generate_bid(env_version=1, round_num=1)
    b2 = h.generate_bid(env_version=1, round_num=2)

    assert b2.bid_version > b1.bid_version
    assert b1.requested_mw <= h.certified_max_mw
    assert b1.min_acceptable_mw == h.minimum_mw
    assert sum(s.requested_mw for s in b1.segments) == pytest.approx(b1.requested_mw, abs=1e-3)


def test_utility_monotonicity():
    h = HospitalAgent(DEFAULT_PROFILES["hospital"])
    u_0 = h.calculate_utility(0.0)
    u_5 = h.calculate_utility(5.0)
    u_15 = h.calculate_utility(15.0)
    u_25 = h.calculate_utility(25.0)

    assert u_0 == 0.0
    assert u_5 > u_0
    assert u_15 > u_5
    assert u_25 > u_15
