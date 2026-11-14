"""
Pre-defined Disaster Scenarios
==============================

Generates realistic sequences of events across a discrete 12-to-48 step horizon.
All scenarios use closed EventType enums with bounded magnitudes.
"""

from __future__ import annotations

from typing import Callable

from app.config import EventType, Scenario
from app.negotiation.messages import SimulationEvent


def create_scenario_events(scenario: Scenario | str) -> list[SimulationEvent]:
    """Generate scheduled simulation events for the chosen scenario."""
    scen_str = scenario.value if isinstance(scenario, Scenario) else str(scenario).lower()

    if scen_str in ("normal", "baseline"):
        return []

    elif scen_str in ("grid_failure", "major_grid_failure"):
        # Sudden 40% drop at hour 3
        return [
            SimulationEvent(
                event_type=EventType.SUPPLY_DROP,
                step=3,
                magnitude=40.0,
                description="Major substation trip: sudden 40% grid supply loss",
            ),
        ]

    elif scen_str in ("cyclone", "hurricane"):
        return [
            SimulationEvent(
                event_type=EventType.DEMAND_SURGE,
                step=1,
                magnitude=30.0,
                description="Tropical cyclone warning: Emergency services mobilize",
            ),
            SimulationEvent(
                event_type=EventType.SUPPLY_DROP,
                step=2,
                magnitude=30.0,
                description="High winds damage transmission corridor: 30% initial supply drop",
            ),
            SimulationEvent(
                event_type=EventType.SUPPLY_DROP,
                step=3,
                magnitude=15.0,
                description="Secondary transformer tripped by falling debris: additional 15% drop",
            ),
            SimulationEvent(
                event_type=EventType.WATER_RESERVE_DROP,
                step=4,
                magnitude=40.0,
                description="Storm surge contaminates intake; reservoir draw accelerates",
            ),
            SimulationEvent(
                event_type=EventType.TELECOM_DEGRADE,
                step=5,
                magnitude=50.0,
                description="Cell towers lose battery backup in gale zone",
            ),
            SimulationEvent(
                event_type=EventType.SUPPLY_DROP,
                step=5,
                magnitude=10.0,
                description="Flooding breaches coastal switchyard: trough of grid crisis",
            ),
            SimulationEvent(
                event_type=EventType.SUPPLY_RESTORE,
                step=6,
                magnitude=10.0,
                description="Auxiliary diesel generators synchronized to microgrid",
            ),
            SimulationEvent(
                event_type=EventType.SUPPLY_RESTORE,
                step=7,
                magnitude=12.0,
                description="Mobile substation units deployed to essential lines",
            ),
            SimulationEvent(
                event_type=EventType.SUPPLY_RESTORE,
                step=8,
                magnitude=15.0,
                description="Linemen restore secondary feeder line",
            ),
            SimulationEvent(
                event_type=EventType.SUPPLY_RESTORE,
                step=10,
                magnitude=10.0,
                description="Main 132kV transmission trunk back in service",
            ),
        ]

    elif scen_str in ("hospital_generator_failure", "hospital_failure"):
        return [
            SimulationEvent(
                event_type=EventType.SUPPLY_DROP,
                step=1,
                magnitude=30.0,
                description="Initial grid disruption",
            ),
            SimulationEvent(
                event_type=EventType.BACKUP_FAIL,
                step=2,
                magnitude=100.0,
                target_agent="hospital",
                description="Critical Hospital diesel generator seized on startup!",
            ),
        ]

    elif scen_str in ("water_shortage", "water_failure"):
        return [
            SimulationEvent(
                event_type=EventType.WATER_RESERVE_DROP,
                step=2,
                magnitude=60.0,
                description="Main aqueduct trunk leak; rapid water depletion",
            ),
            SimulationEvent(
                event_type=EventType.SUPPLY_DROP,
                step=3,
                magnitude=30.0,
                description="Grid voltage collapse near treatment plant",
            ),
        ]

    elif scen_str in ("telecom_failure",):
        return [
            SimulationEvent(
                event_type=EventType.TELECOM_DEGRADE,
                step=2,
                magnitude=75.0,
                description="Core fiber trunk severed by roadworks",
            ),
        ]

    elif scen_str in ("recovery",):
        return [
            SimulationEvent(
                event_type=EventType.SUPPLY_DROP,
                step=2,
                magnitude=50.0,
                description="Initial major blackout: 50% supply drop",
            ),
            SimulationEvent(
                event_type=EventType.SUPPLY_RESTORE,
                step=5,
                magnitude=25.0,
                description="Phase 1 black start units synchronized",
            ),
            SimulationEvent(
                event_type=EventType.SUPPLY_RESTORE,
                step=8,
                magnitude=25.0,
                description="Full grid tie-line re-established",
            ),
        ]

    elif scen_str in ("feeder_derate", "line_derate"):
        return [
            SimulationEvent(
                event_type=EventType.SUPPLY_DROP,
                step=2,
                magnitude=20.0,
                description="Storm causes initial 20% grid supply loss",
            ),
            SimulationEvent(
                event_type=EventType.LINE_DERATE,
                step=3,
                magnitude=18.0,
                target_agent="feeder_1",
                description="North feeder thermal overload from flooding: capacity derated to 18.0 MW",
            ),
            SimulationEvent(
                event_type=EventType.LINE_RESTORE,
                step=7,
                magnitude=45.0,
                target_agent="feeder_1",
                description="Emergency line crew clears vegetation: North feeder capacity fully restored",
            ),
        ]

    elif scen_str in ("cheater_under_scarcity", "cheater"):
        # The headline demo scenario
        return [
            SimulationEvent(
                event_type=EventType.SUPPLY_DROP,
                step=3,
                magnitude=40.0,
                description="Scarcity induced: 40% sudden supply drop triggering strategic bidding",
            ),
        ]

    else:
        return []


def list_available_scenarios() -> list[dict[str, str]]:
    """Return catalog of available scenarios with human descriptions."""
    return [
        {"id": "normal", "name": "Normal Operations", "description": "Stable 80 MW grid, low severity."},
        {"id": "grid_failure", "name": "Major Grid Failure", "description": "Sudden 40% supply loss at hour 3."},
        {"id": "cyclone", "name": "Tropical Cyclone", "description": "Multi-wave storm impacting grid, water, and telecom."},
        {"id": "hospital_generator_failure", "name": "Hospital Generator Failure", "description": "Hospital backup fails during grid stress."},
        {"id": "water_shortage", "name": "Water Infrastructure Crisis", "description": "Aqueduct rupture combined with power deficit."},
        {"id": "telecom_failure", "name": "Telecom Trunk Cut", "description": "Major communications blackout."},
        {"id": "recovery", "name": "Black Start & Recovery", "description": "Deep outage followed by two-stage phased restoration."},
        {"id": "cheater_under_scarcity", "name": "Cheater Under Scarcity (Demo)", "description": "Scarcity conditions highlighting strategic lying vs VCG defense."},
        {"id": "feeder_derate", "name": "Feeder Derate & Line Congestion", "description": "Thermal line constraint restricts North feeder during storm, testing radial feasibility."},
    ]
