"""
Radial Feeder Network Topology & Capacity Model
===============================================

Parses and validates tree network topologies representing substation feeders,
thermal line capacities, and transmission losses. Supports runtime line derates
and recovery events.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
import yaml

from app.config import EPS

DEFAULT_TOPOLOGY_PATH = Path(__file__).parent / "network.yaml"


@dataclass
class FeederLine:
    id: str
    name: str
    nominal_capacity_mw: float
    current_capacity_mw: float
    loss_factor: float
    agents: list[str]
    derated: bool = False

    def derate(self, new_cap_mw: float) -> None:
        if new_cap_mw < 0:
            raise ValueError(f"Line capacity cannot be negative: {new_cap_mw}")
        self.current_capacity_mw = min(self.nominal_capacity_mw, max(0.0, new_cap_mw))
        self.derated = self.current_capacity_mw < self.nominal_capacity_mw - EPS

    def restore(self) -> None:
        self.current_capacity_mw = self.nominal_capacity_mw
        self.derated = False


class NetworkTopology:
    """Radial feeder tree topology with load validation and derate tracking."""

    def __init__(self, yaml_path: Path | str | None = None) -> None:
        self.yaml_path = Path(yaml_path) if yaml_path else DEFAULT_TOPOLOGY_PATH
        self.substation_name: str = "Substation Alpha"
        self.transformer_capacity_mw: float = 90.0
        self.feeders: dict[str, FeederLine] = {}
        self.agent_to_feeder: dict[str, str] = {}
        self.load_topology()

    def load_topology(self) -> None:
        """Parse and strictly validate network topology YAML."""
        if not self.yaml_path.exists():
            raise FileNotFoundError(f"Network topology file not found: {self.yaml_path}")

        with open(self.yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        sub = data.get("substation", {})
        self.substation_name = sub.get("name", "Substation Alpha")
        self.transformer_capacity_mw = float(sub.get("transformer_capacity_mw", 90.0))

        self.feeders.clear()
        self.agent_to_feeder.clear()

        feeders_data = data.get("feeders", [])
        if not feeders_data:
            raise ValueError("Network topology contains no feeders")

        for f_data in feeders_data:
            f_id = f_data["id"]
            name = f_data.get("name", f_id)
            cap = float(f_data["capacity_mw"])
            loss = float(f_data.get("loss_factor", 0.0))
            agents = list(f_data.get("agents", []))

            # Validation invariants
            if cap <= 0:
                raise ValueError(f"Feeder '{f_id}' has non-positive capacity: {cap}")
            if not (0.0 <= loss < 1.0):
                raise ValueError(f"Feeder '{f_id}' loss factor out of bounds [0, 1): {loss}")

            feeder = FeederLine(
                id=f_id,
                name=name,
                nominal_capacity_mw=cap,
                current_capacity_mw=cap,
                loss_factor=loss,
                agents=agents,
            )
            self.feeders[f_id] = feeder

            for aid in agents:
                if aid in self.agent_to_feeder:
                    raise ValueError(
                        f"Agent '{aid}' assigned to multiple feeders: '{self.agent_to_feeder[aid]}' and '{f_id}'"
                    )
                self.agent_to_feeder[aid] = f_id

    def derate_feeder(self, feeder_id: str, new_capacity_mw: float) -> FeederLine:
        if feeder_id not in self.feeders:
            raise KeyError(f"Unknown feeder: '{feeder_id}'")
        f = self.feeders[feeder_id]
        f.derate(new_capacity_mw)
        return f

    def restore_feeder(self, feeder_id: str) -> FeederLine:
        if feeder_id not in self.feeders:
            raise KeyError(f"Unknown feeder: '{feeder_id}'")
        f = self.feeders[feeder_id]
        f.restore()
        return f

    def reset_all_feeders(self) -> None:
        for f in self.feeders.values():
            f.restore()

    def get_feeder_for_agent(self, agent_id: str) -> FeederLine | None:
        f_id = self.agent_to_feeder.get(agent_id)
        return self.feeders.get(f_id) if f_id else None

    def get_state(self, current_allocations: dict[str, float] | None = None) -> dict[str, Any]:
        """Return serializable status of all feeders, capacities, and active loads."""
        allocs = current_allocations or {}
        feeders_state = []

        for f_id, f in self.feeders.items():
            # Downstream delivered power
            downstream_mw = sum(allocs.get(aid, 0.0) for aid in f.agents)
            # Power flowing into line head accounting for losses
            flow_mw = downstream_mw / max(1.0 - f.loss_factor, EPS)
            utilization = round((flow_mw / max(f.current_capacity_mw, EPS)) * 100.0, 1)

            feeders_state.append({
                "id": f.id,
                "name": f.name,
                "nominal_capacity_mw": f.nominal_capacity_mw,
                "current_capacity_mw": f.current_capacity_mw,
                "loss_factor": f.loss_factor,
                "agents": f.agents,
                "derated": f.derated,
                "downstream_delivered_mw": round(downstream_mw, 2),
                "feeder_flow_mw": round(flow_mw, 2),
                "utilization_pct": utilization,
                "is_congested": flow_mw > f.current_capacity_mw + 1e-3,
            })

        return {
            "substation": self.substation_name,
            "transformer_capacity_mw": self.transformer_capacity_mw,
            "feeders": feeders_state,
        }
