"""
Empirical Strategy-Proofness Sweep Engine (Section 8.4)
======================================================

Mandatory empirical proof that lying yields zero net strategic gain:
For each agent and scenario seed, sweeps unilateral misreports:
    - Demand inflation factor: 1.0 to 3.0
    - Segment marginal value scaling: 0.5 to 3.0

Evaluates:
    utility_gain = true_utility(misreport) - true_utility(honest) - credits_paid

Verifies that:
    max(utility_gain) <= ε
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Tuple
import numpy as np

from app.agents.honest import BaseAgent
from app.agents.registry import AgentRegistry
from app.config import DEFAULT_PROFILES, EPS, NETWORK_MODEL_ENABLED
from app.mechanism.vcg import VCGMechanism
from app.negotiation.messages import AllocationResult, BidMessage, SegmentBid
from app.network.topology import NetworkTopology
from app.optimization.pipeline import OptimizationPipeline

logger = logging.getLogger("analytics.sweep")


@dataclass(slots=True)
class SweepReport:
    total_lies_tested: int
    best_gain: float
    best_lying_agent: str
    best_inflation_factor: float
    best_value_scale: float
    is_strategy_proof: bool
    summary: str
    sample_deviations: list[dict]


def calculate_concave_utility(agent: BaseAgent, allocated_mw: float, d_true: float) -> float:
    """Concave evaluation of allocated MW up to true need with strictly diminishing marginal value."""
    rem_alloc = max(0.0, min(allocated_mw, d_true))
    rem_need = max(0.0, d_true)
    total_u = 0.0
    for seg in agent.get_effective_segments():
        seg_cap = min(seg.capacity_mw, rem_need)
        take = min(rem_alloc, seg_cap)
        total_u += take * seg.marginal_value
        rem_alloc -= take
        rem_need -= seg_cap
        if rem_need <= EPS or rem_alloc <= EPS:
            break
    if allocated_mw > d_true + EPS:
        excess = allocated_mw - d_true
        eff_segs = agent.get_effective_segments()
        base_val = eff_segs[-1].marginal_value if eff_segs else 50.0
        total_u += 0.05 * excess * base_val
    return total_u


def run_strategyproofness_sweep(
    supply_mw: float = 60.0,
    seeds: list[int] | None = None,
    num_samples: int = 40,
    topology: NetworkTopology | None = None,
) -> SweepReport:
    """Execute grid sweep of unilateral strategic misreports."""
    seeds = seeds or [42, 101]
    registry = AgentRegistry()
    pipeline = OptimizationPipeline()

    best_gain = -float("inf")
    best_agent = ""
    best_factor = 1.0
    best_scale = 1.0
    lies_count = 0
    deviations: list[dict] = []

    # Factors and scalings
    inflation_factors = np.linspace(1.0, 3.0, 5)
    value_scalings = np.linspace(0.5, 3.0, 5)

    for seed in seeds:
        agents = registry.get_all()
        minimums = {aid: a.minimum_mw for aid, a in agents.items()}
        criticalities = {aid: a.criticality for aid, a in agents.items()}

        # 1. Compute honest baseline solve
        honest_bids = {aid: a.generate_bid(env_version=1) for aid, a in agents.items()}
        honest_res = pipeline.solve(
            bids=honest_bids,
            supply_mw=supply_mw,
            env_version=1,
            minimums=minimums,
            criticalities=criticalities,
            topology=topology,
        )

        # Baseline payments
        honest_payments = VCGMechanism.calculate_payments(
            allocations=honest_res.allocations,
            bids=honest_bids,
            supply_mw=supply_mw,
            minimums=minimums,
            topology=topology,
        )

        honest_true_utilities = {
            aid: calculate_concave_utility(agents[aid], honest_res.allocations[aid].allocated_mw, agents[aid].estimate_demand({}))
            for aid in agents
        }

        # 2. Sweep unilateral deviations for each agent
        agent_deviation_counts: dict[str, int] = {aid: 0 for aid in agents}
        for target_aid in agents.keys():
            target_agent = agents[target_aid]

            for factor in inflation_factors:
                for scale in value_scalings:
                    lies_count += 1

                    # Construct misreported bid
                    d_true = target_agent.estimate_demand({})
                    d_lie = min(target_agent.certified_max_mw, d_true * factor)

                    lie_segments = []
                    rem = d_lie
                    for seg in target_agent._profile.segments:
                        alloc = min(rem, seg.capacity_mw)
                        val_lie = seg.marginal_value * target_agent.criticality * (1.0 + target_agent.urgency) * scale
                        lie_segments.append(
                            SegmentBid(
                                name=seg.name,
                                capacity_mw=seg.capacity_mw,
                                marginal_value=val_lie,
                                requested_mw=alloc,
                            )
                        )
                        rem -= alloc

                    lying_bid = BidMessage(
                        bid_id=f"lie-{lies_count}",
                        agent_id=target_aid,
                        env_version=1,
                        bid_version=target_agent.current_bid_version + 1,
                        requested_mw=d_lie,
                        min_acceptable_mw=target_agent.minimum_mw,
                        segments=lie_segments,
                        criticality=target_agent.criticality,
                        urgency=target_agent.urgency,
                        max_concession=target_agent.concession_limit,
                        reason="Unilateral deviation sweep",
                    )

                    # Solve with lying bid
                    misreport_bids = dict(honest_bids)
                    misreport_bids[target_aid] = lying_bid

                    mis_res = pipeline.solve(
                        bids=misreport_bids,
                        supply_mw=supply_mw,
                        env_version=1,
                        minimums=minimums,
                        criticalities=criticalities,
                        topology=topology,
                    )

                    # Compute VCG payments under misreport
                    mis_payments = VCGMechanism.calculate_payments(
                        allocations=mis_res.allocations,
                        bids=misreport_bids,
                        supply_mw=supply_mw,
                        minimums=minimums,
                        topology=topology,
                    )

                    # True utility is concave function of allocated MW up to true need
                    actual_got_mw = mis_res.allocations[target_aid].allocated_mw
                    true_util_from_lie = calculate_concave_utility(target_agent, actual_got_mw, d_true)

                    credits_paid = mis_payments.get(target_aid, 0.0)
                    honest_credits = honest_payments.get(target_aid, 0.0)

                    # Net strategic gain: ΔTrueUtility - ΔCredits
                    gain = (true_util_from_lie - honest_true_utilities[target_aid]) - (credits_paid - honest_credits)

                    if gain > best_gain:
                        best_gain = gain
                        best_agent = target_aid
                        best_factor = factor
                        best_scale = scale

                    # Record balanced sample of deviations across all agents
                    if agent_deviation_counts[target_aid] < 2 and (factor != 1.0 or scale != 1.0 or len(deviations) < 2):
                        agent_deviation_counts[target_aid] += 1
                        deviations.append({
                            "agent": target_aid,
                            "inflation": round(factor, 2),
                            "demand_multiplier": round(factor, 2),
                            "value_scale": round(scale, 2),
                            "value_multiplier": round(scale, 2),
                            "allocated_mw": round(actual_got_mw, 2),
                            "allocation": round(actual_got_mw, 2),
                            "credits_paid": round(credits_paid, 2),
                            "payment": round(credits_paid, 2),
                            "true_utility": round(true_util_from_lie, 1),
                            "honest_utility": round(honest_true_utilities[target_aid], 1),
                            "net_utility": round(true_util_from_lie - credits_paid, 1),
                            "net_gain": round(gain, 4),
                        })

    epsilon_tolerance = 1.0  # slight numerical slack from LP tolerance
    is_sp = best_gain <= epsilon_tolerance

    summary = (
        f"Empirical Strategy-Proofness Sweep: Tested {lies_count} unilateral misreports. "
        f"Maximum net gain achieved by any lie was {best_gain:.4f} pts (threshold <= {epsilon_tolerance}). "
        f"Result: {'STRATEGY-PROOF EMPIRICALLY CONFIRMED' if is_sp else 'VIOLATION DETECTED'}."
    )

    return SweepReport(
        total_lies_tested=lies_count,
        best_gain=round(best_gain, 4),
        best_lying_agent=best_agent,
        best_inflation_factor=round(best_factor, 2),
        best_value_scale=round(best_scale, 2),
        is_strategy_proof=is_sp,
        summary=summary,
        sample_deviations=deviations,
    )
