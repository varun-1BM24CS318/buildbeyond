"""
Crisis Resource Allocation — Central Configuration
====================================================

All constants, enums, dataclasses, and default profiles live here so every
other module imports from a single source of truth.

Numeric constants are documented inline.  Pydantic BaseModel is used for
serializable configs; ``dataclasses.dataclass`` for internal-only structs.
"""

from __future__ import annotations

import enum
import os
from dataclasses import dataclass, field
from typing import Final

from pydantic import BaseModel, Field

# ──────────────────────────────────────────────────────────────────────
# Feature Flags (default ON, configurable via environment)
# ──────────────────────────────────────────────────────────────────────

VERIFICATION_ENABLED: bool = os.getenv("VERIFICATION_ENABLED", "true").lower() in ("true", "1", "yes")
NETWORK_MODEL_ENABLED: bool = os.getenv("NETWORK_MODEL_ENABLED", "true").lower() in ("true", "1", "yes")
ADVANCED_VCG_ENABLED: bool = os.getenv("ADVANCED_VCG_ENABLED", "true").lower() in ("true", "1", "yes")

# ──────────────────────────────────────────────────────────────────────
# Global numeric constants
# ──────────────────────────────────────────────────────────────────────

EPS: Final[float] = 1e-6
"""Floating-point tolerance used across comparisons and convergence checks."""

MAX_ROUNDS: Final[int] = 6
"""Maximum negotiation rounds before forced resolution."""

MAX_AGENTS: Final[int] = 50
"""Hard cap on the number of agents the system supports concurrently."""

MAX_HORIZON: Final[int] = 48
"""Planning horizon in discrete time-steps (typically half-hours → 24 h)."""

SOLVER_TIME_LIMIT: Final[float] = 2.0
"""Wall-clock seconds allowed for a single optimisation solve call."""

DEFAULT_SUPPLY_MW: Final[float] = 80.0
"""Total available grid capacity in megawatts under normal conditions."""


# ──────────────────────────────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────────────────────────────

class AgentType(str, enum.Enum):
    """Categories of infrastructure agents in the crisis model."""

    HOSPITAL = "Hospital"
    WATER = "Water"
    EMERGENCY = "Emergency"
    TELECOM = "Telecom"
    RESIDENTIAL = "Residential"


class Criticality(str, enum.Enum):
    """Qualitative criticality tiers (agent-level priority label)."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Scenario(str, enum.Enum):
    """Pre-defined crisis scenarios the simulation can run."""

    NORMAL = "normal"
    EARTHQUAKE = "earthquake"
    FLOOD = "flood"
    BLACKOUT = "blackout"
    CYBER_ATTACK = "cyber_attack"


class EventType(str, enum.Enum):
    """Discrete events that can occur during a simulation step."""

    SUPPLY_DROP = "SUPPLY_DROP"
    SUPPLY_RESTORE = "SUPPLY_RESTORE"
    BACKUP_FAIL = "BACKUP_FAIL"
    DEMAND_SURGE = "DEMAND_SURGE"
    WATER_RESERVE_DROP = "WATER_RESERVE_DROP"
    TELECOM_DEGRADE = "TELECOM_DEGRADE"
    AGENT_FAIL = "AGENT_FAIL"
    AGENT_RECOVER = "AGENT_RECOVER"
    LINE_DERATE = "LINE_DERATE"
    LINE_RESTORE = "LINE_RESTORE"


class NegotiationState(str, enum.Enum):
    """Finite-state labels for an agent's negotiation lifecycle."""

    IDLE = "idle"
    PROPOSING = "proposing"
    EVALUATING = "evaluating"
    CONCEDING = "conceding"
    AGREED = "agreed"
    FAILED = "failed"


# ──────────────────────────────────────────────────────────────────────
# Internal dataclasses (not serialised over the wire)
# ──────────────────────────────────────────────────────────────────────

@dataclass(frozen=True, slots=True)
class DemandSegment:
    """A single step in an agent's piecewise-linear demand curve.

    Attributes
    ----------
    name:
        Human-readable label for the segment (e.g. "life-support").
    capacity_mw:
        Maximum load this segment can absorb (MW).
    marginal_value:
        $/MWh willingness-to-pay for power in this segment.
    """

    name: str
    capacity_mw: float
    marginal_value: float


@dataclass(slots=True)
class AgentProfile:
    """Static profile describing an infrastructure agent.

    Attributes
    ----------
    agent_id:
        Unique identifier string.
    name:
        Human-readable display name.
    agent_type:
        Category of the agent.
    certified_max_mw:
        Maximum power the agent is certified to draw (MW).
    minimum_mw:
        Hard minimum power required to avoid failure (MW).
    criticality:
        Fixed priority weight in [0, 1]; 1.0 = most critical.
    base_urgency:
        Starting urgency multiplier for negotiation bidding.
    backup_mw:
        On-site backup generation capacity (MW).
    backup_hours:
        Duration backup can sustain at *backup_mw* (hours).
    concession_limit:
        Fraction [0, 1] of demand the agent will concede at most.
    segments:
        Ordered demand segments (highest-value first).
    """

    agent_id: str
    name: str
    agent_type: AgentType
    certified_max_mw: float
    minimum_mw: float
    criticality: float  # fixed in [0, 1]
    base_urgency: float
    backup_mw: float
    backup_hours: float
    concession_limit: float
    segments: list[DemandSegment] = field(default_factory=list)


# ──────────────────────────────────────────────────────────────────────
# Dependency graph
# ──────────────────────────────────────────────────────────────────────

class DependencyEdge(BaseModel):
    """A directed dependency between two agent types.

    ``provider`` supplies a service that ``consumer`` relies on.
    ``kappa`` ∈ (0, 1] quantifies coupling strength: when the provider is
    under-served, the consumer's effective demand scales by (1 − κ·deficit%).
    """

    provider: AgentType
    consumer: AgentType
    kappa: float = Field(
        ...,
        gt=0.0,
        le=1.0,
        description="Coupling coefficient κ — fraction of demand impact.",
    )


DEFAULT_DEPENDENCIES: list[DependencyEdge] = [
    DependencyEdge(provider=AgentType.WATER, consumer=AgentType.HOSPITAL, kappa=0.4),
    DependencyEdge(provider=AgentType.TELECOM, consumer=AgentType.EMERGENCY, kappa=0.3),
    DependencyEdge(provider=AgentType.WATER, consumer=AgentType.RESIDENTIAL, kappa=0.2),
    DependencyEdge(provider=AgentType.TELECOM, consumer=AgentType.HOSPITAL, kappa=0.1),
]
"""Inter-agent dependency edges used when no custom topology is supplied."""


# ──────────────────────────────────────────────────────────────────────
# Default agent profiles
# ──────────────────────────────────────────────────────────────────────

DEFAULT_PROFILES: dict[str, AgentProfile] = {
    "hospital": AgentProfile(
        agent_id="hospital",
        name="City Hospital",
        agent_type=AgentType.HOSPITAL,
        certified_max_mw=25.0,
        minimum_mw=8.0,
        criticality=1.0,
        base_urgency=0.6,
        backup_mw=5.0,
        backup_hours=4.0,
        concession_limit=0.15,
        segments=[
            DemandSegment(name="life-support", capacity_mw=8.0, marginal_value=500.0),
            DemandSegment(name="surgical", capacity_mw=10.0, marginal_value=300.0),
            DemandSegment(name="non-critical", capacity_mw=7.0, marginal_value=80.0),
        ],
    ),
    "water": AgentProfile(
        agent_id="water",
        name="Water Treatment Plant",
        agent_type=AgentType.WATER,
        certified_max_mw=20.0,
        minimum_mw=5.0,
        criticality=0.9,
        base_urgency=0.45,
        backup_mw=3.0,
        backup_hours=6.0,
        concession_limit=0.2,
        segments=[
            DemandSegment(name="filtration", capacity_mw=5.0, marginal_value=400.0),
            DemandSegment(name="pumping", capacity_mw=10.0, marginal_value=200.0),
            DemandSegment(name="reserve-fill", capacity_mw=5.0, marginal_value=60.0),
        ],
    ),
    "emergency": AgentProfile(
        agent_id="emergency",
        name="Emergency Services HQ",
        agent_type=AgentType.EMERGENCY,
        certified_max_mw=15.0,
        minimum_mw=4.0,
        criticality=0.95,
        base_urgency=0.40,
        backup_mw=4.0,
        backup_hours=3.0,
        concession_limit=0.18,
        segments=[
            DemandSegment(name="dispatch", capacity_mw=4.0, marginal_value=450.0),
            DemandSegment(name="comms", capacity_mw=6.0, marginal_value=250.0),
            DemandSegment(name="facilities", capacity_mw=5.0, marginal_value=70.0),
        ],
    ),
    "telecom": AgentProfile(
        agent_id="telecom",
        name="Telecom Central Office",
        agent_type=AgentType.TELECOM,
        certified_max_mw=12.0,
        minimum_mw=3.0,
        criticality=0.7,
        base_urgency=0.35,
        backup_mw=2.0,
        backup_hours=8.0,
        concession_limit=0.25,
        segments=[
            DemandSegment(name="core-switching", capacity_mw=3.0, marginal_value=350.0),
            DemandSegment(name="cell-towers", capacity_mw=6.0, marginal_value=180.0),
            DemandSegment(name="data-centres", capacity_mw=3.0, marginal_value=90.0),
        ],
    ),
    "residential": AgentProfile(
        agent_id="residential",
        name="Residential District",
        agent_type=AgentType.RESIDENTIAL,
        certified_max_mw=30.0,
        minimum_mw=2.0,
        criticality=0.5,
        base_urgency=0.25,
        backup_mw=0.0,
        backup_hours=0.0,
        concession_limit=0.4,
        segments=[
            DemandSegment(name="essential", capacity_mw=2.0, marginal_value=200.0),
            DemandSegment(name="heating-cooling", capacity_mw=15.0, marginal_value=100.0),
            DemandSegment(name="general", capacity_mw=13.0, marginal_value=40.0),
        ],
    ),
}
"""Baseline agent profiles used when no custom configuration is loaded."""
