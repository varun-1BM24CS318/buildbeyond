"""
Agent Registry and Lifecycle Factory
====================================

Manages instantiated agents and supports dynamic mode switching (honest <-> cheater).
"""

from __future__ import annotations

from typing import Dict

from app.agents.base_agent import BaseAgent
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
        if agent_id not in self._agents:
            return False
        self._cheater_modes[agent_id] = is_cheater
        return True

    def reset(self) -> None:
        self.initialize_agents()
