"""
REST API Request & Response Schemas
==================================

All schemas strictly enforce extra="forbid" and finite numeric bounds.
"""

from __future__ import annotations

import math
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.config import EventType, Scenario


class BaseApiSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class StepRequest(BaseApiSchema):
    steps: int = Field(default=1, ge=1, le=48, description="Number of steps to advance")


class ScenarioRequest(BaseApiSchema):
    scenario: str = Field(..., max_length=64, description="Scenario identifier")


class EventRequest(BaseApiSchema):
    event_type: str = Field(..., description="Closed EventType enum string")
    step: int = Field(..., ge=0, le=48)
    magnitude: float = Field(..., ge=0.0, le=100.0)
    target_agent: Optional[str] = Field(default=None, max_length=64)
    description: str = Field(default="", max_length=256)

    @field_validator("event_type")
    def validate_event_type(cls, v: str) -> str:
        valid_types = {e.value for e in EventType}
        if v not in valid_types:
            raise ValueError(f"Invalid event_type '{v}'. Must be one of {valid_types}")
        return v

    @field_validator("magnitude")
    def check_finite_mag(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Magnitude must be a finite number")
        return v


class SpeedRequest(BaseApiSchema):
    interval_seconds: float = Field(default=1.0, ge=0.05, le=10.0)

    @field_validator("interval_seconds")
    def check_finite_speed(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Interval must be finite")
        return v


class AgentModeRequest(BaseApiSchema):
    mode: str = Field(..., description="'honest' or 'cheater'")

    @field_validator("mode")
    def validate_mode(cls, v: str) -> str:
        v_low = v.lower()
        if v_low not in ("honest", "cheater"):
            raise ValueError("Mode must be either 'honest' or 'cheater'")
        return v_low


class DirectorParseRequest(BaseApiSchema):
    text: str = Field(..., min_length=1, max_length=500, description="Natural language disaster prompt")


class DirectorApplyRequest(BaseApiSchema):
    events: list[EventRequest] = Field(..., max_length=10, description="List of events to inject")
