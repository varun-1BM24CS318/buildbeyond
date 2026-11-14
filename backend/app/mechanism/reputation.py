"""
Audit and Reputation Trust Dynamics (W2)
========================================

Post-commit consumption auditing and Bayesian-style trust updates:
1. Metered consumption ground truth from simulator:
       used_i = min(x_i, D_true_i)
2. Overclaim calculation:
       overclaim_i = (x_i - used_i) / max(x_i, EPS)
3. Exponential moving average trust update:
       trust_i <- clip((1 - α) * trust_i + α * (1 - overclaim_i), 0.2, 1.0)
4. Cold start: trust = 1.0; Floor: 0.2.

The mediator scales an agent's segment marginal values by trust_i in later rounds.
Honest agents facing real demand surges are never penalized because D_true rises with
verified environment observations.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict

from app.config import EPS

logger = logging.getLogger("mechanism.reputation")


@dataclass(slots=True)
class AuditRecord:
    agent_id: str
    step: int
    allocated_mw: float
    used_mw: float
    true_demand_mw: float
    overclaim_pct: float
    prior_trust: float
    new_trust: float


class ReputationAuditor:
    """Audits metered consumption and updates reputation trust scores."""

    def __init__(self, alpha: float = 0.35, trust_floor: float = 0.2) -> None:
        self.alpha: float = alpha
        self.trust_floor: float = trust_floor
        self.trust_scores: dict[str, float] = {}
        self.audit_history: list[AuditRecord] = []
        self.step_trust_snapshots: list[dict[str, Any]] = []

    def get_trust(self, agent_id: str) -> float:
        """Return current trust score (default 1.0 cold start)."""
        return self.trust_scores.get(agent_id, 1.0)

    def get_trust_history(self, agent_id: str | None = None) -> list[dict[str, Any]]:
        """Return step-by-step history of trust scores."""
        if agent_id:
            return [
                {"step": snap["step"], "agent_id": agent_id, "trust": snap["scores"].get(agent_id, 1.0)}
                for snap in self.step_trust_snapshots
            ]
        return self.step_trust_snapshots

    def audit_step(
        self,
        step: int,
        allocations: dict[str, float],
        true_demands: dict[str, float],
    ) -> dict[str, AuditRecord]:
        """Audit metered power usage vs allocated power for step t."""
        records: dict[str, AuditRecord] = {}

        for aid, alloc_mw in allocations.items():
            d_true = true_demands.get(aid, alloc_mw)
            used_mw = min(alloc_mw, d_true)

            if alloc_mw > EPS:
                overclaim = max(0.0, (alloc_mw - used_mw) / alloc_mw)
            else:
                overclaim = 0.0

            prior_trust = self.get_trust(aid)
            # Reputation update: penalize overclaiming, reward honest full utilization
            updated_trust = (1.0 - self.alpha) * prior_trust + self.alpha * (1.0 - overclaim)
            clipped_trust = round(max(self.trust_floor, min(1.0, updated_trust)), 4)

            self.trust_scores[aid] = clipped_trust

            rec = AuditRecord(
                agent_id=aid,
                step=step,
                allocated_mw=round(alloc_mw, 4),
                used_mw=round(used_mw, 4),
                true_demand_mw=round(d_true, 4),
                overclaim_pct=round(overclaim * 100.0, 1),
                prior_trust=prior_trust,
                new_trust=clipped_trust,
            )
            records[aid] = rec
            self.audit_history.append(rec)

            if overclaim > 0.05:
                logger.info(
                    f"Audit flag for '{aid}': allocated {alloc_mw:.1f} MW but only used {used_mw:.1f} MW "
                    f"({overclaim*100:.1f}% overclaim). Trust decayed: {prior_trust:.3f} -> {clipped_trust:.3f}"
                )

        self.step_trust_snapshots.append({
            "step": step,
            "scores": dict(self.trust_scores),
        })

        return records

    def reset(self) -> None:
        self.trust_scores.clear()
        self.audit_history.clear()
