"""
Cryptographic Telemetry Authentication & Cross-Utility Consistency
==================================================================

Implements HMAC-SHA256 authenticated telemetry packets, replay/freshness checks,
bounded meter noise simulation, and cross-utility physical consistency audits.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import time
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, Field

from app.config import EPS
from app.verification.envelope import BidVerificationResult, VerificationStatus

DEFAULT_HMAC_SECRET: str = os.getenv("TELEMETRY_HMAC_SECRET", "crisisgrid-telemetry-secret-key-2026")


class TelemetryPacket(BaseModel):
    """Authenticated consumption telemetry report from a participating infrastructure node."""

    agent_id: str
    step: int
    metered_mw: float
    nonce: str
    timestamp: float = Field(default_factory=time.time)
    signature: str = ""


def compute_telemetry_hmac(
    agent_id: str,
    step: int,
    metered_mw: float,
    nonce: str,
    secret: str = DEFAULT_HMAC_SECRET,
) -> str:
    """Compute HMAC-SHA256 digest over canonical telemetry payload."""
    payload = f"{agent_id}:{step}:{metered_mw:.4f}:{nonce}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def sign_telemetry_packet(
    agent_id: str,
    step: int,
    metered_mw: float,
    nonce: str,
    secret: str = DEFAULT_HMAC_SECRET,
) -> TelemetryPacket:
    """Create and sign an authenticated telemetry packet."""
    sig = compute_telemetry_hmac(agent_id, step, metered_mw, nonce, secret)
    return TelemetryPacket(
        agent_id=agent_id,
        step=step,
        metered_mw=metered_mw,
        nonce=nonce,
        signature=sig,
    )


def verify_telemetry_packet(
    packet: TelemetryPacket,
    seen_nonces: set[str],
    current_step: int,
    secret: str = DEFAULT_HMAC_SECRET,
) -> tuple[bool, str]:
    """Cryptographically verify signature, replay protection, and step freshness."""
    # 1. Nonce replay check
    if packet.nonce in seen_nonces:
        return False, f"Replay attack detected: nonce '{packet.nonce}' has already been processed"

    # 2. Step freshness check (within ±1 step window)
    if abs(packet.step - current_step) > 1:
        return False, f"Stale telemetry packet: packet step {packet.step} does not match current step {current_step}"

    # 3. HMAC-SHA256 signature verification
    expected_sig = compute_telemetry_hmac(
        packet.agent_id,
        packet.step,
        packet.metered_mw,
        packet.nonce,
        secret,
    )

    if not hmac.compare_digest(packet.signature, expected_sig):
        return False, "Cryptographic verification failed: HMAC-SHA256 signature mismatch"

    # Record nonce
    seen_nonces.add(packet.nonce)
    return True, "HMAC-SHA256 signature and freshness verified"


class CrossUtilityAuditor:
    """Evaluates cross-utility physical couplings (κ) across dependent infrastructures.

    Physical Dependency Couplings:
    - Water treatment output directly constrains Hospital central chiller intake (κ = 0.85).
    - Telecom network integrity constrains Emergency dispatch field telemetry (κ = 0.70).
    """

    COUPLINGS = [
        {"upstream": "water", "dependent": "hospital", "kappa": 0.85, "name": "Water-to-Hospital-HVAC"},
        {"upstream": "telecom", "dependent": "emergency", "kappa": 0.70, "name": "Telecom-to-Emergency-CAD"},
    ]

    @classmethod
    def audit_consistency(
        cls,
        telemetry_mw: dict[str, float],
        demands_mw: dict[str, float],
        threshold: float = 0.25,
    ) -> list[dict[str, Any]]:
        """Identify cross-utility physical discrepancies."""
        discrepancies: list[dict[str, Any]] = []

        for coupling in cls.COUPLINGS:
            up_id = coupling["upstream"]
            dep_id = coupling["dependent"]
            kappa = coupling["kappa"]

            up_mw = telemetry_mw.get(up_id, 0.0)
            dep_mw = telemetry_mw.get(dep_id, 0.0)
            up_dem = demands_mw.get(up_id, 1.0)

            # Upstream service satisfaction level [0, 1]
            up_service_level = min(1.0, max(0.0, up_mw / max(up_dem, EPS)))

            # If upstream is severely degraded, dependent claiming 100% full capacity
            # without backup is physically inconsistent
            if up_service_level < 0.5 and dep_mw > 0.9 * demands_mw.get(dep_id, 0.0):
                discrepancy_score = round((1.0 - up_service_level) * kappa, 3)
                if discrepancy_score > threshold:
                    discrepancies.append({
                        "coupling": coupling["name"],
                        "upstream_agent": up_id,
                        "dependent_agent": dep_id,
                        "upstream_service_pct": round(up_service_level * 100, 1),
                        "dependent_load_mw": dep_mw,
                        "discrepancy_score": discrepancy_score,
                        "flag": "PHYSICAL_COUPLING_DISCREPANCY",
                    })

        return discrepancies


@dataclass
class VerificationRecord:
    step: int
    agent_id: str
    status: str
    verification_type: str  # BID_ENVELOPE or TELEMETRY_HMAC or CROSS_UTILITY
    detail: str
    timestamp: float = field(default_factory=time.time)


class VerificationManager:
    """Coordinates bid verification, telemetry audits, ledger event emissions, and history tracking."""

    def __init__(self) -> None:
        self.seen_nonces: set[str] = set()
        self.latest_status: dict[str, str] = {}
        self.history: list[VerificationRecord] = []

    def record_verification(
        self,
        step: int,
        agent_id: str,
        status: str,
        v_type: str,
        detail: str,
    ) -> VerificationRecord:
        rec = VerificationRecord(
            step=step,
            agent_id=agent_id,
            status=status,
            verification_type=v_type,
            detail=detail,
        )
        self.latest_status[agent_id] = status
        self.history.append(rec)
        return rec

    def get_status_summary(self) -> dict[str, Any]:
        return {
            "statuses": dict(self.latest_status),
            "total_verifications": len(self.history),
            "verified_count": sum(1 for r in self.history if r.status == VerificationStatus.VERIFIED.value),
            "suspect_count": sum(1 for r in self.history if r.status == VerificationStatus.SUSPECT.value),
            "rejected_count": sum(1 for r in self.history if r.status == VerificationStatus.REJECTED.value),
        }

    def get_agent_history(self, agent_id: str | None = None) -> list[dict[str, Any]]:
        records = self.history if not agent_id else [r for r in self.history if r.agent_id == agent_id]
        return [
            {
                "step": r.step,
                "agent_id": r.agent_id,
                "status": r.status,
                "type": r.verification_type,
                "detail": r.detail,
                "timestamp": r.timestamp,
            }
            for r in records
        ]
