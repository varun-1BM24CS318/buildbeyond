"""
System Metrics & Benchmark Analysis
===================================

Defines and computes all operational and comparative metrics across simulation runs.
Zero hardcoded results — every metric is evaluated directly from step allocations and damage physics.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

from app.config import EPS
from app.negotiation.messages import AllocationResult


@dataclass(slots=True)
class SimulationMetrics:
    strategy_name: str
    total_steps: int
    cumulative_damage: float
    cascade_damage: float
    critical_service_uptime: float  # [0, 1] percentage of steps critical minimums met
    total_unmet_demand_mwh: float
    mean_jains_index: float
    priority_weighted_unserved: float
    capacity_violations: int  # MUST BE ZERO ALWAYS
    allocation_churn: float   # Mean absolute step-to-step MW swing
    mean_solve_time_ms: float
    optimality_gap_pct: float = 0.0  # vs LP oracle


def calculate_jains_index(allocations: Sequence[float], demands: Sequence[float]) -> float:
    """Compute Jain's Fairness Index on allocation ratios."""
    ratios = []
    for a, d in zip(allocations, demands):
        if d > EPS:
            ratios.append(min(1.0, max(0.0, a / d)))

    if not ratios:
        return 1.0

    n = len(ratios)
    sum_r = sum(ratios)
    sum_sq = sum(r * r for r in ratios)

    if sum_sq <= EPS:
        return 0.0

    return round((sum_r ** 2) / (n * sum_sq), 4)


def evaluate_simulation_run(
    strategy_name: str,
    step_records: list[dict],
    oracle_damage: float | None = None,
) -> SimulationMetrics:
    """Compute all evaluation metrics across a multi-step simulation trajectory.

    step_records format per step:
    {
        "step": int,
        "supply_mw": float,
        "allocations": dict[agent_id, float],
        "demands": dict[agent_id, float],
        "minimums": dict[agent_id, float],
        "criticalities": dict[agent_id, float],
        "damages": dict[agent_id, float],
        "cascade_damages": dict[agent_id, float],
        "solve_time_ms": float,
    }
    """
    total_steps = len(step_records)
    if total_steps == 0:
        return SimulationMetrics(
            strategy_name=strategy_name,
            total_steps=0,
            cumulative_damage=0.0,
            cascade_damage=0.0,
            critical_service_uptime=1.0,
            total_unmet_demand_mwh=0.0,
            mean_jains_index=1.0,
            priority_weighted_unserved=0.0,
            capacity_violations=0,
            allocation_churn=0.0,
            mean_solve_time_ms=0.0,
            optimality_gap_pct=0.0,
        )

    cum_damage = 0.0
    cascade_damage = 0.0
    total_unmet = 0.0
    priority_unserved = 0.0
    critical_met_steps = 0
    capacity_violations = 0
    jains_scores = []
    churn_total = 0.0
    solve_times = []

    prev_allocs: dict[str, float] | None = None

    for rec in step_records:
        supply = rec["supply_mw"]
        allocs = rec["allocations"]
        demands = rec["demands"]
        minimums = rec["minimums"]
        criticalities = rec["criticalities"]
        damages = rec.get("damages", {})
        c_damages = rec.get("cascade_damages", {})

        # 1. Capacity Invariant Check: Sum <= Supply + EPS
        tot_alloc = sum(allocs.values())
        if tot_alloc > supply + 1e-4:
            capacity_violations += 1

        # 2. Cumulative damage
        cum_damage += sum(damages.values())
        cascade_damage += sum(c_damages.values())

        # 3. Critical uptime check
        all_crit_met = True
        for aid, min_req in minimums.items():
            got = allocs.get(aid, 0.0)
            if got < min_req - 1e-3:
                all_crit_met = False
                break
        if all_crit_met:
            critical_met_steps += 1

        # 4. Unmet and priority unserved
        for aid, dem in demands.items():
            got = allocs.get(aid, 0.0)
            unmet_i = max(0.0, dem - got)
            total_unmet += unmet_i
            crit_i = criticalities.get(aid, 1.0)
            priority_unserved += unmet_i * crit_i

        # 5. Jain's index
        j_idx = calculate_jains_index(list(allocs.values()), list(demands.values()))
        jains_scores.append(j_idx)

        # 6. Churn calculation
        if prev_allocs is not None:
            step_churn = sum(abs(allocs.get(aid, 0.0) - prev_allocs.get(aid, 0.0)) for aid in demands)
            churn_total += step_churn
        prev_allocs = dict(allocs)

        solve_times.append(rec.get("solve_time_ms", 1.0))

    uptime = round(critical_met_steps / total_steps, 4)
    mean_jains = round(sum(jains_scores) / len(jains_scores), 4) if jains_scores else 1.0
    mean_churn = round(churn_total / max(1, total_steps - 1), 4)
    mean_solve = round(sum(solve_times) / len(solve_times), 2) if solve_times else 0.0

    gap_pct = 0.0
    if oracle_damage is not None and oracle_damage > EPS:
        # Gap vs oracle in damage avoidance
        gap_pct = round(max(0.0, (cum_damage - oracle_damage) / oracle_damage) * 100.0, 2)

    return SimulationMetrics(
        strategy_name=strategy_name,
        total_steps=total_steps,
        cumulative_damage=round(cum_damage, 2),
        cascade_damage=round(cascade_damage, 2),
        critical_service_uptime=uptime,
        total_unmet_demand_mwh=round(total_unmet, 2),
        mean_jains_index=mean_jains,
        priority_weighted_unserved=round(priority_unserved, 2),
        capacity_violations=capacity_violations,
        allocation_churn=mean_churn,
        mean_solve_time_ms=mean_solve,
        optimality_gap_pct=gap_pct,
    )
