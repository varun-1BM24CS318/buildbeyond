"""
Interdependency Cascade Failure Dynamics (W1)
=============================================

Implements inter-utility dependency propagation:
1. Physical Service Level with 1-step lag:
       p_i(t) = min(1.0, x_i(t) / D_true_i(t))
       s_i(t) = p_i(t) · Π_{j ∈ deps(i)} (1 - κ_ji · (1 - s_j(t-1)))
2. Damage function:
       damage_i(t) = criticality_i · impact_i · (1 - s_i(t))
3. Cascade damage:
       cascade_damage = damage(with propagation) - damage(with κ=0)
4. Cascade shadow value for LP Stage B:
       v_ik_eff = v_ik + Σ_{j depends on i} κ_ij · V_j(t-1)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from app.config import DEFAULT_DEPENDENCIES, EPS, AgentType, DependencyEdge

logger = logging.getLogger("simulation.cascade")


@dataclass(slots=True)
class CascadeStepResult:
    service_levels: dict[str, float]
    direct_damages: dict[str, float]
    total_damages: dict[str, float]
    cascade_damages: dict[str, float]
    propagating_edges: list[dict[str, Any]]


class CascadeModel:
    """Evaluates multi-agent dependency propagation with 1-step lag."""

    def __init__(
        self,
        dependencies: list[DependencyEdge] | None = None,
        impact_weights: dict[str, float] | None = None,
    ) -> None:
        self.dependencies: list[DependencyEdge] = dependencies or DEFAULT_DEPENDENCIES
        self.impact_weights: dict[str, float] = impact_weights or {
            "hospital": 100.0,
            "water": 80.0,
            "emergency": 90.0,
            "telecom": 60.0,
            "residential": 40.0,
        }
        self._validate_graph()

        # State tracking: previous step service levels s_j(t-1), initialized to 1.0 (fully operational)
        self.prev_service_levels: dict[str, float] = {}

    def _validate_graph(self) -> None:
        """Validate all coupling coefficients κ ∈ [0, 1]."""
        for edge in self.dependencies:
            if not (0.0 <= edge.kappa <= 1.0):
                raise ValueError(f"Invalid coupling coefficient κ={edge.kappa} on edge {edge.provider}->{edge.consumer}")

    def reset(self) -> None:
        """Reset historical service levels to 1.0."""
        self.prev_service_levels.clear()

    def get_providers_for(self, consumer_id: str) -> list[tuple[str, float]]:
        """Return list of (provider_id, kappa) for a given consumer."""
        providers = []
        c_norm = consumer_id.lower()
        for edge in self.dependencies:
            cons_name = edge.consumer.value.lower() if hasattr(edge.consumer, "value") else str(edge.consumer).lower()
            if cons_name == c_norm:
                prov_name = edge.provider.value.lower() if hasattr(edge.provider, "value") else str(edge.provider).lower()
                providers.append((prov_name, edge.kappa))
        return providers

    def get_dependents_of(self, provider_id: str) -> list[tuple[str, float]]:
        """Return list of (dependent_id, kappa) that rely on this provider."""
        dependents = []
        p_norm = provider_id.lower()
        for edge in self.dependencies:
            prov_name = edge.provider.value.lower() if hasattr(edge.provider, "value") else str(edge.provider).lower()
            if prov_name == p_norm:
                cons_name = edge.consumer.value.lower() if hasattr(edge.consumer, "value") else str(edge.consumer).lower()
                dependents.append((cons_name, edge.kappa))
        return dependents

    def compute_cascade_shadow_values(
        self,
        base_segments: dict[str, list[tuple[str, float, float]]],
        criticalities: dict[str, float],
    ) -> dict[str, dict[str, float]]:
        """Compute v_ik_eff = v_ik + Σ_{j depends on i} κ_ij · V_j(t-1) for Stage B."""
        effective_values: dict[str, dict[str, float]] = {}

        # 1. Compute aggregate baseline value per dependent V_j(t-1)
        dependent_values: dict[str, float] = {}
        for aid, segs in base_segments.items():
            s_prev = self.prev_service_levels.get(aid, 1.0)
            crit = criticalities.get(aid, 1.0)
            impact = self.impact_weights.get(aid, 50.0)
            # Vulnerability value of dependent
            dependent_values[aid] = crit * impact * (1.0 - s_prev + 0.1)

        # 2. Add shadow bonus to provider segments
        for aid, segs in base_segments.items():
            effective_values[aid] = {}
            deps = self.get_dependents_of(aid)
            shadow_bonus = sum(kappa * dependent_values.get(dep_id, 0.0) for dep_id, kappa in deps)

            for sname, cap, val in segs:
                # Add shadow bonus to critical & essential segments of the provider
                bonus = shadow_bonus if sname.lower() in ("critical", "life-support", "filtration", "dispatch", "core-switching") else shadow_bonus * 0.3
                effective_values[aid][sname] = val + bonus

        return effective_values

    def evaluate_step(
        self,
        allocations: dict[str, float],
        true_demands: dict[str, float],
        criticalities: dict[str, float],
    ) -> CascadeStepResult:
        """Evaluate cascade dynamics, service levels, and damages for step t."""
        agent_ids = sorted(true_demands.keys())

        # 1. Direct power service level p_i(t) = min(1.0, x_i / D_true_i)
        p: dict[str, float] = {}
        for aid in agent_ids:
            d_true = true_demands.get(aid, 1.0)
            alloc = allocations.get(aid, 0.0)
            p[aid] = min(1.0, max(0.0, alloc / max(d_true, EPS)))

        # 2. Coupled service level s_i(t) = p_i(t) * Π (1 - κ_ji * (1 - s_j(t-1)))
        s: dict[str, float] = {}
        propagating_edges: list[dict[str, Any]] = []

        for aid in agent_ids:
            coupled_factor = 1.0
            providers = self.get_providers_for(aid)

            for prov_id, kappa in providers:
                # 1-step lag: read s_j(t-1)
                s_prov_prev = self.prev_service_levels.get(prov_id, 1.0)
                prov_deficit = 1.0 - s_prov_prev
                impact_factor = (1.0 - kappa * prov_deficit)
                coupled_factor *= max(0.0, impact_factor)

                if prov_deficit > 0.05:
                    propagating_edges.append({
                        "from": prov_id,
                        "to": aid,
                        "kappa": kappa,
                        "provider_health": round(s_prov_prev, 3),
                        "degradation_pct": round((1.0 - impact_factor) * 100.0, 1),
                    })

            s[aid] = round(p[aid] * coupled_factor, 4)

        # 3. Direct damage (κ = 0) vs Total damage
        direct_damages: dict[str, float] = {}
        total_damages: dict[str, float] = {}
        cascade_damages: dict[str, float] = {}

        for aid in agent_ids:
            crit = criticalities.get(aid, 1.0)
            impact = self.impact_weights.get(aid, 50.0)

            # Direct damage uses uncoupled p[aid]
            d_direct = crit * impact * (1.0 - p[aid])
            # Total damage uses coupled s[aid]
            d_total = crit * impact * (1.0 - s[aid])
            d_cascade = max(0.0, d_total - d_direct)

            direct_damages[aid] = round(d_direct, 2)
            total_damages[aid] = round(d_total, 2)
            cascade_damages[aid] = round(d_cascade, 2)

        # Update historical state for step t+1
        self.prev_service_levels = dict(s)

        return CascadeStepResult(
            service_levels=s,
            direct_damages=direct_damages,
            total_damages=total_damages,
            cascade_damages=cascade_damages,
            propagating_edges=propagating_edges,
        )
