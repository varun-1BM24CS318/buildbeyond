"""
Bid and Telemetry Verification Subsystem
========================================

Provides pre-allocation bid envelope validation, cryptographic HMAC-SHA256
telemetry authentication, replay protection, and cross-utility consistency checks.
"""

from app.verification.envelope import (
    BidVerificationResult,
    VerificationStatus,
    verify_bid_envelope,
)
from app.verification.telemetry import (
    CrossUtilityAuditor,
    TelemetryPacket,
    VerificationManager,
    sign_telemetry_packet,
    verify_telemetry_packet,
)

__all__ = [
    "VerificationStatus",
    "BidVerificationResult",
    "verify_bid_envelope",
    "TelemetryPacket",
    "sign_telemetry_packet",
    "verify_telemetry_packet",
    "CrossUtilityAuditor",
    "VerificationManager",
]
