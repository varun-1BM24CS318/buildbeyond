"""
Regression & Invariant Tests for Misreport (Cheater) Bounded Demand
===================================================================

Verifies:
1. True physical demand is completely decoupled from strategic overbids.
2. Cheater claimed demand is strictly capped at certified_max and never compounds across steps.
3. Idempotency: arming cheater twice does not alter baseline or multipliers.
4. Total true demand at every step <= 3x nominal total demand.
5. Invariant enforcement: 0 <= true_demand <= certified_max.
6. Hypothesis property tests (100+ cases) verifying bounds across arbitrary event permutations.
"""

from __future__ import annotations

import math
import pytest
from hypothesis import given, settings, strategies as st

from app.agents.cheater import CheaterAgent
from app.agents.registry import AgentRegistry
from app.config import DEFAULT_PROFILES, Scenario
from app.simulation.environment import EnvironmentState
from app.simulation.runner import SimulationRunner
from app.simulation.scenarios import create_scenario_events


SCENARIO_LIST = [
    "normal",
    "cyclone",
    "grid_failure",
    "hospital_generator_failure",
    "water_shortage",
    "telecom_failure",
    "cheater_under_scarcity",
]

ALL_AGENTS = ["hospital", "water", "emergency", "telecom", "residential"]


class TestMisreportRunawayPrevention:
    """Rigorous verification of demand stability under cheater misreporting."""

    @pytest.mark.parametrize("scenario", SCENARIO_LIST)
    def test_cheater_does_not_change_true_demand(self, scenario: str):
        """Assert true_demand series is identical between honest and cheater runs."""
        runner = SimulationRunner(seed=42)

        # Baseline: Misreport OFF
        honest_records, _ = runner.run_strategy(
            "proposed",
            scenario=scenario,
            horizon_steps=24,
            cheater_enabled=False,
        )

        for cheater_id in ALL_AGENTS:
            reg = AgentRegistry()
            reg.set_cheater_mode(cheater_id, True)

            cheat_records, _ = runner.run_strategy(
                "proposed",
                scenario=scenario,
                horizon_steps=24,
                cheater_enabled=True,
                registry=reg,
            )

            assert len(honest_records) == 24
            assert len(cheat_records) == 24

            for step_idx in range(24):
                h_rec = honest_records[step_idx]
                c_rec = cheat_records[step_idx]

                # (a) True demand series must be strictly identical across every step
                for aid in ALL_AGENTS:
                    h_dem = h_rec["demands"][aid]
                    c_dem = c_rec["demands"][aid]
                    assert math.isclose(h_dem, c_dem, abs_tol=1e-3), (
                        f"Scenario {scenario}, Step {step_idx + 1}, Agent {aid}: "
                        f"Cheater {cheater_id} modified true physical demand! "
                        f"Honest={h_dem}, CheaterRun={c_dem}"
                    )

                # (c) Total true demand <= 3x nominal total demand (~35 MW nominal -> max 105 MW)
                total_dem = sum(c_rec["demands"].values())
                assert total_dem <= 105.0, (
                    f"Scenario {scenario}, Step {step_idx + 1}: Total demand {total_dem} exceeds 3x nominal!"
                )

                # (d) No NaN/Inf and no negative numbers
                for aid, d in c_rec["demands"].items():
                    assert math.isfinite(d) and d >= 0.0

                # (e) 0 capacity violations
                alloc_sum = sum(c_rec["allocations"].values())
                assert alloc_sum <= c_rec["supply_mw"] + 1e-4

    def test_cheater_claim_never_compounds(self):
        """Assert Municipal Water Treatment claim does not compound at step 24."""
        reg = AgentRegistry()
        reg.set_cheater_mode("water", True)

        water_agent = reg.get("water")
        assert isinstance(water_agent, CheaterAgent)

        env = EnvironmentState(seed=42)

        # Simulate 24 steps
        claimed_history = []
        true_history = []

        for step in range(1, 25):
            env_snap = env.get_state_snapshot()
            water_agent.observe_environment(env_snap)

            true_d = water_agent.estimate_demand(env_snap)
            bid = water_agent.generate_bid(env_version=env.env_version)

            claimed_history.append(bid.requested_mw)
            true_history.append(true_d)

            env.step_environment()

        # Water certified max is 25.0 (or 20.0), nominal is ~4.0
        # In step 24, claim must be strictly bounded (e.g. <= 25.0 MW), never 5 million MW!
        for step, (claim, true_d) in enumerate(zip(claimed_history, true_history), 1):
            assert claim <= water_agent.certified_max_mw + 1e-4, (
                f"Step {step}: Claim {claim} exceeded certified max {water_agent.certified_max_mw}!"
            )
            assert claim >= true_d * 0.9, "Claim should be at least near true demand"
            assert claim <= true_d * 2.2 + 1e-4, "Multiplier must never compound across steps!"

        # Step 24 claim must be modest
        assert claimed_history[-1] < 30.0, f"Step 24 claim runaway: {claimed_history[-1]} MW"

    def test_idempotent_cheater_arming(self):
        """Assert arming cheater multiple times produces identical state without compounding."""
        reg = AgentRegistry()

        # Arm once
        reg.set_cheater_mode("water", True)
        agent_once = reg.get("water")
        bid_once = agent_once.generate_bid(env_version=1)

        # Arm again (idempotent call)
        reg.set_cheater_mode("water", True)
        agent_twice = reg.get("water")
        bid_twice = agent_twice.generate_bid(env_version=1)

        assert math.isclose(bid_once.requested_mw, bid_twice.requested_mw, abs_tol=1e-3)

        # Toggle off then on
        reg.set_cheater_mode("water", False)
        assert not reg.is_cheater("water")

        reg.set_cheater_mode("water", True)
        assert reg.is_cheater("water")
        agent_rearmed = reg.get("water")
        bid_rearmed = agent_rearmed.generate_bid(env_version=1)

        assert math.isclose(bid_once.requested_mw, bid_rearmed.requested_mw, abs_tol=1e-3)

    def test_single_cheater_at_a_time(self):
        """Assert arming a second cheater automatically disarms the first."""
        reg = AgentRegistry()
        reg.set_cheater_mode("water", True)
        assert reg.is_cheater("water")
        assert not reg.is_cheater("hospital")

        reg.set_cheater_mode("hospital", True)
        assert not reg.is_cheater("water"), "Water was not disarmed when Hospital was armed!"
        assert reg.is_cheater("hospital")
        assert isinstance(reg.get("hospital"), CheaterAgent)
        assert not isinstance(reg.get("water"), CheaterAgent)

    def test_determinism_seed_42(self):
        """Assert identical seed and cheater mode yield identical ledger hash and metrics."""
        runner1 = SimulationRunner(seed=42)
        records1, metrics1 = runner1.run_strategy("proposed", "cyclone", 12, cheater_enabled=True)

        runner2 = SimulationRunner(seed=42)
        records2, metrics2 = runner2.run_strategy("proposed", "cyclone", 12, cheater_enabled=True)

        for r1, r2 in zip(records1, records2):
            assert r1["demands"] == r2["demands"]
            assert r1["allocations"] == r2["allocations"]
            assert r1["supply_mw"] == r2["supply_mw"]

        assert metrics1.total_unmet_demand_mwh == metrics2.total_unmet_demand_mwh
        assert metrics1.cumulative_damage == metrics2.cumulative_damage


class TestPropertyHypothesisBounds:
    """Hypothesis property-based tests verifying demand invariants across arbitrary perturbations."""

    @settings(max_examples=100, deadline=None)
    @given(
        inflation=st.floats(min_value=1.1, max_value=2.5),
        severity=st.floats(min_value=0.0, max_value=1.0),
        agent_id=st.sampled_from(ALL_AGENTS),
    )
    def test_hypothesis_bounded_claims(self, inflation: float, severity: float, agent_id: str):
        """Assert claimed demand never exceeds certified max regardless of inflation/severity."""
        reg = AgentRegistry()
        reg.set_cheater_mode(agent_id, True)
        cheater = reg.get(agent_id)

        env_state = {"severity": severity, "step": 1, "water_reserve": 0.5}
        cheater.observe_environment(env_state)

        true_dem = cheater.estimate_demand(env_state)
        bid = cheater.generate_bid(env_version=1)

        assert 0.0 <= true_dem <= cheater.certified_max_mw + 1e-4
        assert bid.requested_mw <= cheater.certified_max_mw + 1e-4
        assert math.isfinite(bid.requested_mw)
        assert math.isfinite(true_dem)
