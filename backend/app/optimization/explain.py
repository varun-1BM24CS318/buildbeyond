"""
Solver Output Explanation Engine
=================================

Generates transparent, mathematically grounded explanations directly from
LP solver outputs, binding constraints, and agent demand segments.
Strictly templated — no LLM hallucinations or fabricated justifications.
"""

from __future__ import annotations

from typing import Any

from app.config import EPS
from app.negotiation.messages import BidMessage


def generate_segment_explanations(
    agent_id: str,
    bid: BidMessage,
    allocated_mw: float,
    segment_allocs: dict[str, float],
    minimum_mw: float,
    critical_shortfall: float,
) -> list[str]:
    """Generate segment-level allocation explanations."""
    reasons = []

    if critical_shortfall > EPS:
        reasons.append(
            f"CRITICAL SHORTFALL: Grid supply insufficient to satisfy {minimum_mw:.1f} MW baseline (shortfall {critical_shortfall:.2f} MW)."
        )
    elif allocated_mw >= minimum_mw:
        reasons.append(
            f"Critical baseline satisfied (100% of {minimum_mw:.1f} MW guaranteed)."
        )

    for seg in bid.segments:
        sname = seg.name
        seg_alloc = segment_allocs.get(sname, 0.0)
        cap = seg.capacity_mw

        if abs(seg_alloc - cap) < 1e-3:
            reasons.append(
                f"Segment '{sname}' ({seg.marginal_value:.0f} $/MW): Fully funded ({seg_alloc:.2f}/{cap:.2f} MW)."
            )
        elif seg_alloc > EPS:
            reasons.append(
                f"Segment '{sname}' ({seg.marginal_value:.0f} $/MW): Partially funded ({seg_alloc:.2f}/{cap:.2f} MW, {(seg_alloc/cap)*100:.0f}%)."
            )
        else:
            reasons.append(
                f"Segment '{sname}' ({seg.marginal_value:.0f} $/MW): Shed due to higher marginal value needs in peer infrastructure."
            )

    return reasons


def format_solve_explanation(
    status: str,
    stage_a_shortfall: float,
    stage_b_welfare: float,
    stage_c_lambda: float,
    jains_index: float,
    binding_constraints: list[str],
    solve_time_ms: float,
    is_fallback: bool = False,
) -> str:
    """Format an overarching human-readable summary of the optimization decision."""
    if is_fallback:
        return "FALLBACK RESOLUTION: Strict-priority allocation applied due to solver timeout or invariant breach."

    summary_lines = [
        f"Lexicographic LP Solved ({status}) in {solve_time_ms:.1f} ms:",
        f"• Stage A (Life Safety): Critical shortfall = {stage_a_shortfall:.4f} MW",
        f"• Stage B (Damage Minimization): Welfare achieved = {stage_b_welfare:.1f} pts",
        f"• Stage C (Fairness): Minimum ratio λ = {stage_c_lambda:.2f}, Jain's Index = {jains_index:.3f}",
    ]

    if binding_constraints:
        summary_lines.append(f"• Binding Constraints: {', '.join(binding_constraints[:4])}")

    return "\n".join(summary_lines)
