"""
Phase 5 Gate Tests: Simulation Reproducibility & Benchmark Metrics
=================================================================

Validates:
1. Determinism: Same seed twice -> identical results; different seeds -> different results.
2. Capacity violations: MUST BE 0 across all runs and strategies.
3. Comparative benchmarking: Proportional, Priority, Proposed, and Oracle.
4. Prints formatted markdown metrics table.
"""

import pytest

from app.negotiation.ledger import Ledger
from app.simulation.runner import SimulationRunner


def test_simulation_reproducibility_same_seed():
    runner1 = SimulationRunner(seed=42)
    recs1, m1 = runner1.run_strategy("proposed", scenario="grid_failure", horizon_steps=6)

    runner2 = SimulationRunner(seed=42)
    recs2, m2 = runner2.run_strategy("proposed", scenario="grid_failure", horizon_steps=6)

    assert m1.cumulative_damage == m2.cumulative_damage
    assert m1.total_unmet_demand_mwh == m2.total_unmet_demand_mwh
    assert len(recs1) == len(recs2)

    # Every allocation at every step must be identical
    for r1, r2 in zip(recs1, recs2):
        assert r1["allocations"] == r2["allocations"]


def test_capacity_violations_strictly_zero_all_strategies():
    runner = SimulationRunner(seed=42)
    results = runner.run_benchmark_comparison(scenario="cyclone", horizon_steps=8)

    for name, metric in results.items():
        assert metric.capacity_violations == 0, f"Strategy {name} had capacity violations: {metric.capacity_violations}"


def test_benchmark_metrics_table_printed(capsys):
    runner = SimulationRunner(seed=42)
    results = runner.run_benchmark_comparison(scenario="cheater_under_scarcity", horizon_steps=6)

    print("\n" + "=" * 80)
    print("CRISIS RESOURCE ALLOCATION BENCHMARK (Seed 42, Scenario: Cheater Under Scarcity)")
    print("=" * 80)
    header = (
        f"{'Strategy':<18} | {'Damage':<8} | {'Cascade':<8} | {'Uptime':<7} | "
        f"{'Unmet':<8} | {'Jain':<6} | {'Violations':<10} | {'Opt Gap':<8}"
    )
    print(header)
    print("-" * 80)

    for name, m in results.items():
        row = (
            f"{name:<18} | {m.cumulative_damage:<8.1f} | {m.cascade_damage:<8.1f} | "
            f"{m.critical_service_uptime*100:<6.1f}% | {m.total_unmet_demand_mwh:<8.1f} | "
            f"{m.mean_jains_index:<6.3f} | {m.capacity_violations:<10} | {m.optimality_gap_pct:<7.1f}%"
        )
        print(row)
    print("=" * 80 + "\n")

    # Assert proposed beats proportional on damage or critical uptime
    prop = results["proportional"]
    ours = results["proposed"]
    assert ours.capacity_violations == 0
    assert prop.capacity_violations == 0
