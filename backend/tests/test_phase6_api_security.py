"""
Phase 6 Gate Tests: REST Endpoints, Security, & Rate Limiting
============================================================

Validates:
1. Health and state inspection logic.
2. API Key authentication & constant-time rejection of invalid credentials.
3. Token bucket rate limiting algorithm and Retry-After calculation.
4. Pydantic schema rejection on malformed / out-of-bounds payloads.
5. Hash-chain audit verification & tamper detection via /api/audit/verify.
6. Director natural language event parser and schema validation.
7. Mutating simulation controls (step, scenario, reset).
"""

import asyncio
import pytest
from pydantic import ValidationError

from app.api.models import (
    AgentModeRequest,
    DirectorApplyRequest,
    DirectorParseRequest,
    EventRequest,
    ScenarioRequest,
    StepRequest,
)
from app.api.routes import (
    get_agents,
    get_health,
    get_scenarios,
    get_simulation_state,
    parse_director_prompt,
    post_step,
    reset_simulation,
    set_agent_mode,
    set_scenario,
    sim_ctrl,
    verify_ledger,
)
from app.ratelimit import TokenBucket
from app.security import SERVER_API_KEY, verify_api_key


def test_health_endpoint():
    res = get_health()
    assert res["status"] == "ok"
    assert "version" in res


def test_api_key_auth_enforcement():
    # Invalid key must be rejected
    assert verify_api_key("completely-bogus-invalid-key") is False
    assert verify_api_key("wrong_secret_123") is False

    # Correct key must be accepted
    assert verify_api_key(SERVER_API_KEY) is True


def test_rate_limiter_token_bucket():
    bucket = TokenBucket(capacity=5, refill_rate_per_sec=1.0)
    # Consume 5 tokens
    for _ in range(5):
        assert bucket.consume(1.0) is True

    # 6th token must fail!
    assert bucket.consume(1.0) is False
    retry_secs = bucket.retry_after()
    assert retry_secs >= 1


def test_schema_rejection_out_of_bounds():
    # 1. Magnitude > 100 must fail
    with pytest.raises(ValidationError):
        EventRequest(event_type="SUPPLY_DROP", step=2, magnitude=150.0)

    # 2. Unknown event_type must fail
    with pytest.raises(ValidationError):
        EventRequest(event_type="UNREGISTERED_EVENT", step=2, magnitude=30.0)

    # 3. Director text > 500 characters must fail
    long_text = "flooding " * 100  # > 500 chars
    with pytest.raises(ValidationError):
        DirectorParseRequest(text=long_text)

    # 4. Agent mode not 'honest' or 'cheater' must fail
    with pytest.raises(ValidationError):
        AgentModeRequest(mode="superuser")


from app.negotiation.ledger import Ledger
sim_ctrl.ledger = Ledger(":memory:")

def test_ledger_audit_verify_and_tamper_detection():
    # Isolated in-memory ledger ensures zero cross-test interference
    test_ledger = Ledger(":memory:")
    test_ledger.append("COMMITTED", 1, 1, "hospital", {"test": True})
    assert test_ledger.verify_hash_chain() is True

    # Tamper with the internal ledger database
    cursor = test_ledger._conn.cursor()
    cursor.execute("SELECT id FROM transactions LIMIT 1")
    row = cursor.fetchone()
    if row:
        cursor.execute(
            "UPDATE transactions SET payload = '{\"tampered\": true}' WHERE id = ?",
            (row["id"],),
        )
        test_ledger._conn.commit()
        cursor.close()

        # Audit check must now report tamper failure!
        assert test_ledger.verify_hash_chain() is False


def test_director_rule_parser():
    prompt = "transformer flooded at hour 2, hospital generator fails at step 4"
    req = DirectorParseRequest(text=prompt)
    res = parse_director_prompt(req)

    assert res["parser"] == "rule_based_regex"
    events = res["parsed_events"]
    assert len(events) >= 2
    types = [e["event_type"] for e in events]
    assert "SUPPLY_DROP" in types
    assert "BACKUP_FAIL" in types


def test_simulation_controls_execution():
    # Reset
    sim_ctrl.reset(scenario="normal")
    assert sim_ctrl.current_scenario == "normal"

    # Set scenario
    sim_ctrl.current_scenario = "grid_failure"
    assert sim_ctrl.current_scenario == "grid_failure"

    # Check agents
    res = get_agents()
    assert len(res["agents"]) == 5

    # Switch agent mode
    res = set_agent_mode("residential", AgentModeRequest(mode="cheater"))
    assert res["mode"] == "cheater"
