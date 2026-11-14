"""
Honest Utility Agents Implementation
====================================

Implements the five core utility agents with differentiated, domain-faithful behavior:
1. Hospital: High resistance to concessions, urgency spikes when generator/backup fails.
2. Water: Urgency inversely tracks reservoir level; essential for public sanitation.
3. Emergency: Urgency directly tracks disaster severity and 911 dispatch surge.
4. Telecom: Sheds flexible broadband capacity quickly to preserve voice/tactical comms.
5. Residential: High flexibility; concessions from comfort load while preserving base survival.
"""

from __future__ import annotations

from typing import Any

from app.agents.base_agent import BaseAgent
from app.config import AgentProfile


class HospitalAgent(BaseAgent):
    """General Hospital: Highest priority, zero tolerance for critical deficit."""

    def __init__(self, profile: AgentProfile) -> None:
        super().__init__(profile)
        self.generator_failed: bool = False

    def observe_environment(self, env_state: dict[str, Any]) -> None:
        grid_health = env_state.get("grid_health", 1.0)
        severity = env_state.get("severity", 0.0)

        # Hospital generator failure event
        if env_state.get("hospital_generator_failure", False):
            self.generator_failed = True
            self.backup_hours_remaining = 0.0

        self.urgency = self.calculate_urgency(env_state)

    def calculate_urgency(self, env_state: dict[str, Any]) -> float:
        base = self._profile.base_urgency
        severity = env_state.get("severity", 0.0)
        # Urgency jumps if backup generator is broken or depleted
        generator_penalty = 0.35 if self.generator_failed or self.backup_hours_remaining <= 0.5 else 0.0
        return min(1.0, base + 0.3 * severity + generator_penalty)

    def estimate_demand(self, env_state: dict[str, Any]) -> float:
        # Emergency patient surge increases ICU demand
        severity = env_state.get("severity", 0.0)
        surge = 4.0 * severity
        return min(self.certified_max_mw, self.minimum_mw + 10.0 + surge)


class WaterAgent(BaseAgent):
    """Water Treatment & Pumping: Urgency scales as water reserve depletes."""

    def __init__(self, profile: AgentProfile) -> None:
        super().__init__(profile)
        self.water_reserve_pct: float = 1.0  # 100% full initially

    def observe_environment(self, env_state: dict[str, Any]) -> None:
        if "water_reserve" in env_state:
            self.water_reserve_pct = max(0.0, min(1.0, env_state["water_reserve"]))
        self.urgency = self.calculate_urgency(env_state)

    def calculate_urgency(self, env_state: dict[str, Any]) -> float:
        base = self._profile.base_urgency
        # Lower reserve -> Higher urgency (critical pressure must be maintained)
        depletion_factor = (1.0 - self.water_reserve_pct) * 0.4
        return min(1.0, base + depletion_factor)

    def estimate_demand(self, env_state: dict[str, Any]) -> float:
        # When reserve is low, pump demand is high to refill
        fill_need = (1.0 - self.water_reserve_pct) * 5.0
        return min(self.certified_max_mw, self.minimum_mw + 8.0 + fill_need)


class EmergencyAgent(BaseAgent):
    """Emergency Services HQ: First responders whose load scales with disaster severity."""

    def observe_environment(self, env_state: dict[str, Any]) -> None:
        self.urgency = self.calculate_urgency(env_state)

    def calculate_urgency(self, env_state: dict[str, Any]) -> float:
        severity = env_state.get("severity", 0.0)
        base = self._profile.base_urgency
        return min(1.0, base + 0.5 * severity)

    def estimate_demand(self, env_state: dict[str, Any]) -> float:
        severity = env_state.get("severity", 0.0)
        # Tactical comms and charging surge during severe crisis
        dispatch_surge = 5.0 * severity
        return min(self.certified_max_mw, self.minimum_mw + 5.0 + dispatch_surge)


class TelecomAgent(BaseAgent):
    """Telecom Network: Highly capable of shedding flexible bandwidth to preserve 911 trunk."""

    def observe_environment(self, env_state: dict[str, Any]) -> None:
        self.urgency = self.calculate_urgency(env_state)

    def calculate_urgency(self, env_state: dict[str, Any]) -> float:
        severity = env_state.get("severity", 0.0)
        telecom_degraded = env_state.get("telecom_degrade", False)
        base = self._profile.base_urgency
        boost = 0.25 if telecom_degraded else 0.1 * severity
        return min(1.0, base + boost)

    def estimate_demand(self, env_state: dict[str, Any]) -> float:
        severity = env_state.get("severity", 0.0)
        # Moderate baseline, slight increase under disaster
        return min(self.certified_max_mw, self.minimum_mw + 5.0 + 2.0 * severity)


class ResidentialAgent(BaseAgent):
    """Residential District: Largest non-critical consumer; makes concessions graciously."""

    def observe_environment(self, env_state: dict[str, Any]) -> None:
        self.urgency = self.calculate_urgency(env_state)

    def calculate_urgency(self, env_state: dict[str, Any]) -> float:
        severity = env_state.get("severity", 0.0)
        # Residential stays modest even during crisis to let hospitals get power
        return min(0.7, self._profile.base_urgency + 0.15 * severity)

    def estimate_demand(self, env_state: dict[str, Any]) -> float:
        # Standard domestic load
        return min(self.certified_max_mw, self.minimum_mw + 20.0)
