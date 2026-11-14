"""
Allocation Baseline Strategies
==============================

Implements non-negotiated baseline allocation heuristics for comparative evaluation:
1. Fixed proportional allocation.
2. Static strict-priority allocation.
All baselines run under identical seeded scenarios and identical grid constraints.
"""

from __future__ import annotations

from app.config import EPS, NETWORK_MODEL_ENABLED
from app.negotiation.messages import AllocationResult, BidMessage, SegmentAllocation
from app.network.constraints import project_to_network_feasible
from app.network.topology import NetworkTopology
from app.optimization.validator import AllocationValidator


class ProportionalBaseline:
    """Fixed proportional allocation: slices power strictly in proportion to demand."""

    @staticmethod
    def allocate(
        bids: dict[str, BidMessage],
        supply_mw: float,
        env_version: int,
        topology: NetworkTopology | None = None,
    ) -> dict[str, AllocationResult]:
        total_requested = sum(b.requested_mw for b in bids.values())
        scale = min(1.0, supply_mw / max(total_requested, EPS))

        allocs: dict[str, float] = {}
        for aid, bid in bids.items():
            allocs[aid] = bid.requested_mw * scale

        # Round and sanitize
        demand_caps = {aid: bids[aid].requested_mw for aid in bids}
        rounded = AllocationValidator.sanitize_and_round(
            allocs, supply_mw=supply_mw, demand_caps=demand_caps, precision=4
        )
        if NETWORK_MODEL_ENABLED and topology is not None:
            rounded = project_to_network_feasible(rounded, topology)

        results: dict[str, AllocationResult] = {}
        for aid, bid in bids.items():
            mw = rounded.get(aid, 0.0)
            shortfall = max(0.0, bid.min_acceptable_mw - mw)
            results[aid] = AllocationResult(
                agent_id=aid,
                allocated_mw=mw,
                segments=[SegmentAllocation(name="proportional", allocated_mw=mw, capacity_mw=bid.requested_mw)],
                unmet_mw=max(0.0, bid.requested_mw - mw),
                critical_shortfall=shortfall,
                env_version=env_version,
                txn_id=f"prop-{aid}",
                fallback=False,
            )
        return results


class StrictPriorityBaseline:
    """Static strict-priority allocation: allocates greedily by fixed agent criticality."""

    @staticmethod
    def allocate(
        bids: dict[str, BidMessage],
        supply_mw: float,
        env_version: int,
        criticalities: dict[str, float] | None = None,
        topology: NetworkTopology | None = None,
    ) -> dict[str, AllocationResult]:
        crits = criticalities or {aid: b.criticality for aid, b in bids.items()}
        sorted_aids = sorted(bids.keys(), key=lambda a: crits.get(a, 0.0), reverse=True)

        rem_supply = supply_mw
        allocs: dict[str, float] = {}

        for aid in sorted_aids:
            bid = bids[aid]
            granted = min(rem_supply, bid.requested_mw)
            allocs[aid] = granted
            rem_supply -= granted

        demand_caps = {aid: bids[aid].requested_mw for aid in bids}
        rounded = AllocationValidator.sanitize_and_round(
            allocs, supply_mw=supply_mw, demand_caps=demand_caps, precision=4
        )
        if NETWORK_MODEL_ENABLED and topology is not None:
            rounded = project_to_network_feasible(rounded, topology)

        results: dict[str, AllocationResult] = {}
        for aid in sorted_aids:
            bid = bids[aid]
            mw = rounded.get(aid, 0.0)
            shortfall = max(0.0, bid.min_acceptable_mw - mw)
            results[aid] = AllocationResult(
                agent_id=aid,
                allocated_mw=mw,
                segments=[SegmentAllocation(name="priority", allocated_mw=mw, capacity_mw=bid.requested_mw)],
                unmet_mw=max(0.0, bid.requested_mw - mw),
                critical_shortfall=shortfall,
                env_version=env_version,
                txn_id=f"prio-{aid}",
                fallback=False,
            )
        return results
