"""
Unit Tests for Feature 1: Bid and Telemetry Verification
========================================================
"""

import math
import pytest

from app.api.routes import get_verification_history, get_verification_status, sim_ctrl
from app.config import DEFAULT_PROFILES
from app.negotiation.messages import BidMessage, SegmentBid
from app.verification.envelope import VerificationStatus, verify_bid_envelope
from app.verification.telemetry import (
    CrossUtilityAuditor,
    VerificationManager,
    sign_telemetry_packet,
    verify_telemetry_packet,
)


def test_bid_envelope_hard_bounds():
    profile = DEFAULT_PROFILES["hospital"]

    # Valid honest bid
    valid_bid = BidMessage(
        bid_id="b1",
        agent_id="hospital",
        env_version=1,
        bid_version=1,
        requested_mw=18.0,
        min_acceptable_mw=8.0,
        segments=[SegmentBid(name="life-support", capacity_mw=8.0, marginal_value=500.0, requested_mw=8.0)],
        criticality=1.0,
        urgency=0.6,
        max_concession=0.15,
        reason="Normal operation",
    )
    res = verify_bid_envelope(valid_bid, profile, {"severity": 0.2})
    assert res.status == VerificationStatus.VERIFIED

    # NaN / Inf rejection
    nan_bid = valid_bid.model_copy(update={"requested_mw": float("nan")})
    res_nan = verify_bid_envelope(nan_bid, profile)
    assert res_nan.status == VerificationStatus.REJECTED

    # Negative allocation rejection
    neg_bid = valid_bid.model_copy(update={"requested_mw": -5.0})
    res_neg = verify_bid_envelope(neg_bid, profile)
    assert res_neg.status == VerificationStatus.REJECTED

    # Minimum > requested rejection
    inv_bid = valid_bid.model_copy(update={"min_acceptable_mw": 20.0, "requested_mw": 10.0})
    res_inv = verify_bid_envelope(inv_bid, profile)
    assert res_inv.status == VerificationStatus.REJECTED

    # Certified max exceeded rejection
    over_bid = valid_bid.model_copy(update={"requested_mw": 35.0})  # certified max is 25.0
    res_over = verify_bid_envelope(over_bid, profile)
    assert res_over.status == VerificationStatus.REJECTED


def test_bid_envelope_plausibility_band():
    profile = DEFAULT_PROFILES["residential"]  # certified max 30 MW, minimum 2.0 MW

    # Under calm conditions (severity = 0.0), residential asking 29.5 MW is out of plausibility band
    inflated_bid = BidMessage(
        bid_id="b2",
        agent_id="residential",
        env_version=1,
        bid_version=1,
        requested_mw=29.5,
        min_acceptable_mw=2.0,
        segments=[],
        criticality=0.5,
        urgency=0.2,
        max_concession=0.4,
        reason="Claiming huge load with zero disaster severity",
    )
    res = verify_bid_envelope(inflated_bid, profile, {"severity": 0.0})
    assert res.status == VerificationStatus.SUSPECT
    assert len(res.reasons) > 0


def test_cryptographic_telemetry_authentication():
    seen_nonces = set()
    packet = sign_telemetry_packet(agent_id="hospital", step=3, metered_mw=18.5, nonce="nonce-12345")

    # 1. Valid signature passes
    valid, msg = verify_telemetry_packet(packet, seen_nonces, current_step=3)
    assert valid is True

    # 2. Replay of same nonce is rejected
    valid_replay, replay_msg = verify_telemetry_packet(packet, seen_nonces, current_step=3)
    assert valid_replay is False
    assert "Replay" in replay_msg

    # 3. Tampered payload is rejected
    tampered_packet = packet.model_copy(update={"metered_mw": 99.0, "nonce": "nonce-new-999"})
    valid_tamper, tamper_msg = verify_telemetry_packet(tampered_packet, seen_nonces, current_step=3)
    assert valid_tamper is False
    assert "Cryptographic" in tamper_msg

    # 4. Stale step is rejected
    stale_packet = sign_telemetry_packet(agent_id="water", step=1, metered_mw=10.0, nonce="nonce-stale-1")
    valid_stale, stale_msg = verify_telemetry_packet(stale_packet, seen_nonces, current_step=5)
    assert valid_stale is False
    assert "Stale" in stale_msg


def test_cross_utility_auditor():
    # Downstream hospital claims full 25 MW when upstream water is almost completely unserved
    telemetry = {"water": 1.0, "hospital": 25.0}
    demands = {"water": 20.0, "hospital": 25.0}

    discrepancies = CrossUtilityAuditor.audit_consistency(telemetry, demands, threshold=0.25)
    assert len(discrepancies) > 0
    assert discrepancies[0]["upstream_agent"] == "water"
    assert discrepancies[0]["dependent_agent"] == "hospital"


def test_verification_api_endpoints():
    sim_ctrl.verification_mgr.record_verification(
        step=1,
        agent_id="hospital",
        status="VERIFIED",
        v_type="BID_ENVELOPE",
        detail="Within bounds",
    )

    data = get_verification_status()
    assert "statuses" in data
    assert "total_verifications" in data

    hist = get_verification_history(agent_id="hospital")
    assert "records" in hist
    assert len(hist["records"]) > 0
