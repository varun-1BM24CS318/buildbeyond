"""
Optimization Pipeline Orchestrator (Stages A -> B -> C)
========================================================

Executes the lexicographic SciPy HiGHS multi-stage optimization pipeline:
1. Stage A: Critical protection (minimizes critical shortfall).
2. Stage B: Damage minimization (maximizes welfare + cascade shadow values).
3. Stage C: Weighted max-min fairness (maximizes minimum satisfaction ratio λ).
4. Fallback ladder: If any stage fails, enforces strict-priority allocation.
5. Invariant re-validation and 1e-4 rounding.
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from app.config import EPS, NETWORK_MODEL_ENABLED
from app.negotiation.messages import (
    AllocationResult,
    BidMessage,
    SegmentAllocation,
)
from app.network.constraints import project_to_network_feasible
from app.network.topology import NetworkTopology
from app.optimization.explain import (
    format_solve_explanation,
    generate_segment_explanations,
)
from app.optimization.stage_a_critical import solve_stage_a
from app.optimization.stage_b_damage import solve_stage_b
from app.optimization.stage_c_fairness import solve_stage_c
from app.optimization.validator import AllocationValidator

logger = logging.getLogger("optimization")


@dataclass(slots=True)
class PipelineResult:
    allocations: dict[str, AllocationResult]
    stage_a_shortfall: float
    stage_b_welfare: float
    stage_c_lambda: float
    jains_index: float
    binding_constraints: list[str]
    total_allocated_mw: float
    supply_mw: float
    solve_time_ms: float
    status: str
    is_fallback: bool
    summary_explanation: str
    explanations: dict[str, list[str]]


class OptimizationPipeline:
    """End-to-end lexicographic optimization pipeline."""

    def __init__(self, epsilon_a: float = 1e-4, epsilon_b: float = 1e-3) -> None:
        self.epsilon_a: float = epsilon_a
        self.epsilon_b: float = epsilon_b

    def solve(
        self,
        bids: dict[str, BidMessage],
        supply_mw: float,
        env_version: int,
        minimums: dict[str, float],
        criticalities: dict[str, float],
        effective_values: dict[str, dict[str, float]] | None = None,
        weights: dict[str, float] | None = None,
        topology: NetworkTopology | None = None,
    ) -> PipelineResult:
        """Run Stages A, B, C with fallback safety."""
        t_start = time.perf_counter()
        agent_ids = sorted(bids.keys())

        # If zero supply, everything is 0
        if supply_mw <= EPS:
            allocs = {}
            txn_id = str(uuid.uuid4())
            for aid in agent_ids:
                bid = bids[aid]
                shortfall = minimums.get(aid, 0.0)
                allocs[aid] = AllocationResult(
                    agent_id=aid,
                    allocated_mw=0.0,
                    segments=[SegmentAllocation(name=s.name, allocated_mw=0.0, capacity_mw=s.capacity_mw) for s in bid.segments],
                    unmet_mw=bid.requested_mw,
                    critical_shortfall=shortfall,
                    env_version=env_version,
                    txn_id=txn_id,
                    fallback=False,
                )
            return PipelineResult(
                allocations=allocs,
                stage_a_shortfall=sum(minimums.values()),
                stage_b_welfare=0.0,
                stage_c_lambda=0.0,
                jains_index=0.0,
                binding_constraints=["total_capacity"],
                total_allocated_mw=0.0,
                supply_mw=supply_mw,
                solve_time_ms=(time.perf_counter() - t_start) * 1000,
                status="optimal_zero_supply",
                is_fallback=False,
                summary_explanation="Zero grid supply available.",
                explanations={aid: ["Zero power available on grid."] for aid in agent_ids},
            )

        # ── Stage A: Critical Protection ─────────────────────────────────────
        res_a = solve_stage_a(bids, supply_mw, minimums, criticalities, topology=topology)
        if not res_a.success:
            logger.warning(f"Stage A failed ({res_a.status}). Triggering fallback.")
            return self._run_fallback(bids, supply_mw, env_version, minimums, criticalities, t_start)

        # ── Stage B: Damage Minimization ─────────────────────────────────────
        res_b = solve_stage_b(
            bids,
            supply_mw,
            minimums,
            stage_a_shortfall=res_a.optimal_shortfall,
            effective_values=effective_values,
            epsilon_a=self.epsilon_a,
            topology=topology,
        )
        if not res_b.success:
            logger.warning(f"Stage B failed ({res_b.status}). Using Stage A solution.")
            alloc_dict = res_a.allocations
            seg_alloc_dict = res_a.segment_allocations
            welfare = 0.0
            lambda_val = 0.0
            binding = []
        else:
            # ── Stage C: Weighted Max-Min Fairness ───────────────────────────
            res_c = solve_stage_c(
                bids,
                supply_mw,
                minimums,
                stage_a_shortfall=res_a.optimal_shortfall,
                stage_b_welfare=res_b.optimal_welfare,
                effective_values=effective_values,
                weights=weights,
                epsilon_a=self.epsilon_a,
                epsilon_b=self.epsilon_b,
                topology=topology,
            )
            if not res_c.success:
                logger.warning(f"Stage C failed ({res_c.status}). Using Stage B solution.")
                alloc_dict = res_b.allocations
                seg_alloc_dict = res_b.segment_allocations
                welfare = res_b.optimal_welfare
                lambda_val = 0.0
                binding = res_b.binding_constraints
            else:
                alloc_dict = res_c.allocations
                seg_alloc_dict = res_c.segment_allocations
                welfare = res_b.optimal_welfare
                lambda_val = res_c.lambda_fairness
                binding = res_b.binding_constraints

        # Sanitize and round allocations to 1e-4
        demand_caps = {aid: bids[aid].requested_mw for aid in agent_ids}
        rounded_allocs = AllocationValidator.sanitize_and_round(
            alloc_dict, supply_mw=supply_mw, demand_caps=demand_caps, precision=4
        )
        if NETWORK_MODEL_ENABLED and topology is not None:
            rounded_allocs = project_to_network_feasible(rounded_allocs, topology)

        # Build output AllocationResults
        txn_id = str(uuid.uuid4())
        results: dict[str, AllocationResult] = {}
        explanations: dict[str, list[str]] = {}

        for aid in agent_ids:
            bid = bids[aid]
            final_mw = rounded_allocs.get(aid, 0.0)
            unmet = max(0.0, bid.requested_mw - final_mw)
            min_mw = minimums.get(aid, 0.0)
            shortfall = max(0.0, min_mw - final_mw)

            # Distribute final_mw into segments proportionally from solver segment allocations
            raw_seg_map = seg_alloc_dict.get(aid, {})
            raw_seg_total = sum(raw_seg_map.values())
            seg_list: list[SegmentAllocation] = []

            rem_mw = final_mw
            for seg in bid.segments:
                if raw_seg_total > EPS:
                    ratio = raw_seg_map.get(seg.name, 0.0) / raw_seg_total
                    s_mw = round(final_mw * ratio, 4)
                else:
                    s_mw = min(rem_mw, seg.capacity_mw)
                    rem_mw -= s_mw
                seg_list.append(SegmentAllocation(name=seg.name, allocated_mw=s_mw, capacity_mw=seg.capacity_mw))

            results[aid] = AllocationResult(
                agent_id=aid,
                allocated_mw=final_mw,
                segments=seg_list,
                unmet_mw=unmet,
                critical_shortfall=shortfall,
                env_version=env_version,
                txn_id=txn_id,
                fallback=False,
            )

            # Generate templated explanation
            seg_alloc_floats = {s.name: s.allocated_mw for s in seg_list}
            explanations[aid] = generate_segment_explanations(
                agent_id=aid,
                bid=bid,
                allocated_mw=final_mw,
                segment_allocs=seg_alloc_floats,
                minimum_mw=min_mw,
                critical_shortfall=shortfall,
            )

        solve_time_ms = (time.perf_counter() - t_start) * 1000

        # Validate with validator
        val_res = AllocationValidator.validate_allocation(
            allocations=list(results.values()),
            bids=bids,
            supply_mw=supply_mw,
            expected_env_version=env_version,
        )

        if not val_res.valid:
            logger.error(f"Solver result violated validation invariants: {val_res.errors}")
            return self._run_fallback(bids, supply_mw, env_version, minimums, criticalities, t_start)

        summary = format_solve_explanation(
            status="OPTIMAL",
            stage_a_shortfall=res_a.optimal_shortfall,
            stage_b_welfare=welfare,
            stage_c_lambda=lambda_val,
            jains_index=val_res.capacity_slack,
            binding_constraints=binding,
            solve_time_ms=solve_time_ms,
            is_fallback=False,
        )

        return PipelineResult(
            allocations=results,
            stage_a_shortfall=res_a.optimal_shortfall,
            stage_b_welfare=welfare,
            stage_c_lambda=lambda_val,
            jains_index=val_res.capacity_slack,
            binding_constraints=binding,
            total_allocated_mw=sum(rounded_allocs.values()),
            supply_mw=supply_mw,
            solve_time_ms=solve_time_ms,
            status="optimal",
            is_fallback=False,
            summary_explanation=summary,
            explanations=explanations,
        )

    def _run_fallback(
        self,
        bids: dict[str, BidMessage],
        supply_mw: float,
        env_version: int,
        minimums: dict[str, float],
        criticalities: dict[str, float],
        t_start: float,
    ) -> PipelineResult:
        """Strict-priority fallback allocation."""
        agent_ids = sorted(
            bids.keys(),
            key=lambda a: (criticalities.get(a, 0.0), bids[a].urgency),
            reverse=True,
        )

        rem_supply = supply_mw
        results: dict[str, AllocationResult] = {}
        explanations: dict[str, list[str]] = {}
        txn_id = f"fallback-{uuid.uuid4()}"

        for aid in agent_ids:
            bid = bids[aid]
            granted = round(min(rem_supply, bid.requested_mw), 4)
            rem_supply -= granted
            shortfall = max(0.0, minimums.get(aid, 0.0) - granted)
            unmet = max(0.0, bid.requested_mw - granted)

            results[aid] = AllocationResult(
                agent_id=aid,
                allocated_mw=granted,
                segments=[SegmentAllocation(name="fallback", allocated_mw=granted, capacity_mw=bid.requested_mw)],
                unmet_mw=unmet,
                critical_shortfall=shortfall,
                env_version=env_version,
                txn_id=txn_id,
                fallback=True,
            )
            explanations[aid] = [f"FALLBACK: Allocated {granted:.2f} MW via strict priority."]

        solve_time_ms = (time.perf_counter() - t_start) * 1000

        return PipelineResult(
            allocations=results,
            stage_a_shortfall=sum(a.critical_shortfall for a in results.values()),
            stage_b_welfare=0.0,
            stage_c_lambda=0.0,
            jains_index=0.0,
            binding_constraints=["strict_priority_chain"],
            total_allocated_mw=sum(a.allocated_mw for a in results.values()),
            supply_mw=supply_mw,
            solve_time_ms=solve_time_ms,
            status="fallback_enforced",
            is_fallback=True,
            summary_explanation="Strict-priority fallback allocation applied.",
            explanations=explanations,
        )
