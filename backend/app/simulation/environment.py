"""
Simulation Environment & State Machine
======================================

Maintains the physical grid environment, logical clock, and seeded RNG.
Every change to supply, severity, or event increments env_version.
Determinism: One seeded numpy.random.Generator per run. Same seed and scenario
yields an identical ledger hash.
"""

from __future__ import annotations

import logging
from typing import Any
import numpy as np

from app.config import DEFAULT_SUPPLY_MW, EventType
from app.negotiation.messages import SimulationEvent
from app.simulation.clock import LogicalClock

logger = logging.getLogger("simulation.env")


class EnvironmentState:
    """State of the physical infrastructure environment at step t."""

    def __init__(self, seed: int = 42) -> None:
        self.seed: int = seed
        self.rng: np.random.Generator = np.random.default_rng(seed)
        self.clock: LogicalClock = LogicalClock()

        # Core physical metrics
        self.supply_mw: float = DEFAULT_SUPPLY_MW
        self.initial_supply_mw: float = DEFAULT_SUPPLY_MW
        self.severity: float = 0.0  # 0.0 = calm, 1.0 = catastrophic
        self.grid_health: float = 1.0
        self.water_reserve: float = 1.0  # 1.0 = 100% full
        self.telecom_availability: float = 1.0
        self.emergency_demand: float = 0.2
        self.hospital_generator_failure: bool = False
        self.telecom_degraded: bool = False

        # Versioning
        self.env_version: int = 1

        # Event queue
        self.pending_events: list[SimulationEvent] = []
        self.applied_events: list[SimulationEvent] = []

    def bump_version(self) -> int:
        """Increment environment version on any physical or event change."""
        self.env_version += 1
        return self.env_version

    def reset(self, seed: int | None = None) -> None:
        """Reset the environment to initial state."""
        if seed is not None:
            self.seed = seed
        self.rng = np.random.default_rng(self.seed)
        self.clock.reset()
        self.supply_mw = self.initial_supply_mw
        self.severity = 0.0
        self.grid_health = 1.0
        self.water_reserve = 1.0
        self.telecom_availability = 1.0
        self.emergency_demand = 0.2
        self.hospital_generator_failure = False
        self.telecom_degraded = False
        self.env_version = 1
        self.pending_events.clear()
        self.applied_events.clear()

    def queue_event(self, event: SimulationEvent) -> None:
        """Queue an event for future or immediate execution."""
        self.pending_events.append(event)
        self.pending_events.sort(key=lambda e: e.step)

    def apply_event(self, event: SimulationEvent) -> bool:
        """Apply an event mutation and bump env_version."""
        ev_type = event.event_type
        mag = event.magnitude

        if ev_type == EventType.SUPPLY_DROP:
            # Drop supply by magnitude percentage
            drop_mw = self.initial_supply_mw * (mag / 100.0)
            self.supply_mw = max(0.0, self.supply_mw - drop_mw)
            self.grid_health = max(0.0, self.supply_mw / self.initial_supply_mw)
            self.severity = min(1.0, self.severity + 0.3)

        elif ev_type == EventType.SUPPLY_RESTORE:
            restore_mw = self.initial_supply_mw * (mag / 100.0)
            self.supply_mw = min(self.initial_supply_mw, self.supply_mw + restore_mw)
            self.grid_health = min(1.0, self.supply_mw / self.initial_supply_mw)
            self.severity = max(0.0, self.severity - 0.2)

        elif ev_type == EventType.BACKUP_FAIL:
            if event.target_agent == "hospital" or not event.target_agent:
                self.hospital_generator_failure = True

        elif ev_type == EventType.DEMAND_SURGE:
            self.severity = min(1.0, self.severity + (mag / 100.0))

        elif ev_type == EventType.WATER_RESERVE_DROP:
            drop_pct = mag / 100.0
            self.water_reserve = max(0.0, self.water_reserve - drop_pct)

        elif ev_type == EventType.TELECOM_DEGRADE:
            self.telecom_degraded = True
            self.telecom_availability = max(0.0, 1.0 - (mag / 100.0))

        self.applied_events.append(event)
        self.bump_version()
        return True

    def step_environment(self) -> list[SimulationEvent]:
        """Advance logical step and process scheduled events for this step."""
        current_step = self.clock.tick()

        # Drain and apply events matching current_step
        events_to_apply = [e for e in self.pending_events if e.step == current_step]
        self.pending_events = [e for e in self.pending_events if e.step != current_step]

        for ev in events_to_apply:
            self.apply_event(ev)

        # Natural degradation / recovery dynamics
        if self.water_reserve < 0.95 and self.supply_mw >= 60.0:
            self.water_reserve = min(1.0, self.water_reserve + 0.05)

        return events_to_apply

    def get_state_snapshot(self) -> dict[str, Any]:
        """Export comprehensive environment snapshot."""
        return {
            "step": self.clock.current_step,
            "env_version": self.env_version,
            "supply_mw": self.supply_mw,
            "severity": round(self.severity, 4),
            "grid_health": round(self.grid_health, 4),
            "water_reserve": round(self.water_reserve, 4),
            "telecom_availability": round(self.telecom_availability, 4),
            "emergency_demand": round(self.emergency_demand, 4),
            "hospital_generator_failure": self.hospital_generator_failure,
            "telecom_degraded": self.telecom_degraded,
        }
