"""
Stage C: Weighted Max-Min Fairness LP
=====================================

Maximizes the minimum satisfaction fraction λ across eligible agents:
    maximize   λ
    subject to:
        x_i >= λ · weight_i · D_i   (for all agents with D_i > 0)
        Σ v_ik_eff · x_ik >= B* - ε_B (Stage B welfare held within tolerance)
        Σ_i s_i <= A* + ε_A          (Stage A critical shortfall held)
        Σ_i x_i <= C
        0 <= x_ik <= cap_ik
        x_i <= D_i

Also computes Jain's Fairness Index across agents.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
import numpy as np
from scipy.optimize import linprog

from app.config import EPS, SOLVER_TIME_LIMIT
from app.negotiation.messages import BidMessage


@dataclass(slots=True)
class StageCResult:
    success: bool
    status: str
    lambda_fairness: float
    jains_index: float
    allocations: dict[str, float]
    segment_allocations: dict[str, dict[str, float]]
    shortfalls: dict[str, float]
    solve_time: float


def compute_jains_index(allocations: dict[str, float], demands: dict[str, float]) -> float:
    """Compute Jain's Fairness Index on satisfaction ratios r_i = x_i / D_i."""
    ratios = []
    for aid, alloc in allocations.items():
        d = demands.get(aid, 0.0)
        if d > EPS:
            ratios.append(min(1.0, alloc / d))

    if not ratios:
        return 1.0

    n = len(ratios)
    sum_r = sum(ratios)
    sum_sq_r = sum(r * r for r in ratios)

    if sum_sq_r <= EPS:
        return 0.0

    return (sum_r ** 2) / (n * sum_sq_r)


def solve_stage_c(
    bids: dict[str, BidMessage],
    supply_mw: float,
    minimums: dict[str, float],
    stage_a_shortfall: float,
    stage_b_welfare: float,
    effective_values: dict[str, dict[str, float]] | None = None,
    weights: dict[str, float] | None = None,
    epsilon_a: float = 1e-4,
    epsilon_b: float = 1e-3,
) -> StageCResult:
    """Solve Stage C LP maximizing fairness ratio λ subject to Stage A & B tolerances."""
    t0 = time.perf_counter()

    agent_ids = sorted(bids.keys())
    n_agents = len(agent_ids)

    # Segment indexing
    seg_keys: list[tuple[str, str, float, float]] = []  # (aid, seg_name, cap, v_eff)
    agent_seg_indices: dict[str, list[int]] = {}

    var_idx = 0
    for aid in agent_ids:
        agent_seg_indices[aid] = []
        bid = bids[aid]
        eff_vals = (effective_values or {}).get(aid, {})
        for seg in bid.segments:
            v_eff = eff_vals.get(seg.name, seg.marginal_value)
            seg_keys.append((aid, seg.name, seg.capacity_mw, v_eff))
            agent_seg_indices[aid].append(var_idx)
            var_idx += 1

    n_segs = len(seg_keys)
    # Variables: n_segs + n_agents (shortfalls) + 1 (lambda)
    lambda_idx = n_segs + n_agents
    n_vars = lambda_idx + 1
    shortfall_indices = {aid: n_segs + i for i, aid in enumerate(agent_ids)}

    # Linprog minimizes c @ x. We want to maximize λ => c[lambda_idx] = -1.0
    c = np.zeros(n_vars)
    c[lambda_idx] = -1.0

    # Bounds
    bounds = []
    for aid, sname, cap, _ in seg_keys:
        bounds.append((0.0, cap))
    for aid in agent_ids:
        bounds.append((0.0, None))
    # 0 <= λ <= 1.0
    bounds.append((0.0, 1.0))

    A_ub_list = []
    b_ub_list = []

    # 1. Total capacity: Σ_i Σ_k x_ik <= supply_mw
    cap_row = np.zeros(n_vars)
    for i in range(n_segs):
        cap_row[i] = 1.0
    A_ub_list.append(cap_row)
    b_ub_list.append(supply_mw)

    # 2. Demand caps: Σ_k x_ik <= D_i
    for aid in agent_ids:
        d_row = np.zeros(n_vars)
        for s_idx in agent_seg_indices[aid]:
            d_row[s_idx] = 1.0
        A_ub_list.append(d_row)
        b_ub_list.append(bids[aid].requested_mw)

    # 3. Shortfall bounds: M_i - Σ_k x_ik <= s_i => - Σ_k x_ik - s_i <= - M_i
    for aid in agent_ids:
        sf_row = np.zeros(n_vars)
        for s_idx in agent_seg_indices[aid]:
            sf_row[s_idx] = -1.0
        sf_row[shortfall_indices[aid]] = -1.0
        A_ub_list.append(sf_row)
        b_ub_list.append(-minimums.get(aid, 0.0))

    # 4. Stage A constraint: Σ s_i <= A* + ε_A
    stg_a_row = np.zeros(n_vars)
    for s_idx in shortfall_indices.values():
        stg_a_row[s_idx] = 1.0
    A_ub_list.append(stg_a_row)
    b_ub_list.append(stage_a_shortfall + epsilon_a)

    # 5. Stage B constraint: Σ v_ik_eff · x_ik >= B* - ε_B => - Σ v_ik_eff · x_ik <= - (B* - ε_B)
    stg_b_row = np.zeros(n_vars)
    for idx, (aid, sname, cap, v_eff) in enumerate(seg_keys):
        stg_b_row[idx] = -v_eff
    A_ub_list.append(stg_b_row)
    b_ub_list.append(-(stage_b_welfare - epsilon_b))

    # 6. Fairness constraint: x_i >= λ · weight_i · D_i  =>  - Σ_k x_ik + λ · (weight_i · D_i) <= 0
    weights_map = weights or {aid: 1.0 for aid in agent_ids}
    for aid in agent_ids:
        d_i = bids[aid].requested_mw
        if d_i > EPS:
            w_i = weights_map.get(aid, 1.0)
            fair_row = np.zeros(n_vars)
            for s_idx in agent_seg_indices[aid]:
                fair_row[s_idx] = -1.0
            fair_row[lambda_idx] = w_i * d_i
            A_ub_list.append(fair_row)
            b_ub_list.append(0.0)

    A_ub = np.array(A_ub_list)
    b_ub = np.array(b_ub_list)

    try:
        res = linprog(
            c,
            A_ub=A_ub,
            b_ub=b_ub,
            bounds=bounds,
            method="highs",
            options={"time_limit": SOLVER_TIME_LIMIT},
        )
    except Exception as exc:
        return StageCResult(
            success=False,
            status=f"Exception: {exc}",
            lambda_fairness=0.0,
            jains_index=0.0,
            allocations={aid: 0.0 for aid in agent_ids},
            segment_allocations={aid: {} for aid in agent_ids},
            shortfalls={aid: 0.0 for aid in agent_ids},
            solve_time=time.perf_counter() - t0,
        )

    solve_time = time.perf_counter() - t0

    if not res.success:
        return StageCResult(
            success=False,
            status=res.message,
            lambda_fairness=0.0,
            jains_index=0.0,
            allocations={aid: 0.0 for aid in agent_ids},
            segment_allocations={aid: {} for aid in agent_ids},
            shortfalls={aid: 0.0 for aid in agent_ids},
            solve_time=solve_time,
        )

    allocations: dict[str, float] = {}
    segment_allocations: dict[str, dict[str, float]] = {aid: {} for aid in agent_ids}
    shortfalls: dict[str, float] = {}

    for aid in agent_ids:
        seg_sum = 0.0
        for idx in agent_seg_indices[aid]:
            aid_k, sname, _, _ = seg_keys[idx]
            val = max(0.0, float(res.x[idx]))
            segment_allocations[aid][sname] = val
            seg_sum += val
        allocations[aid] = seg_sum
        shortfalls[aid] = max(0.0, float(res.x[shortfall_indices[aid]]))

    lambda_val = max(0.0, float(res.x[lambda_idx]))
    demands = {aid: bids[aid].requested_mw for aid in agent_ids}
    jains = compute_jains_index(allocations, demands)

    return StageCResult(
        success=True,
        status="optimal",
        lambda_fairness=lambda_val,
        jains_index=jains,
        allocations=allocations,
        segment_allocations=segment_allocations,
        shortfalls=shortfalls,
        solve_time=solve_time,
    )
