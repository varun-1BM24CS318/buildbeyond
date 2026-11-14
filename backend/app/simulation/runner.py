"""
Simulation Benchmark & Trajectory Runner
========================================

Executes multi-step scenario runs across all strategies under identical physics:
- Proportional Baseline
- Strict-Priority Baseline
- Proposed (Negotiation + LP Pipeline + Cascade-Aware)
- LP Oracle (Centralized upper bound)
"""

from __future__ import annotations

import logging
import time
from typing import Any

from app.agents.registry import AgentRegistry
from app.analytics.baselines import ProportionalBaseline, StrictPriorityBaseline
from app.analytics.metrics import (
    SimulationMetrics,
    calculate_optimality_gap,
    evaluate_simulation_run,
)
from app.analytics.oracle import CentralizedLPOracle
from app.config import DEFAULT_PROFILES, EPS, EventType, NETWORK_MODEL_ENABLED, Scenario
from app.negotiation.ledger import Ledger
from app.negotiation.state_machine import NegotiationSession
from app.network.topology import NetworkTopology
from app.optimization.pipeline import OptimizationPipeline
from app.simulation.cascade import CascadeModel
from app.simulation.environment import EnvironmentState
from app.simulation.scenarios import create_scenario_events

logger = logging.getLogger("simulation.runner")


class SimulationRunner:
    """Executes identical runs of scenarios across different strategies."""

    def __init__(self, seed: int = 42) -> None:
        self.seed = seed

    def run_strategy(
        self,
        strategy_name: str,
        scenario: str = "cheater_under_scarcity",
        horizon_steps: int = 12,
        cheater_enabled: bool = False,
    ) -> tuple[list[dict], SimulationMetrics]:
        """Run a single strategy through a scenario and collect step records and metrics."""
        env = EnvironmentState(seed=self.seed)
        ledger = Ledger(":memory:")
        cascade = CascadeModel()
        registry = AgentRegistry()
        network = NetworkTopology()

        # Schedule scenario events
        events = create_scenario_events(scenario)
        for ev in events:
            env.queue_event(ev)

        step_records: list[dict] = []
        pipeline = OptimizationPipeline()

        for step in range(1, horizon_steps + 1):
            t0 = time.perf_counter()

            # Advance environment step & drain events
            applied_events = env.step_environment()
            env_snap = env.get_state_snapshot()

            if NETWORK_MODEL_ENABLED:
                for ev in applied_events:
                    if ev.event_type == EventType.LINE_DERATE:
                        network.derate_feeder(ev.target_agent or "feeder_1", ev.magnitude)
                    elif ev.event_type == EventType.LINE_RESTORE:
                        network.restore_feeder(ev.target_agent or "feeder_1")

            # Update agents with observations
            for aid, agent in registry.get_all().items():
                agent.observe_environment(env_snap)

            agents = registry.get_all()
            minimums = {aid: a.minimum_mw for aid, a in agents.items()}
            criticalities = {aid: a.criticality for aid, a in agents.items()}

            # Collect true demand
            true_demands = {aid: agent.estimate_demand(env_snap) for aid, a in agents.items()}

            # Generate bids (or simulate cheater inflation if active)
            bids = {}
            for aid, a in agents.items():
                b = a.generate_bid(env_version=env.env_version)
                if cheater_enabled and aid == "residential":
                    # Cheater inflates demand by 1.8x up to certified max
                    inflated = min(a.certified_max_mw, b.requested_mw * 1.8)
                    b.requested_mw = inflated
                    b.reason = "STRATEGIC_INFLATION: Cheater agent inflated demand"
                bids[aid] = b

            # Strategy Allocation Dispatch
            allocations_mw: dict[str, float] = {}

            if strategy_name.lower() == "proportional":
                prop_res = ProportionalBaseline.allocate(
                    bids, env.supply_mw, env.env_version, topology=network if NETWORK_MODEL_ENABLED else None
                )
                allocations_mw = {aid: r.allocated_mw for aid, r in prop_res.items()}

            elif strategy_name.lower() in ("priority", "strict_priority"):
                prio_res = StrictPriorityBaseline.allocate(
                    bids, env.supply_mw, env.env_version, criticalities, topology=network if NETWORK_MODEL_ENABLED else None
                )
                allocations_mw = {aid: r.allocated_mw for aid, r in prio_res.items()}

            elif strategy_name.lower() == "oracle":
                seg_data = {
                    aid: [(s.name, s.capacity_mw, s.marginal_value) for s in agents[aid]._profile.segments]
                    for aid in agents
                }
                oracle_res = CentralizedLPOracle.solve_oracle(
                    true_demands=true_demands,
                    segments=seg_data,
                    minimums=minimums,
                    criticalities=criticalities,
                    supply_mw=env.supply_mw,
                    env_version=env.env_version,
                )
                allocations_mw = {aid: r.allocated_mw for aid, r in oracle_res.items()}

            else:  # "proposed" (Negotiation + LP Pipeline + Cascade-Aware)
                # Compute cascade shadow values for Stage B
                base_segs = {
                    aid: [(s.name, s.capacity_mw, s.marginal_value) for s in agents[aid]._profile.segments]
                    for aid in agents
                }
                eff_vals = cascade.compute_cascade_shadow_values(base_segs, criticalities)

                # Optimizer function incorporating cascade shadow values and network topology
                def cascade_lp_optimizer(bids, supply_mw, env_version, agents):
                    res = pipeline.solve(
                        bids=bids,
                        supply_mw=supply_mw,
                        env_version=env_version,
                        minimums=minimums,
                        criticalities=criticalities,
                        effective_values=eff_vals,
                        topology=network if NETWORK_MODEL_ENABLED else None,
                    )
                    return res.allocations

                session = NegotiationSession(
                    step=step,
                    env_version=env.env_version,
                    supply_mw=env.supply_mw,
                    agents=agents,
                    ledger=ledger,
                    optimizer_fn=cascade_lp_optimizer,
                )
                session_res = session.run()
                allocations_mw = {aid: r.allocated_mw for aid, r in session_res.items()}

            solve_time_ms = (time.perf_counter() - t0) * 1000

            # Evaluate identical cascade physics
            cascade_res = cascade.evaluate_step(
                allocations=allocations_mw,
                true_demands=true_demands,
                criticalities=criticalities,
            )

            # Record step
            step_records.append({
                "step": step,
                "supply_mw": env.supply_mw,
                "allocations": allocations_mw,
                "demands": true_demands,
                "minimums": minimums,
                "criticalities": criticalities,
                "damages": cascade_res.total_damages,
                "cascade_damages": cascade_res.cascade_damages,
                "service_levels": cascade_res.service_levels,
                "solve_time_ms": solve_time_ms,
            })

        metrics = evaluate_simulation_run(strategy_name, step_records)
        return step_records, metrics

    def run_benchmark_comparison(
        self,
        scenario: str = "cheater_under_scarcity",
        horizon_steps: int = 12,
        cheater_enabled: bool = False,
    ) -> dict[str, SimulationMetrics]:
        """Run all 4 strategies and compute relative optimality gap."""
        strategies = ["proportional", "strict_priority", "proposed", "oracle"]
        results: dict[str, SimulationMetrics] = {}

        # Run oracle first for upper bound benchmark
        _, oracle_metrics = self.run_strategy("oracle", scenario, horizon_steps, cheater_enabled=False)
        results["oracle"] = oracle_metrics

        for strat in ["proportional", "strict_priority", "proposed"]:
            _, met = self.run_strategy(strat, scenario, horizon_steps, cheater_enabled=cheater_enabled)
            # Compute optimality gap vs oracle
            met.optimality_gap_pct = calculate_optimality_gap(
                met.cumulative_damage, oracle_metrics.cumulative_damage
            )
            results[strat] = met

        return results
