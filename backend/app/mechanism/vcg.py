"""
VCG-Style (Clarke Pivot) Priority Credit Pricing (W2)
=====================================================

Implements the classic Clarke pivot mechanism for power allocation:
    Payment p_i = W_{-i}(opt without i) - Σ_{j ≠ i} welfare_j(x*)

Where:
- W_{-i}(opt without i): Optimal social welfare achievable by all peer utilities
  when agent i is absent from the auction (resolved via counterfactual LP).
- Σ_{j ≠ i} welfare_j(x*): Actual welfare attained by all peer utilities under the
  full allocation vector x*.

Guarantees:
- An agent that inflates its demand takes scarce power away from higher-valuing
  critical services and pays exactly the harm (externality) it inflicts.
- Charged in virtual priority credits, neutralizing strategic deviation.
"""

from __future__ import annotations

import logging
from typing import Dict

from app.config import EPS
from app.negotiation.messages import AllocationResult, BidMessage
from app.optimization.stage_b_damage import solve_stage_b

logger = logging.getLogger("mechanism.vcg")


def compute_agent_welfare(
    allocated_mw: float,
    bid: BidMessage,
    effective_values: dict[str, float] | None = None,
) -> float:
    """Calculate social welfare for an agent given its allocated MW."""
    rem = max(0.0, allocated_mw)
    welfare = 0.0
    eff_vals = effective_values or {}

    for seg in bid.segments:
        take = min(rem, seg.capacity_mw)
        v = eff_vals.get(seg.name, seg.marginal_value)
        welfare += take * v
        rem -= take
        if rem <= EPS:
            break
    return welfare


class VCGMechanism:
    """Calculates Clarke pivot payments via n+1 LP solves."""

    @classmethod
    def calculate_payments(
        cls,
        allocations: dict[str, AllocationResult],
        bids: dict[str, BidMessage],
        supply_mw: float,
        minimums: dict[str, float],
        effective_values: dict[str, dict[str, float]] | None = None,
    ) -> dict[str, float]:
        """Compute virtual credit payments for all agents.

        Requires 1 actual solve (already done in allocations) + n counterfactual solves.
        """
        agent_ids = sorted(bids.keys())
        payments: dict[str, float] = {}

        # 1. Compute baseline welfare attained by each agent in actual allocation x*
        actual_welfares: dict[str, float] = {}
        for aid in agent_ids:
            mw = allocations[aid].allocated_mw if aid in allocations else 0.0
            bid = bids[aid]
            eff_v = (effective_values or {}).get(aid, {})
            actual_welfares[aid] = compute_agent_welfare(mw, bid, eff_v)

        # 2. For each agent i, solve counterfactual LP without agent i
        for target_i in agent_ids:
            # Sub-bids without agent i
            peer_bids = {aid: b for aid, b in bids.items() if aid != target_i}
            peer_mins = {aid: m for aid, m in minimums.items() if aid != target_i}

            if not peer_bids:
                payments[target_i] = 0.0
                continue

            # Counterfactual Stage B solve
            cf_res = solve_stage_b(
                bids=peer_bids,
                supply_mw=supply_mw,
                minimums=peer_mins,
                stage_a_shortfall=0.0,
                effective_values=effective_values,
            )

            w_without_i = cf_res.optimal_welfare if cf_res.success else sum(actual_welfares[j] for j in peer_bids)
            peers_actual_welfare = sum(actual_welfares[j] for j in peer_bids)

            # Clarke pivot payment: externality imposed on peers
            payment = max(0.0, w_without_i - peers_actual_welfare)
            # Full externality payment in virtual priority credits
            payments[target_i] = round(payment, 2)

        return payments
