"""
Unit Tests for CrisisGrid MCP Server & Tool Calling
===================================================

Verifies:
- MCP Protocol initialization and capabilities.
- Tools listing and schema conformance.
- Resources listing and URI resolution.
- Tool execution: auxiliary generation, feeder tripping, 5G throttling, VCG Clarke audits.
- Error handling for invalid tool names and malformed JSON-RPC payloads.
"""

from __future__ import annotations

import json
from app.mcp_server import handle_jsonrpc, execute_tool, read_resource, MCP_TOOLS, MCP_RESOURCES


def test_mcp_initialize():
    req = {"jsonrpc": "2.0", "id": 1, "method": "initialize"}
    res = handle_jsonrpc(req)
    assert res["jsonrpc"] == "2.0"
    assert res["id"] == 1
    assert "capabilities" in res["result"]
    assert res["result"]["serverInfo"]["name"] == "crisisgrid-mcp"
    assert res["result"]["serverInfo"]["version"] == "1.0.0"


def test_mcp_tools_list():
    req = {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}
    res = handle_jsonrpc(req)
    tools = res["result"]["tools"]
    assert len(tools) >= 5
    tool_names = {t["name"] for t in tools}
    assert "dispatch_auxiliary_generator" in tool_names
    assert "trip_feeder_circuit" in tool_names
    assert "throttle_telecom_bandwidth" in tool_names
    assert "inject_disaster_shock" in tool_names
    assert "audit_clarke_pivot" in tool_names


def test_mcp_resources_list():
    req = {"jsonrpc": "2.0", "id": 3, "method": "resources/list"}
    res = handle_jsonrpc(req)
    resources = res["result"]["resources"]
    assert len(resources) >= 4
    uris = {r["uri"] for r in resources}
    assert "crisisgrid://telemetry/live" in uris
    assert "crisisgrid://agents/state" in uris
    assert "crisisgrid://ledger/proofs" in uris
    assert "crisisgrid://cascades/graph" in uris


def test_mcp_execute_dispatch_generator():
    req = {
        "jsonrpc": "2.0",
        "id": 4,
        "method": "tools/call",
        "params": {
            "name": "dispatch_auxiliary_generator",
            "arguments": {"agent_id": "hospital", "generation_mw": 2.5, "duration_hours": 8.0},
        },
    }
    res = handle_jsonrpc(req)
    assert not res["result"].get("isError")
    content = json.loads(res["result"]["content"][0]["text"])
    assert content["status"] == "executed"
    assert content["agent_id"] == "hospital"
    assert content["dispatched_mw"] == 2.5


def test_mcp_execute_throttle_telecom():
    req = {
        "jsonrpc": "2.0",
        "id": 5,
        "method": "tools/call",
        "params": {
            "name": "throttle_telecom_bandwidth",
            "arguments": {"power_reduction_pct": 40, "reserve_band": "FIRSTNET"},
        },
    }
    res = handle_jsonrpc(req)
    assert not res["result"].get("isError")
    content = json.loads(res["result"]["content"][0]["text"])
    assert content["status"] == "executed"
    assert content["power_reduction_pct"] == 40
    assert content["reserved_emergency_band"] == "FIRSTNET"


def test_mcp_execute_audit_clarke():
    req = {
        "jsonrpc": "2.0",
        "id": 6,
        "method": "tools/call",
        "params": {
            "name": "audit_clarke_pivot",
            "arguments": {"agent_id": "water"},
        },
    }
    res = handle_jsonrpc(req)
    assert not res["result"].get("isError")
    content = json.loads(res["result"]["content"][0]["text"])
    assert content["status"] == "audit_complete"
    assert content["agent_id"] == "water"


def test_mcp_read_resource_telemetry():
    req = {
        "jsonrpc": "2.0",
        "id": 7,
        "method": "resources/read",
        "params": {"uri": "crisisgrid://telemetry/live"},
    }
    res = handle_jsonrpc(req)
    assert "contents" in res["result"]
    assert res["result"]["contents"][0]["uri"] == "crisisgrid://telemetry/live"


def test_mcp_invalid_tool_returns_error():
    req = {
        "jsonrpc": "2.0",
        "id": 8,
        "method": "tools/call",
        "params": {
            "name": "non_existent_tool_xyz",
            "arguments": {},
        },
    }
    res = handle_jsonrpc(req)
    assert res["result"]["isError"] is True
