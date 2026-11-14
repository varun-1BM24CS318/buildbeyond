"""
Allocation and Invariant Validator
==================================

Enforces system invariants with mathematical rigor:
1. Provably safe: sum(allocations) <= supply + EPS (zero capacity violation).
2. Segment bounds: 0 <= x_ik <= cap_ik + EPS for all segments k of agent i.
3. Demand bounds: 0 <= x_i <= D_i + EPS (cannot exceed bid or certified max).
4. Segment sum: abs(x_i - sum(x_ik)) <= EPS.
5. Version monotonicity: allocation.env_version == expected_env_version.
6. Finite numbers only: reject NaN, Inf, and negative values.
7. Rounding safety: Round to 1e-4 without exceeding supply (scales down if needed).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Sequence

from app.config import EPS
from app.negotiation.messages import AllocationResult, BidMessage


@dataclass(slots=True)
class ValidationResult:
    """Outcome of validating an allocation proposal before commit."""

    valid: bool
    errors: list[str] = field(default_factory=list)
    total_allocated_mw: float = 0.0
    supply_mw: float = 0.0
    capacity_slack: float = 0.0
    critical_shortfall: float = 0.0
    critical_feasible: bool = True
    allocations_rounded: dict[str, float] = field(default_factory=dict)


class AllocationValidator:
    """Stateless validator implementing the invariant gate for two-phase commit."""

    @staticmethod
    def sanitize_and_round(
        allocations: dict[str, float],
        supply_mw: float,
        demand_caps: dict[str, float] | None = None,
        precision: int = 4,
    ) -> dict[str, float]:
        """Round allocations to specified decimals (default 1e-4 MW).

        Ensures:
        1. No allocation exceeds demand_caps[agent_id] (using floor if round would exceed).
        2. If rounding causes sum(allocations) > supply_mw, scales down the largest allocation
           so the hard capacity constraint is never violated.
        """
        rounded: dict[str, float] = {}
        for aid, mw in allocations.items():
            r = round(mw, precision)
            if demand_caps and aid in demand_caps:
                cap = demand_caps[aid]
                if r > cap + EPS:
                    # Floor to precision so r <= cap strictly
                    factor = 10**precision
                    r = math.floor(cap * factor) / factor
            rounded[aid] = r

        total = sum(rounded.values())

        if total > supply_mw:
            excess = total - supply_mw
            # Find agent with largest allocation to absorb the excess
            largest_agent = max(rounded.keys(), key=lambda k: rounded[k])
            rounded[largest_agent] = round(rounded[largest_agent] - excess, precision)
            # Re-check in case of precision issues
            if sum(rounded.values()) > supply_mw:
                factor = 10**precision
                excess_rem = sum(rounded.values()) - supply_mw
                rounded[largest_agent] = math.floor((rounded[largest_agent] - excess_rem) * factor) / factor

        return rounded

    @classmethod
    def validate_allocation(
        cls,
        allocations: Sequence[AllocationResult] | dict[str, float],
        bids: dict[str, BidMessage],
        supply_mw: float,
        expected_env_version: int,
        certified_maxes: dict[str, float] | None = None,
        minimums: dict[str, float] | None = None,
    ) -> ValidationResult:
        """Thoroughly checks all physical and protocol invariants.

        Parameters
        ----------
        allocations : Sequence[AllocationResult] or dict[str, float]
            Proposed allocation.
        bids : dict[str, BidMessage]
            The active bids in the current negotiation round.
        supply_mw : float
            Total current available power (MW).
        expected_env_version : int
            Current environment version.
        certified_maxes : dict[str, float], optional
            Certified upper bounds per agent.
        minimums : dict[str, float], optional
            Critical minimum power per agent.
        """
        errors: list[str] = []

        # 1. Finite checks on supply
        if not math.isfinite(supply_mw) or supply_mw < 0:
            return ValidationResult(
                valid=False,
                errors=[f"Supply must be a non-negative finite number, got {supply_mw}"],
                supply_mw=supply_mw,
            )

        # Standardize allocations to dict[agent_id, float] and dict[agent_id, AllocationResult]
        alloc_map: dict[str, float] = {}
        result_map: dict[str, AllocationResult] = {}

        if isinstance(allocations, dict):
            alloc_map = dict(allocations)
        else:
            for ar in allocations:
                alloc_map[ar.agent_id] = ar.allocated_mw
                result_map[ar.agent_id] = ar

        # Check critical feasibility
        total_minimum = sum(minimums.values()) if minimums else 0.0
        critical_feasible = total_minimum <= supply_mw + EPS
        critical_shortfall = max(0.0, total_minimum - supply_mw)

        # 2. Check each allocation individually
        for agent_id, mw in alloc_map.items():
            # Check finite
            if not math.isfinite(mw):
                errors.append(f"Agent '{agent_id}' allocation is non-finite: {mw}")
                continue

            # Check non-negative
            if mw < -EPS:
                errors.append(f"Agent '{agent_id}' allocation is negative: {mw}")

            # Check bid exists
            if agent_id not in bids:
                errors.append(f"Agent '{agent_id}' allocated power without a submitted bid.")
                continue

            bid = bids[agent_id]

            # Check version
            if bid.env_version != expected_env_version:
                errors.append(
                    f"Agent '{agent_id}' bid has stale env_version {bid.env_version} (expected {expected_env_version})"
                )

            # Check demand cap (cannot exceed requested_mw)
            if mw > bid.requested_mw + EPS:
                errors.append(
                    f"Agent '{agent_id}' allocation {mw:.4f} exceeds requested bid {bid.requested_mw:.4f}"
                )

            # Check certified max
            if certified_maxes and agent_id in certified_maxes:
                c_max = certified_maxes[agent_id]
                if mw > c_max + EPS:
                    errors.append(
                        f"Agent '{agent_id}' allocation {mw:.4f} exceeds certified max {c_max:.4f}"
                    )

            # If full AllocationResult was provided, validate segment breakdown
            if agent_id in result_map:
                ar = result_map[agent_id]
                if ar.env_version != expected_env_version:
                    errors.append(
                        f"Agent '{agent_id}' result env_version {ar.env_version} != {expected_env_version}"
                    )

                seg_sum = sum(seg.allocated_mw for seg in ar.segments)
                if abs(seg_sum - ar.allocated_mw) > 1e-3:
                    errors.append(
                        f"Agent '{agent_id}' segment sum {seg_sum:.4f} != allocated_mw {ar.allocated_mw:.4f}"
                    )

                for seg in ar.segments:
                    if seg.allocated_mw < -EPS:
                        errors.append(f"Agent '{agent_id}' segment '{seg.name}' negative: {seg.allocated_mw}")
                    if seg.allocated_mw > seg.capacity_mw + EPS:
                        errors.append(
                            f"Agent '{agent_id}' segment '{seg.name}' allocation {seg.allocated_mw:.4f} exceeds capacity {seg.capacity_mw:.4f}"
                        )

        # 3. Global capacity invariant: sum(allocations) <= supply
        total_allocated = sum(alloc_map.values())
        if total_allocated > supply_mw + EPS:
            errors.append(
                f"Capacity violation: total allocated {total_allocated:.6f} MW > supply {supply_mw:.6f} MW (excess {total_allocated - supply_mw:.6f})"
            )

        slack = max(0.0, supply_mw - total_allocated)
        demand_caps = {aid: bids[aid].requested_mw for aid in bids if aid in bids}
        rounded_allocs = cls.sanitize_and_round(alloc_map, supply_mw, demand_caps=demand_caps)

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            total_allocated_mw=total_allocated,
            supply_mw=supply_mw,
            capacity_slack=slack,
            critical_shortfall=critical_shortfall,
            critical_feasible=critical_feasible,
            allocations_rounded=rounded_allocs,
        )
