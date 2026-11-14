"""
Agent Registry and Lifecycle Factory
====================================

Manages instantiated agents and supports dynamic mode switching (honest <-> cheater).
Enforces:
- Exactly one cheater at a time.
- Arming is idempotent.
- True physical demand is decoupled from strategic bids.
"""

from __future__ import annotations

from typing import Dict

from app.agents.base_agent import BaseAgent
from app.agents.cheater import CheaterAgent
from app.agents.honest import (
    EmergencyAgent,
    HospitalAgent,
    ResidentialAgent,
    TelecomAgent,
    WaterAgent,
)
from app.config import DEFAULT_PROFILES, AgentProfile


def create_agent(profile: AgentProfile) -> BaseAgent:
    """Instantiate the concrete honest agent class for a given profile."""
    aid = profile.agent_id.lower()
    if "hospital" in aid:
        return HospitalAgent(profile)
    elif "water" in aid:
        return WaterAgent(profile)
    elif "emergency" in aid:
        return EmergencyAgent(profile)
    elif "telecom" in aid:
        return TelecomAgent(profile)
    elif "residential" in aid:
        return ResidentialAgent(profile)
    else:
        return HospitalAgent(profile)


class AgentRegistry:
    """Central registry tracking active agents in the crisis simulation."""

    def __init__(self, profiles: dict[str, AgentProfile] | None = None) -> None:
        self.profiles = profiles or DEFAULT_PROFILES
        self._agents: dict[str, BaseAgent] = {}
        self._cheater_modes: dict[str, bool] = {}
        self.initialize_agents()

    def initialize_agents(self) -> None:
        """Create fresh agents from configured profiles."""
        self._agents.clear()
        for agent_id, profile in self.profiles.items():
            self._agents[agent_id] = create_agent(profile)
            self._cheater_modes[agent_id] = False

    def get(self, agent_id: str) -> BaseAgent | None:
        return self._agents.get(agent_id)

    def get_all(self) -> dict[str, BaseAgent]:
        return dict(self._agents)

    def set_agent(self, agent_id: str, agent: BaseAgent) -> None:
        self._agents[agent_id] = agent

    def is_cheater(self, agent_id: str) -> bool:
        return self._cheater_modes.get(agent_id, False)

    def set_cheater_mode(self, agent_id: str, is_cheater: bool) -> bool:
        """Arm or disarm an agent as the strategic cheater.
        
        Enforces:
        - Exactly one cheater at a time; arming one disarms all others.
        - Idempotency: re-arming does not change state or compound inflation.
        """
        aid = agent_id.lower()
        if aid not in self.profiles:
            return False

        # If already in the target state for this agent and no other is armed, no-op
        currently_cheating = self._cheater_modes.get(aid, False)
        other_cheaters = [a for a, ch in self._cheater_modes.items() if ch and a != aid]

        if currently_cheating == is_cheater and not other_cheaters:
            return True

        # Disarm all agents first
        for curr_id in list(self.profiles.keys()):
            self._cheater_modes[curr_id] = False
            self._agents[curr_id] = create_agent(self.profiles[curr_id])

        # Arm the designated cheater if requested
        if is_cheater:
            self._cheater_modes[aid] = True
            honest = create_agent(self.profiles[aid])
            self._agents[aid] = CheaterAgent(
                self.profiles[aid],
                inflation_factor=1.8,
                honest_delegate=honest,
            )

        return True

    def reset(self) -> None:
        self.initialize_agents()
