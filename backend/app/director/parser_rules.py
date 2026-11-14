"""
Disaster Director: Deterministic Rule-Based Parser (W3)
======================================================

Parses natural language disaster scenarios typed by judges into schema-validated
SimulationEvent objects using regex and keyword mapping.
Always available offline without external API dependencies.
"""

from __future__ import annotations

import re
from app.config import EventType
from app.negotiation.messages import SimulationEvent


def sanitize_input(text: str) -> str:
    """Strip control characters, trim whitespace, and enforce max 500 length."""
    # Remove control characters
    cleaned = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", text)
    return cleaned[:500].strip()


def parse_events_rule_based(text: str, default_step: int = 1) -> list[SimulationEvent]:
    """Parse natural language disaster descriptions into SimulationEvent items."""
    clean = sanitize_input(text)
    if not clean:
        return []

    events: list[SimulationEvent] = []
    # Split text into clauses / sentences by punctuation or conjunctions
    clauses = re.split(r"[,;.\n]|\band\b", clean, flags=re.IGNORECASE)

    for clause in clauses:
        c = clause.strip()
        if not c:
            continue

        # Extract hour/step if specified (e.g. "at hour 2", "at step 3", "in 4 hours", "at 2pm")
        step = default_step
        step_match = re.search(r"\b(?:hour|step|hr|h)\s*(\d+)\b", c, re.IGNORECASE)
        if step_match:
            step = min(48, max(0, int(step_match.group(1))))
        else:
            num_match = re.search(r"\bat\s+(\d+)\b", c, re.IGNORECASE)
            if num_match:
                step = min(48, max(0, int(num_match.group(1))))

        # Extract magnitude percentage if mentioned (e.g. "40%", "30 percent")
        mag = 30.0  # sensible default
        mag_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:%|percent)", c, re.IGNORECASE)
        if mag_match:
            mag = min(100.0, max(5.0, float(mag_match.group(1))))

        c_low = c.lower()

        # 1. Hospital generator / backup failure
        if any(w in c_low for w in ("generator", "backup fail", "diesel", "blackout at hospital")):
            events.append(
                SimulationEvent(
                    event_type=EventType.BACKUP_FAIL,
                    step=step,
                    magnitude=100.0,
                    target_agent="hospital",
                    description=f"Hospital backup failure detected: {c}",
                )
            )

        # 2. Water reserve / aqueduct / flood / pump disruption
        elif any(w in c_low for w in ("water", "reservoir", "aqueduct", "pump", "pipe", "treatment")):
            events.append(
                SimulationEvent(
                    event_type=EventType.WATER_RESERVE_DROP,
                    step=step,
                    magnitude=mag if mag_match else 40.0,
                    target_agent="water",
                    description=f"Water infrastructure damage: {c}",
                )
            )

        # 3. Telecom / cell towers / fiber / comms
        elif any(w in c_low for w in ("telecom", "cell tower", "fiber", "network", "communication", "internet")):
            events.append(
                SimulationEvent(
                    event_type=EventType.TELECOM_DEGRADE,
                    step=step,
                    magnitude=mag if mag_match else 50.0,
                    target_agent="telecom",
                    description=f"Telecommunications disruption: {c}",
                )
            )

        # 4. Supply restore / recovery / power back
        elif any(w in c_low for w in ("restore", "repaired", "reconnect", "power back", "recovery", "online")):
            events.append(
                SimulationEvent(
                    event_type=EventType.SUPPLY_RESTORE,
                    step=step,
                    magnitude=mag if mag_match else 30.0,
                    description=f"Grid supply restored: {c}",
                )
            )

        # 5. Supply drop / grid trip / substation / transformer / explosion / hurricane / cyclone
        elif any(w in c_low for w in ("substation", "grid", "transformer", "flood", "cyclone", "storm", "damage", "cut", "drop", "outage", "blackout")):
            events.append(
                SimulationEvent(
                    event_type=EventType.SUPPLY_DROP,
                    step=step,
                    magnitude=mag if mag_match else 40.0,
                    description=f"Grid supply drop: {c}",
                )
            )

        # 6. Demand surge / heatwave / mass casualties / mobilization
        elif any(w in c_low for w in ("surge", "heatwave", "emergency", "evacuation", "patients", "demand")):
            events.append(
                SimulationEvent(
                    event_type=EventType.DEMAND_SURGE,
                    step=step,
                    magnitude=mag if mag_match else 30.0,
                    description=f"Demand surge triggered: {c}",
                )
            )

    return events[:10]  # Cap at max 10 events
