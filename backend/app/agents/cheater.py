"""
Strategic / Cheater Agent (W2)
==============================

Simulates self-interested, strategic misreporting during grid scarcity:
- Inflates reported demand: D_rep = min(certified_max, factor * D_true).
- Inflates flexible segment marginal values to crowd out peer utilities.
- Switchable dynamically at runtime via the 'cheater toggle' in the dashboard.
"""

from __future__ import annotations

from typing import Any

from app.agents.base_agent import BaseAgent
from app.config import AgentProfile, DemandSegment
from app.negotiation.messages import BidMessage, SegmentBid


class CheaterAgent(BaseAgent):
    """Strategic agent that opportunistically inflates bids during scarcity."""

    def __init__(
        self,
        profile: AgentProfile,
        inflation_factor: float = 1.8,
        start_step: int = 1,
        inflate_values: bool = True,
    ) -> None:
        super().__init__(profile)
        self.inflation_factor: float = inflation_factor
        self.start_step: int = start_step
        self.inflate_values: bool = inflate_values
        self.is_cheating_active: bool = True

    def observe_environment(self, env_state: dict[str, Any]) -> None:
        step = env_state.get("step", 1)
        self.is_cheating_active = step >= self.start_step
        self.urgency = self.calculate_urgency(env_state)

    def calculate_urgency(self, env_state: dict[str, Any]) -> float:
        base = self._profile.base_urgency
        severity = env_state.get("severity", 0.0)
        # Strategic urgency inflation if active
        boost = 0.3 if self.is_cheating_active else 0.0
        return min(1.0, base + boost + 0.2 * severity)

    def estimate_demand(self, env_state: dict[str, Any]) -> float:
        """Private true need D_true_i(t) without inflation."""
        return min(self.certified_max_mw, self.minimum_mw + 15.0)

    def generate_bid(self, env_version: int, round_num: int = 1) -> BidMessage:
        """Generate bid with strategic demand and value inflation if active."""
        self.current_bid_version += 1
        d_true = self.estimate_demand({})

        if self.is_cheating_active:
            # Inflate demand up to certified max
            d_rep = min(self.certified_max_mw, d_true * self.inflation_factor)
            reason = f"STRATEGIC MISREPORT: Inflated demand by {self.inflation_factor:.1f}x ({d_rep:.1f} MW vs true {d_true:.1f} MW)"
        else:
            d_rep = d_true
            reason = f"Honest reporting ({d_rep:.1f} MW)"

        # Concessions apply to reported demand
        requested_mw = max(self.minimum_mw, d_rep - self.cumulative_concession_mw)

        # Inflate flexible segment marginal values if active
        seg_bids: list[SegmentBid] = []
        rem = requested_mw
        for seg in self._profile.segments:
            alloc = min(rem, seg.capacity_mw)
            val = seg.marginal_value * self.criticality * (1.0 + self.urgency) * self.trust
            if self.is_cheating_active and self.inflate_values and "flexible" in seg.name.lower():
                val *= 2.5  # Strategic value inflation
            seg_bids.append(
                SegmentBid(
                    name=seg.name,
                    capacity_mw=seg.capacity_mw,
                    marginal_value=round(val, 2),
                    requested_mw=round(alloc, 4),
                )
            )
            rem -= alloc

        return BidMessage(
            bid_id=f"bid-cheater-{self.current_bid_version}",
            agent_id=self.agent_id,
            env_version=env_version,
            bid_version=self.current_bid_version,
            requested_mw=round(requested_mw, 4),
            min_acceptable_mw=self.minimum_mw,
            segments=seg_bids,
            criticality=self.criticality,
            urgency=round(self.urgency, 4),
            max_concession=self.concession_limit,
            reason=reason,
        )
