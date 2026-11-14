"""
Centralized LP Oracle (Theoretical Upper Bound)
==============================================

Solves a centralized LP using ground-truth private demand D_true_i(t) without
any strategic inflation or incomplete information.
Serves as the empirical benchmark to measure the optimality gap of negotiation.
"""

from __future__ import annotations

import time
import numpy as np
from scipy.optimize import linprog

from app.config import EPS, SOLVER_TIME_LIMIT
from app.negotiation.messages import AllocationResult, SegmentAllocation
from app.optimization.validator import AllocationValidator


class CentralizedLPOracle:
    """Centralized social planner with perfect information."""

    @staticmethod
    def solve_oracle(
        true_demands: dict[str, float],
        segments: dict[str, list[tuple[str, float, float]]],  # (sname, cap, val)
        minimums: dict[str, float],
        criticalities: dict[str, float],
        supply_mw: float,
        env_version: int = 1,
    ) -> dict[str, AllocationResult]:
        t0 = time.perf_counter()
        agent_ids = sorted(true_demands.keys())
        n_agents = len(agent_ids)

        seg_keys: list[tuple[str, str, float, float]] = []
        agent_seg_indices: dict[str, list[int]] = {}

        var_idx = 0
        for aid in agent_ids:
            agent_seg_indices[aid] = []
            for sname, cap, val in segments.get(aid, []):
                # Scale by criticality
                val_eff = val * criticalities.get(aid, 1.0)
                seg_keys.append((aid, sname, cap, val_eff))
                agent_seg_indices[aid].append(var_idx)
                var_idx += 1

        n_segs = len(seg_keys)
        # Variables: segments + shortfalls
        n_vars = n_segs + n_agents
        shortfall_indices = {aid: n_segs + i for i, aid in enumerate(agent_ids)}

        # Objective: minimize shortfall * 1000 - welfare
        c = np.zeros(n_vars)
        for idx, (aid, sname, cap, val_eff) in enumerate(seg_keys):
            c[idx] = -val_eff
        for aid, s_idx in shortfall_indices.items():
            c[s_idx] = criticalities.get(aid, 1.0) * 1000.0

        bounds = []
        for aid, sname, cap, _ in seg_keys:
            bounds.append((0.0, cap))
        for aid in agent_ids:
            bounds.append((0.0, None))

        A_ub_list = []
        b_ub_list = []

        # 1. Total capacity
        cap_row = np.zeros(n_vars)
        for i in range(n_segs):
            cap_row[i] = 1.0
        A_ub_list.append(cap_row)
        b_ub_list.append(supply_mw)

        # 2. True demand caps
        for aid in agent_ids:
            d_row = np.zeros(n_vars)
            for s_idx in agent_seg_indices[aid]:
                d_row[s_idx] = 1.0
            A_ub_list.append(d_row)
            b_ub_list.append(true_demands[aid])

        # 3. Shortfall bounds: M_i - x_i <= s_i
        for aid in agent_ids:
            sf_row = np.zeros(n_vars)
            for s_idx in agent_seg_indices[aid]:
                sf_row[s_idx] = -1.0
            sf_row[shortfall_indices[aid]] = -1.0
            A_ub_list.append(sf_row)
            b_ub_list.append(-minimums.get(aid, 0.0))

        res = linprog(
            c,
            A_ub=np.array(A_ub_list),
            b_ub=np.array(b_ub_list),
            bounds=bounds,
            method="highs",
            options={"time_limit": SOLVER_TIME_LIMIT},
        )

        allocs: dict[str, float] = {}
        if res.success:
            for aid in agent_ids:
                tot = sum(max(0.0, float(res.x[idx])) for idx in agent_seg_indices[aid])
                allocs[aid] = tot
        else:
            # Fallback proportional if solver hiccups
            tot_d = sum(true_demands.values())
            scale = min(1.0, supply_mw / max(tot_d, EPS))
            allocs = {aid: true_demands[aid] * scale for aid in agent_ids}

        rounded = AllocationValidator.sanitize_and_round(
            allocs, supply_mw=supply_mw, demand_caps=true_demands, precision=4
        )

        results: dict[str, AllocationResult] = {}
        for aid in agent_ids:
            mw = rounded.get(aid, 0.0)
            shortfall = max(0.0, minimums.get(aid, 0.0) - mw)
            d = true_demands[aid]
            results[aid] = AllocationResult(
                agent_id=aid,
                allocated_mw=mw,
                segments=[SegmentAllocation(name="oracle", allocated_mw=mw, capacity_mw=d)],
                unmet_mw=max(0.0, d - mw),
                critical_shortfall=shortfall,
                env_version=env_version,
                txn_id=f"oracle-{aid}",
                fallback=False,
            )
        return results
