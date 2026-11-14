"""
Stage A: Critical Protection LP
===============================

Minimizes weighted critical shortfalls across all agents:
    minimize  Σ_i w_i · s_i
    subject to:
        s_i >= M_i - x_i            (shortfall definition)
        s_i >= 0
        x_i = Σ_k x_ik              (segment breakdown)
        0 <= x_ik <= cap_ik
        x_i <= D_i                  (reported-after-concession demand)
        Σ_i x_i <= C                (hard grid capacity)

Uses scipy.optimize.linprog with method='highs'.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
import numpy as np
from scipy.optimize import linprog

from app.config import EPS, NETWORK_MODEL_ENABLED, SOLVER_TIME_LIMIT
from app.negotiation.messages import BidMessage
from app.network.constraints import build_network_line_constraints
from app.network.topology import NetworkTopology


@dataclass(slots=True)
class StageAResult:
    success: bool
    status: str
    optimal_shortfall: float
    critical_feasible: bool
    allocations: dict[str, float]
    segment_allocations: dict[str, dict[str, float]]
    shortfalls: dict[str, float]
    solve_time: float


def solve_stage_a(
    bids: dict[str, BidMessage],
    supply_mw: float,
    minimums: dict[str, float],
    criticalities: dict[str, float],
    topology: NetworkTopology | None = None,
) -> StageAResult:
    """Solve Stage A LP using SciPy HiGHS."""
    t0 = time.perf_counter()

    # Deterministic ordering by agent_id
    agent_ids = sorted(bids.keys())
    n_agents = len(agent_ids)

    # Count total segment variables
    # For each agent i: num_segs_i variables x_ik, plus 1 shortfall variable s_i
    seg_keys: list[tuple[str, str, float]] = []  # (agent_id, seg_name, cap_ik)
    agent_seg_indices: dict[str, list[int]] = {}

    var_idx = 0
    for aid in agent_ids:
        agent_seg_indices[aid] = []
        bid = bids[aid]
        for seg in bid.segments:
            seg_keys.append((aid, seg.name, seg.capacity_mw))
            agent_seg_indices[aid].append(var_idx)
            var_idx += 1

    n_segs = len(seg_keys)
    # Total variables = n_segs + n_agents (for shortfall s_i)
    n_vars = n_segs + n_agents
    shortfall_indices = {aid: n_segs + i for i, aid in enumerate(agent_ids)}

    # Objective: minimize Σ w_i * s_i
    # c vector: 0 for segments, w_i for shortfalls
    c = np.zeros(n_vars)
    for aid, s_idx in shortfall_indices.items():
        w_i = criticalities.get(aid, 1.0) * 1000.0  # heavy penalty on critical shortfall
        c[s_idx] = w_i

    # Bounds:
    bounds = []
    # 0 <= x_ik <= cap_ik
    for aid, sname, cap in seg_keys:
        bounds.append((0.0, cap))
    # 0 <= s_i <= None
    for aid in agent_ids:
        bounds.append((0.0, None))

    # Inequalities: A_ub @ x <= b_ub
    # 1. Total capacity: Σ_i Σ_k x_ik <= supply_mw
    A_ub_list = []
    b_ub_list = []

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

    # 3. Shortfall constraints: M_i - Σ_k x_ik <= s_i  =>  - Σ_k x_ik - s_i <= - M_i
    for aid in agent_ids:
        sf_row = np.zeros(n_vars)
        for s_idx in agent_seg_indices[aid]:
            sf_row[s_idx] = -1.0
        sf_row[shortfall_indices[aid]] = -1.0
        A_ub_list.append(sf_row)
        b_ub_list.append(-minimums.get(aid, 0.0))

    # 4. Network feeder thermal limits (if network model enabled)
    if NETWORK_MODEL_ENABLED and topology is not None:
        net_A, net_b, _ = build_network_line_constraints(agent_seg_indices, n_vars, topology)
        A_ub_list.extend(net_A)
        b_ub_list.extend(net_b)

    A_ub = np.array(A_ub_list)
    b_ub = np.array(b_ub_list)

    total_min = sum(minimums.values())
    critical_feasible = total_min <= supply_mw + EPS

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
        return StageAResult(
            success=False,
            status=f"Exception: {exc}",
            optimal_shortfall=total_min,
            critical_feasible=critical_feasible,
            allocations={aid: 0.0 for aid in agent_ids},
            segment_allocations={aid: {} for aid in agent_ids},
            shortfalls=dict(minimums),
            solve_time=time.perf_counter() - t0,
        )

    solve_time = time.perf_counter() - t0

    if not res.success:
        return StageAResult(
            success=False,
            status=res.message,
            optimal_shortfall=total_min,
            critical_feasible=critical_feasible,
            allocations={aid: 0.0 for aid in agent_ids},
            segment_allocations={aid: {} for aid in agent_ids},
            shortfalls=dict(minimums),
            solve_time=solve_time,
        )

    # Extract allocations
    allocations: dict[str, float] = {}
    segment_allocations: dict[str, dict[str, float]] = {aid: {} for aid in agent_ids}
    shortfalls: dict[str, float] = {}

    for aid in agent_ids:
        seg_sum = 0.0
        for idx in agent_seg_indices[aid]:
            aid_k, sname, _ = seg_keys[idx]
            val = max(0.0, float(res.x[idx]))
            segment_allocations[aid][sname] = val
            seg_sum += val
        allocations[aid] = seg_sum
        sf_val = max(0.0, float(res.x[shortfall_indices[aid]]))
        shortfalls[aid] = sf_val

    opt_shortfall = sum(shortfalls.values())

    return StageAResult(
        success=True,
        status="optimal",
        optimal_shortfall=opt_shortfall,
        critical_feasible=critical_feasible,
        allocations=allocations,
        segment_allocations=segment_allocations,
        shortfalls=shortfalls,
        solve_time=solve_time,
    )
