"""
Network-Aware Feasibility Constraints
=====================================

Builds linear capacity constraints for the optimization pipeline and projects
heuristic allocations to the feasible network polytope:
    Σ_{i ∈ downstream(l)} x_i / (1 - loss_l) <= cap_l(t)
"""

from __future__ import annotations

from typing import Any
import numpy as np

from app.config import EPS
from app.network.topology import NetworkTopology


def build_network_line_constraints(
    agent_seg_indices: dict[str, list[int]],
    n_vars: int,
    topology: NetworkTopology,
) -> tuple[list[np.ndarray], list[float], list[str]]:
    """Build A_ub and b_ub rows enforcing radial feeder thermal limits."""
    A_rows: list[np.ndarray] = []
    b_rows: list[float] = []
    names: list[str] = []

    for f_id, feeder in topology.feeders.items():
        row = np.zeros(n_vars)
        coeff = 1.0 / max(1.0 - feeder.loss_factor, EPS)

        has_agents = False
        for aid in feeder.agents:
            if aid in agent_seg_indices:
                for seg_idx in agent_seg_indices[aid]:
                    row[seg_idx] = coeff
                    has_agents = True

        if has_agents:
            A_rows.append(row)
            b_rows.append(feeder.current_capacity_mw)
            names.append(f"feeder_cap_{f_id}")

    return A_rows, b_rows, names


def project_to_network_feasible(
    allocations: dict[str, float],
    topology: NetworkTopology,
) -> dict[str, float]:
    """Project raw allocations into the radial network feasible region.

    Used by baseline strategies to respect feeder constraints without an LP solve.
    Scales down downstream agents along any congested feeder.
    """
    projected = dict(allocations)

    for feeder in topology.feeders.values():
        downstream_sum = sum(projected.get(aid, 0.0) for aid in feeder.agents)
        loss_scale = max(1.0 - feeder.loss_factor, EPS)
        line_flow = downstream_sum / loss_scale

        if line_flow > feeder.current_capacity_mw + EPS:
            # Overloaded feeder: scale downstream allocations proportionally
            max_allowed_delivered = feeder.current_capacity_mw * loss_scale
            ratio = max_allowed_delivered / max(downstream_sum, EPS)
            for aid in feeder.agents:
                if aid in projected:
                    projected[aid] = round(max(0.0, projected[aid] * ratio), 4)

    return projected


def check_network_violations(
    allocations: dict[str, float],
    topology: NetworkTopology,
) -> list[dict[str, Any]]:
    """Verify zero thermal line limit violations across all feeders."""
    violations = []
    for feeder in topology.feeders.values():
        downstream = sum(allocations.get(aid, 0.0) for aid in feeder.agents)
        flow = downstream / max(1.0 - feeder.loss_factor, EPS)
        if flow > feeder.current_capacity_mw + 1e-4:
            violations.append({
                "feeder_id": feeder.id,
                "feeder_name": feeder.name,
                "flow_mw": round(flow, 4),
                "capacity_mw": round(feeder.current_capacity_mw, 4),
                "overload_mw": round(flow - feeder.current_capacity_mw, 4),
            })
    return violations
