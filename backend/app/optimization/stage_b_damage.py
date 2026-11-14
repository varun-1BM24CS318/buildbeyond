"""
Stage B: Damage Minimization / Welfare Maximization LP
=====================================================

Maximizes total effective social welfare (damage avoided):
    maximize   Σ v_ik_eff · x_ik
    subject to:
        Σ_i s_i <= A* + ε_A         (Stage A shortfall held within tolerance)
        s_i >= M_i - x_i
        s_i >= 0
        0 <= x_ik <= cap_ik
        x_i <= D_i
        Σ_i x_i <= C

v_ik_eff includes the cascade shadow value from dependency propagation.
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
class StageBResult:
    success: bool
    status: str
    optimal_welfare: float
    allocations: dict[str, float]
    segment_allocations: dict[str, dict[str, float]]
    shortfalls: dict[str, float]
    binding_constraints: list[str]
    solve_time: float


def solve_stage_b(
    bids: dict[str, BidMessage],
    supply_mw: float,
    minimums: dict[str, float],
    stage_a_shortfall: float,
    effective_values: dict[str, dict[str, float]] | None = None,
    epsilon_a: float = 1e-4,
    topology: NetworkTopology | None = None,
) -> StageBResult:
    """Solve Stage B LP maximizing damage avoided while preserving Stage A guarantee."""
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
    n_vars = n_segs + n_agents
    shortfall_indices = {aid: n_segs + i for i, aid in enumerate(agent_ids)}

    # Linprog minimizes c @ x, so to maximize welfare, c = - v_eff
    c = np.zeros(n_vars)
    for idx, (aid, sname, cap, v_eff) in enumerate(seg_keys):
        c[idx] = -v_eff
    # Shortfall variables have 0 cost in Stage B objective (bounded by constraint)

    # Variable bounds
    bounds = []
    for aid, sname, cap, _ in seg_keys:
        bounds.append((0.0, cap))
    for aid in agent_ids:
        bounds.append((0.0, None))

    A_ub_list = []
    b_ub_list = []
    constraint_names = []

    # 1. Total capacity: Σ_i Σ_k x_ik <= supply_mw
    cap_row = np.zeros(n_vars)
    for i in range(n_segs):
        cap_row[i] = 1.0
    A_ub_list.append(cap_row)
    b_ub_list.append(supply_mw)
    constraint_names.append("total_capacity")

    # 2. Demand caps: Σ_k x_ik <= D_i
    for aid in agent_ids:
        d_row = np.zeros(n_vars)
        for s_idx in agent_seg_indices[aid]:
            d_row[s_idx] = 1.0
        A_ub_list.append(d_row)
        b_ub_list.append(bids[aid].requested_mw)
        constraint_names.append(f"demand_cap_{aid}")

    # 3. Shortfall bounds: M_i - Σ_k x_ik <= s_i  =>  - Σ_k x_ik - s_i <= - M_i
    for aid in agent_ids:
        sf_row = np.zeros(n_vars)
        for s_idx in agent_seg_indices[aid]:
            sf_row[s_idx] = -1.0
        sf_row[shortfall_indices[aid]] = -1.0
        A_ub_list.append(sf_row)
        b_ub_list.append(-minimums.get(aid, 0.0))
        constraint_names.append(f"shortfall_def_{aid}")

    # 4. Stage A guarantee: Σ_i s_i <= stage_a_shortfall + epsilon_a
    stage_a_row = np.zeros(n_vars)
    for s_idx in shortfall_indices.values():
        stage_a_row[s_idx] = 1.0
    A_ub_list.append(stage_a_row)
    b_ub_list.append(stage_a_shortfall + epsilon_a)
    constraint_names.append("stage_a_guarantee")

    # 5. Network feeder thermal limits
    if NETWORK_MODEL_ENABLED and topology is not None:
        net_A, net_b, net_names = build_network_line_constraints(agent_seg_indices, n_vars, topology)
        A_ub_list.extend(net_A)
        b_ub_list.extend(net_b)
        constraint_names.extend(net_names)

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
        return StageBResult(
            success=False,
            status=f"Exception: {exc}",
            optimal_welfare=0.0,
            allocations={aid: 0.0 for aid in agent_ids},
            segment_allocations={aid: {} for aid in agent_ids},
            shortfalls={aid: 0.0 for aid in agent_ids},
            binding_constraints=[],
            solve_time=time.perf_counter() - t0,
        )

    solve_time = time.perf_counter() - t0

    if not res.success:
        return StageBResult(
            success=False,
            status=res.message,
            optimal_welfare=0.0,
            allocations={aid: 0.0 for aid in agent_ids},
            segment_allocations={aid: {} for aid in agent_ids},
            shortfalls={aid: 0.0 for aid in agent_ids},
            binding_constraints=[],
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

    opt_welfare = -float(res.fun)

    # Identify binding constraints (slack < 1e-6)
    slacks = b_ub - (A_ub @ res.x)
    binding = [name for name, slack in zip(constraint_names, slacks) if abs(slack) < 1e-6]

    return StageBResult(
        success=True,
        status="optimal",
        optimal_welfare=opt_welfare,
        allocations=allocations,
        segment_allocations=segment_allocations,
        shortfalls=shortfalls,
        binding_constraints=binding,
        solve_time=solve_time,
    )
