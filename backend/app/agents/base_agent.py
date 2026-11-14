"""
Base Agent Definition
=====================

Abstract foundation for utility agents participating in crisis negotiation.
Enforces the invariants:
- Fixed certified_max_mw and criticality (cannot be mutated by agent logic).
- Urgency derived only from verified environment observations.
- Concessions bounded by concession_limit and minimum_mw.
- Piecewise demand curves across Critical, Essential, and Flexible tiers.
"""

from __future__ import annotations

import abc
import math
import uuid
from typing import Any

from app.config import EPS, AgentProfile, DemandSegment
from app.negotiation.messages import AllocationResult, BidMessage, SegmentBid


class BaseAgent(abc.ABC):
    """Abstract agent with private state, demand modeling, and concession policy."""

    def __init__(self, profile: AgentProfile) -> None:
        # Immutable / certified parameters
        self._profile: AgentProfile = profile
        self.agent_id: str = profile.agent_id
        self.name: str = profile.name
        self.agent_type = profile.agent_type
        self.certified_max_mw: float = profile.certified_max_mw
        self.minimum_mw: float = profile.minimum_mw
        self.criticality: float = profile.criticality  # FIXED, certified
        self.concession_limit: float = profile.concession_limit

        # Dynamic state
        self.urgency: float = profile.base_urgency
        self.health: float = 1.0  # [0, 1]
        self.trust: float = 1.0   # [0.2, 1.0] cold start = 1.0
        self.credits: float = 1000.0  # virtual priority credit budget
        self.backup_mw: float = profile.backup_mw
        self.backup_hours_remaining: float = profile.backup_hours
        self.backup_active: bool = False

        # Negotiation round state
        self.current_bid_version: int = 0
        self.last_concession_step: int = -1
        self.cumulative_concession_mw: float = 0.0

        # Allocation history
        self.allocation_history: list[AllocationResult] = []

    # ── Abstract methods ──────────────────────────────────────────────────────

    @abc.abstractmethod
    def observe_environment(self, env_state: dict[str, Any]) -> None:
        """Update private state (urgency, backup, reserves) based on environment."""

    @abc.abstractmethod
    def estimate_demand(self, env_state: dict[str, Any]) -> float:
        """Estimate the agent's true power requirement D_true(t)."""

    @abc.abstractmethod
    def calculate_urgency(self, env_state: dict[str, Any]) -> float:
        """Calculate dynamic urgency based strictly on verified observations."""

    # ── Utility & Valuation ───────────────────────────────────────────────────

    def get_effective_segments(self) -> list[DemandSegment]:
        """Return demand segments scaled by current urgency and reputation trust."""
        eff_segments = []
        for s in self._profile.segments:
            # Marginal value scales with criticality, urgency, and trust score
            scaled_value = s.marginal_value * self.criticality * (1.0 + self.urgency) * self.trust
            eff_segments.append(
                DemandSegment(
                    name=s.name,
                    capacity_mw=s.capacity_mw,
                    marginal_value=scaled_value,
                )
            )
        return eff_segments

    def calculate_utility(self, allocated_mw: float) -> float:
        """Piecewise-linear welfare/utility gained from receiving allocated_mw."""
        rem = max(0.0, allocated_mw)
        total_utility = 0.0
        for seg in self.get_effective_segments():
            take = min(rem, seg.capacity_mw)
            total_utility += take * seg.marginal_value
            rem -= take
            if rem <= EPS:
                break
        return total_utility

    # ── Negotiation & Bidding ─────────────────────────────────────────────────

    def generate_bid(self, env_version: int, round_num: int = 1) -> BidMessage:
        """Generate a protocol-compliant bid message."""
        self.current_bid_version += 1

        # Calculate demand capped by certified max
        true_demand = self.estimate_demand({})
        base_demand = min(self.certified_max_mw, true_demand)

        # Apply concessions if beyond round 1
        requested_mw = max(self.minimum_mw, base_demand - self.cumulative_concession_mw)

        # Build segment bids filling requested_mw from highest marginal value to lowest
        seg_bids: list[SegmentBid] = []
        rem = requested_mw
        for seg in self.get_effective_segments():
            alloc = min(rem, seg.capacity_mw)
            seg_bids.append(
                SegmentBid(
                    name=seg.name,
                    capacity_mw=seg.capacity_mw,
                    marginal_value=seg.marginal_value,
                    requested_mw=alloc,
                )
            )
            rem -= alloc

        reason = (
            f"{self.name} bidding {requested_mw:.1f} MW (urgency={self.urgency:.2f}, "
            f"concession={self.cumulative_concession_mw:.1f} MW)"
        )

        return BidMessage(
            bid_id=str(uuid.uuid4()),
            agent_id=self.agent_id,
            env_version=env_version,
            bid_version=self.current_bid_version,
            requested_mw=round(requested_mw, 4),
            min_acceptable_mw=self.minimum_mw,
            segments=seg_bids,
            criticality=self.criticality,
            urgency=round(min(1.0, max(0.0, self.urgency)), 4),
            max_concession=self.concession_limit,
            reason=reason,
        )

    def evaluate_proposal(self, proposed_mw: float) -> bool:
        """Decide whether to accept or counter an allocation proposal."""
        return proposed_mw >= self.minimum_mw - EPS

    def make_concession(self, round_num: int, shortage_mw: float) -> float:
        """Calculate concession amount for this round, bounded by concession_limit."""
        max_allowable_concession = self.certified_max_mw * self.concession_limit
        room = max_allowable_concession - self.cumulative_concession_mw
        if room <= EPS:
            return 0.0

        # Concession pace inversely proportional to criticality and urgency
        reluctance = self.criticality * (1.0 + self.urgency)
        step_fraction = max(0.05, min(0.35, 0.25 / reluctance))

        concession = min(room, shortage_mw * step_fraction)
        # Ensure we never concede below minimum
        true_d = self.estimate_demand({})
        if (true_d - (self.cumulative_concession_mw + concession)) < self.minimum_mw:
            concession = max(0.0, true_d - self.cumulative_concession_mw - self.minimum_mw)

        self.cumulative_concession_mw += concession
        self.last_concession_step = round_num
        return concession

    def reset_negotiation_round(self) -> None:
        """Reset intra-step concession state for a new simulation step."""
        self.cumulative_concession_mw = 0.0
        self.last_concession_step = -1

    # ── Execution & Health ────────────────────────────────────────────────────

    def receive_allocation(self, allocation: AllocationResult) -> None:
        """Record committed allocation and update health."""
        self.allocation_history.append(allocation)
        self.update_health(allocation.allocated_mw)

    def update_health(self, received_mw: float, service_level: float | None = None) -> None:
        """Update agent operational health based on allocated power and service level."""
        true_d = self.estimate_demand({})
        ratio = min(1.0, received_mw / max(true_d, EPS))
        if service_level is not None:
            ratio = min(ratio, service_level)

        # Health responds smoothly with recovery or degradation
        alpha = 0.4
        self.health = round(max(0.0, min(1.0, (1.0 - alpha) * self.health + alpha * ratio)), 4)

    def report_state(self) -> dict[str, Any]:
        """Export agent status dictionary for telemetry and dashboard."""
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "agent_type": self.agent_type.value if hasattr(self.agent_type, "value") else str(self.agent_type),
            "criticality": self.criticality,
            "urgency": self.urgency,
            "health": self.health,
            "trust": self.trust,
            "credits": self.credits,
            "minimum_mw": self.minimum_mw,
            "certified_max_mw": self.certified_max_mw,
            "backup_active": self.backup_active,
            "backup_hours_remaining": self.backup_hours_remaining,
            "last_allocation": (
                self.allocation_history[-1].allocated_mw if self.allocation_history else None
            ),
        }
