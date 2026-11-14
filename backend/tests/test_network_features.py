"""
Unit & Hypothesis Tests for Feature 2: Network-Aware Feasibility
================================================================
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.analytics.baselines import ProportionalBaseline, StrictPriorityBaseline
from app.api.routes import get_network_state, get_network_topology
from app.negotiation.messages import BidMessage, SegmentBid
from app.network.constraints import (
    build_network_line_constraints,
    check_network_violations,
    project_to_network_feasible,
)
from app.network.topology import NetworkTopology
from app.optimization.pipeline import OptimizationPipeline
from app.optimization.validator import AllocationValidator
from app.simulation.runner import SimulationRunner


def test_network_topology_loading_and_validation():
    topology = NetworkTopology()
    assert len(topology.feeders) == 3
    assert "feeder_1" in topology.feeders
    assert "feeder_2" in topology.feeders
    assert "feeder_3" in topology.feeders

    # All agents mapped to exactly one feeder
    for aid in ["hospital", "water", "emergency", "telecom", "residential"]:
        assert topology.get_feeder_for_agent(aid) is not None

    # Test dynamic derate and restore
    f1 = topology.derate_feeder("feeder_1", 20.0)
    assert f1.current_capacity_mw == 20.0
    assert f1.derated is True

    topology.restore_feeder("feeder_1")
    assert f1.current_capacity_mw == f1.nominal_capacity_mw
    assert f1.derated is False


def test_pipeline_respects_derated_feeder_capacity():
    topology = NetworkTopology()
    # Derate Feeder 1 (North Feeder: Hospital + Water) down to 15.0 MW
    topology.derate_feeder("feeder_1", 15.0)

    pipeline = OptimizationPipeline()
    bids = {
        "hospital": BidMessage(
            bid_id="h1",
            agent_id="hospital",
            env_version=1,
            bid_version=1,
            requested_mw=25.0,
            min_acceptable_mw=6.0,
            segments=[SegmentBid(name="h-crit", capacity_mw=25.0, marginal_value=500.0, requested_mw=25.0)],
            criticality=1.0,
            urgency=0.6,
            max_concession=0.1,
            reason="Hospital crisis load",
        ),
        "water": BidMessage(
            bid_id="w1",
            agent_id="water",
            env_version=1,
            bid_version=1,
            requested_mw=20.0,
            min_acceptable_mw=4.0,
            segments=[SegmentBid(name="w-crit", capacity_mw=20.0, marginal_value=400.0, requested_mw=20.0)],
            criticality=0.9,
            urgency=0.5,
            max_concession=0.1,
            reason="Water crisis load",
        ),
        "residential": BidMessage(
            bid_id="r1",
            agent_id="residential",
            env_version=1,
            bid_version=1,
            requested_mw=25.0,
            min_acceptable_mw=2.0,
            segments=[SegmentBid(name="res", capacity_mw=25.0, marginal_value=50.0, requested_mw=25.0)],
            criticality=0.5,
            urgency=0.2,
            max_concession=0.4,
            reason="Domestic load",
        ),
    }

    mins = {aid: b.min_acceptable_mw for aid, b in bids.items()}
    crits = {aid: b.criticality for aid, b in bids.items()}

    res = pipeline.solve(
        bids=bids,
        supply_mw=60.0,
        env_version=1,
        minimums=mins,
        criticalities=crits,
        topology=topology,
    )

    alloc_h = res.allocations["hospital"].allocated_mw
    alloc_w = res.allocations["water"].allocated_mw
    loss_factor = topology.feeders["feeder_1"].loss_factor
    f1_flow = (alloc_h + alloc_w) / (1.0 - loss_factor)

    # Must not violate derated capacity of 15.0 MW
    assert f1_flow <= 15.0 + 1e-4

    # Validator checks line feasibility
    val_res = AllocationValidator.validate_allocation(
        allocations=res.allocations,
        bids=bids,
        supply_mw=60.0,
        expected_env_version=1,
        minimums=mins,
        topology=topology,
    )
    assert val_res.valid is True
    assert len(val_res.errors) == 0


def test_baseline_projection_respects_feeder_limits():
    topology = NetworkTopology()
    topology.derate_feeder("feeder_1", 12.0)

    raw_allocs = {"hospital": 15.0, "water": 10.0, "residential": 20.0}
    projected = project_to_network_feasible(raw_allocs, topology)

    violations = check_network_violations(projected, topology)
    assert len(violations) == 0
    assert projected["hospital"] + projected["water"] <= 12.0 * (1.0 - topology.feeders["feeder_1"].loss_factor) + 1e-4


@settings(max_examples=100, deadline=None)
@given(
    alloc_h=st.floats(min_value=0.0, max_value=30.0),
    alloc_w=st.floats(min_value=0.0, max_value=30.0),
    alloc_e=st.floats(min_value=0.0, max_value=20.0),
    alloc_t=st.floats(min_value=0.0, max_value=15.0),
    alloc_r=st.floats(min_value=0.0, max_value=40.0),
    derate_cap=st.floats(min_value=5.0, max_value=40.0),
)
def test_hypothesis_zero_network_violations_after_projection(
    alloc_h, alloc_w, alloc_e, alloc_t, alloc_r, derate_cap
):
    """Property-based verification: projection guarantees 0 line violations for any arbitrary allocations."""
    topology = NetworkTopology()
    topology.derate_feeder("feeder_1", derate_cap)

    allocs = {
        "hospital": alloc_h,
        "water": alloc_w,
        "emergency": alloc_e,
        "telecom": alloc_t,
        "residential": alloc_r,
    }

    projected = project_to_network_feasible(allocs, topology)
    violations = check_network_violations(projected, topology)
    assert len(violations) == 0, f"Line violations found after projection: {violations}"


def test_feeder_derate_scenario_run():
    runner = SimulationRunner(seed=42)
    step_records, metrics = runner.run_strategy("proposed", scenario="feeder_derate", horizon_steps=8)
    assert len(step_records) == 8
    assert metrics.capacity_violations == 0


def test_network_api_endpoints():
    data_top = get_network_topology()
    assert "feeders" in data_top
    assert len(data_top["feeders"]) == 3

    data_state = get_network_state()
    assert "feeders" in data_state
    for f in data_state["feeders"]:
        assert "utilization_pct" in f
        assert "is_congested" in f
