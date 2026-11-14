"""Pydantic v2 message models for the negotiation subsystem."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


# ------------------------------------------------------------------
# Segment-level models
# ------------------------------------------------------------------


class SegmentBid(BaseModel):
    """A bid for a single demand segment."""

    name: str
    capacity_mw: float = Field(ge=0)
    marginal_value: float = Field(ge=0)
    requested_mw: float = Field(ge=0)


class SegmentAllocation(BaseModel):
    """Allocation result for a single demand segment."""

    name: str
    allocated_mw: float
    capacity_mw: float


# ------------------------------------------------------------------
# Top-level negotiation messages
# ------------------------------------------------------------------


class BidMessage(BaseModel):
    """A bid submitted by an agent during a negotiation round."""

    model_config = ConfigDict(extra="forbid")

    bid_id: str
    agent_id: str
    env_version: int
    bid_version: int = Field(ge=1)
    requested_mw: float = Field(ge=0)
    min_acceptable_mw: float = Field(ge=0)
    segments: list[SegmentBid]
    criticality: float = Field(ge=0, le=1)
    urgency: float = Field(ge=0, le=1)
    max_concession: float = Field(ge=0, le=1)
    reason: str


class AllocationResult(BaseModel):
    """The result of allocating resources to a single agent."""

    agent_id: str
    allocated_mw: float
    segments: list[SegmentAllocation]
    unmet_mw: float
    critical_shortfall: float
    env_version: int
    txn_id: str
    fallback: bool = False


class NegotiationEvent(BaseModel):
    """An event that occurred during a negotiation round."""

    round: int
    agent_id: str | None
    event_type: str
    payload: dict
    env_version: int
    step: int
    seq: int | None = None


class SimulationEvent(BaseModel):
    """An event injected into the simulation (supply drop, demand surge, etc.)."""

    event_type: str  # value from EventType enum in config
    step: int
    magnitude: float = Field(ge=0, le=100)
    target_agent: str | None = None
    description: str = ""
