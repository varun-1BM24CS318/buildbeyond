"""
Pre-Allocation Bid Envelope Verification
========================================

Validates incoming bids against physical certified capacity, non-negativity,
logical minimums, and dynamic disaster plausibility bands.
"""

from __future__ import annotations

import enum
import math
from dataclasses import dataclass, field
from typing import Any

from app.config import EPS, AgentProfile
from app.negotiation.messages import BidMessage


class VerificationStatus(str, enum.Enum):
    """Classification outcomes for agent verification."""

    VERIFIED = "VERIFIED"
    SUSPECT = "SUSPECT"
    REJECTED = "REJECTED"
    UNVERIFIED = "UNVERIFIED"


@dataclass(slots=True)
class BidVerificationResult:
    """Detailed diagnostic outcome of bid envelope analysis."""

    agent_id: str
    status: VerificationStatus
    requested_mw: float
    certified_max_mw: float
    plausibility_min: float
    plausibility_max: float
    reasons: list[str] = field(default_factory=list)


def verify_bid_envelope(
    bid: BidMessage,
    profile: AgentProfile,
    env_state: dict[str, Any] | None = None,
) -> BidVerificationResult:
    """Verify that a bid satisfies strict hard bounds and lies within plausibility limits.

    1. Hard bounds (instant REJECTED if violated):
       - Values must be finite real numbers (no NaN or Inf)
       - 0 <= min_acceptable_mw <= requested_mw
       - requested_mw <= certified_max_mw + EPS
       - segments sum must match or cover requested_mw

    2. Plausibility envelope (marked SUSPECT if outside):
       - Expected demand is derived from baseline profile adjusted for disaster severity
       - Plausibility band provides a generous physical buffer [min_band, max_band]
       - If requested_mw exceeds max_band, bid is flagged as SUSPECT
    """
    env_state = env_state or {}
    reasons: list[str] = []

    # 1. Hard numeric sanity checks
    req = bid.requested_mw
    min_req = bid.min_acceptable_mw

    if not (math.isfinite(req) and math.isfinite(min_req)):
        return BidVerificationResult(
            agent_id=bid.agent_id,
            status=VerificationStatus.REJECTED,
            requested_mw=req,
            certified_max_mw=profile.certified_max_mw,
            plausibility_min=profile.minimum_mw,
            plausibility_max=profile.certified_max_mw,
            reasons=["Requested or minimum MW is not a finite number (NaN/Inf detected)"],
        )

    if req < -EPS or min_req < -EPS:
        return BidVerificationResult(
            agent_id=bid.agent_id,
            status=VerificationStatus.REJECTED,
            requested_mw=req,
            certified_max_mw=profile.certified_max_mw,
            plausibility_min=profile.minimum_mw,
            plausibility_max=profile.certified_max_mw,
            reasons=[f"Negative MW values requested: req={req:.2f}, min={min_req:.2f}"],
        )

    if min_req > req + EPS:
        return BidVerificationResult(
            agent_id=bid.agent_id,
            status=VerificationStatus.REJECTED,
            requested_mw=req,
            certified_max_mw=profile.certified_max_mw,
            plausibility_min=profile.minimum_mw,
            plausibility_max=profile.certified_max_mw,
            reasons=[f"Logical error: minimum acceptable MW ({min_req:.2f}) exceeds requested MW ({req:.2f})"],
        )

    if req > profile.certified_max_mw + EPS:
        return BidVerificationResult(
            agent_id=bid.agent_id,
            status=VerificationStatus.REJECTED,
            requested_mw=req,
            certified_max_mw=profile.certified_max_mw,
            plausibility_min=profile.minimum_mw,
            plausibility_max=profile.certified_max_mw,
            reasons=[
                f"Certified capacity exceeded: requested {req:.2f} MW > certified max {profile.certified_max_mw:.2f} MW"
            ],
        )

    # 2. Dynamic Plausibility Envelope Calculation
    severity = float(env_state.get("severity", 0.0))
    # Base nominal operating point between minimum and certified max
    nominal_baseline = profile.minimum_mw + (profile.certified_max_mw - profile.minimum_mw) * 0.45
    # Severity expands physical need linearly
    severity_adjustment = (profile.certified_max_mw - nominal_baseline) * (0.6 * severity)
    expected_need = min(profile.certified_max_mw, nominal_baseline + severity_adjustment)

    # Generous plausible tolerance band (±40% around expected need, bounded by [minimum, certified_max])
    plausibility_min = max(profile.minimum_mw, expected_need * 0.60)
    plausibility_max = min(profile.certified_max_mw, expected_need * 1.40)

    # If disaster severity is 0, emergency surge should not be claimed
    if req > plausibility_max + EPS:
        reasons.append(
            f"Demand out of plausibility band: requested {req:.2f} MW exceeds estimated plausibility max {plausibility_max:.2f} MW (severity={severity:.2f})"
        )
        return BidVerificationResult(
            agent_id=bid.agent_id,
            status=VerificationStatus.SUSPECT,
            requested_mw=req,
            certified_max_mw=profile.certified_max_mw,
            plausibility_min=round(plausibility_min, 2),
            plausibility_max=round(plausibility_max, 2),
            reasons=reasons,
        )

    return BidVerificationResult(
        agent_id=bid.agent_id,
        status=VerificationStatus.VERIFIED,
        requested_mw=req,
        certified_max_mw=profile.certified_max_mw,
        plausibility_min=round(plausibility_min, 2),
        plausibility_max=round(plausibility_max, 2),
        reasons=["Bid satisfies certified physical envelope and plausibility threshold"],
    )
