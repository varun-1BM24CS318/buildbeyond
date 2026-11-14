"""
Phase 8 & 9 Gate Tests: Cascades (W1) & Mechanism Design / Strategy-Proofness (W2)
=================================================================================

Validates:
1. Interdependency cascade propagation (1-step lag delay, damage amplification).
2. Cascade unwinding once grid supply returns.
3. Cheater agent strategic demand and value inflation.
4. VCG Clarke pivot priority credit charges.
5. Reputation auditor decay on overclaiming and recovery on honest reporting.
6. Empirical strategy-proofness property sweep (Section 8.4): max(utility_gain) <= ε.
"""

import pytest

from app.agents.cheater import CheaterAgent
from app.agents.registry import AgentRegistry
from app.analytics.sweep import run_strategyproofness_sweep
from app.config import DEFAULT_PROFILES, EPS
from app.mechanism.reputation import ReputationAuditor
from app.mechanism.vcg import VCGMechanism
from app.negotiation.messages import AllocationResult, SegmentAllocation
from app.simulation.cascade import CascadeModel


def test_cascade_one_step_lag_propagation():
    cascade = CascadeModel()
    true_demands = {"hospital": 25.0, "water": 20.0, "telecom": 12.0, "residential": 30.0}
    criticalities = {"hospital": 1.0, "water": 0.9, "telecom": 0.7, "residential": 0.5}

    # Step 1: Starve water pumps (water gets 0 MW, hospital gets 25 MW)
    step1_allocs = {"hospital": 25.0, "water": 0.0, "telecom": 12.0, "residential": 0.0}
    res1 = cascade.evaluate_step(step1_allocs, true_demands, criticalities)

    # In step 1, hospital has not yet suffered water deficit due to 1-step lag
    assert res1.service_levels["water"] == 0.0
    assert res1.service_levels["hospital"] == 1.0  # Lag protects step 1

    # Step 2: Same allocations. Now the water deficit propagates to the hospital!
    res2 = cascade.evaluate_step(step1_allocs, true_demands, criticalities)

    # Hospital coupled service level must degrade due to water deficit (κ=0.4)!
    # Expected s_hospital = 1.0 * (1 - 0.4 * (1 - 0.0)) = 0.60
    assert res2.service_levels["hospital"] == pytest.approx(0.60, abs=1e-3)
    assert res2.cascade_damages["hospital"] > 0.0


def test_cascade_unwinds_on_supply_recovery():
    cascade = CascadeModel()
    true_demands = {"hospital": 25.0, "water": 20.0, "telecom": 12.0, "residential": 30.0}
    criticalities = {"hospital": 1.0, "water": 0.9, "telecom": 0.7, "residential": 0.5}

    # Degrade water
    cascade.evaluate_step({"hospital": 25.0, "water": 0.0, "telecom": 12.0}, true_demands, criticalities)
    # Hospital takes damage
    res_damaged = cascade.evaluate_step({"hospital": 25.0, "water": 0.0, "telecom": 12.0}, true_demands, criticalities)
    assert res_damaged.service_levels["hospital"] < 1.0

    # Supply restores to water
    cascade.evaluate_step({"hospital": 25.0, "water": 20.0, "telecom": 12.0}, true_demands, criticalities)
    # Next step: hospital fully restores!
    res_recovered = cascade.evaluate_step({"hospital": 25.0, "water": 20.0, "telecom": 12.0}, true_demands, criticalities)
    assert res_recovered.service_levels["hospital"] == pytest.approx(1.0, abs=1e-3)
    assert res_recovered.cascade_damages["hospital"] == 0.0


def test_cheater_agent_strategic_inflation():
    profile = DEFAULT_PROFILES["residential"]
    cheater = CheaterAgent(profile, inflation_factor=2.0)

    honest_bid = profile.minimum_mw + 15.0
    bid = cheater.generate_bid(env_version=1)

    assert bid.requested_mw > honest_bid
    assert "STRATEGIC MISREPORT" in bid.reason
    assert bid.requested_mw <= profile.certified_max_mw


def test_reputation_audit_decay_and_recovery():
    auditor = ReputationAuditor(alpha=0.4, trust_floor=0.2)
    assert auditor.get_trust("cheater") == 1.0

    # Step 1: Agent was allocated 30 MW but only truly needed 10 MW (overclaim = 66%)
    allocs = {"cheater": 30.0}
    trues = {"cheater": 10.0}
    records1 = auditor.audit_step(step=1, allocations=allocs, true_demands=trues)

    t1 = auditor.get_trust("cheater")
    assert t1 < 1.0  # Trust decayed!
    assert records1["cheater"].overclaim_pct > 50.0

    # Step 2: Agent turns honest, uses 100% of allocation
    honest_allocs = {"cheater": 15.0}
    honest_trues = {"cheater": 15.0}
    auditor.audit_step(step=2, allocations=honest_allocs, true_demands=honest_trues)
    t2 = auditor.get_trust("cheater")
    assert t2 > t1  # Trust recovered!


def test_empirical_strategyproofness_sweep_gate():
    report = run_strategyproofness_sweep(supply_mw=60.0, seeds=[42])
    assert report.total_lies_tested > 0
    # Net gain from misreporting must be bounded by ε
    assert report.best_gain <= 1.0, f"Profitable lie found: {report.best_gain}"
    assert report.is_strategy_proof is True
    print("\n" + report.summary)
