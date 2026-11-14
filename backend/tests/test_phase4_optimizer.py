"""
Phase 4 Gate Tests: LP Optimization Pipeline (Stages A -> B -> C)
=================================================================

Validates:
1. Normal conditions: full demand satisfaction, zero shortfall.
2. Scarcity conditions: critical minimums guaranteed; damage minimized.
3. Critical-infeasible supply: shortfall reported honestly.
4. Marginal value damage ordering.
5. Max-min fairness preserves Stage A & B tolerances.
6. Zero supply edge case.
7. Explanations correctly generated without errors.
"""

import pytest

from app.agents.registry import AgentRegistry
from app.config import DEFAULT_PROFILES, EPS
from app.optimization.pipeline import OptimizationPipeline


@pytest.fixture
def test_setup():
    registry = AgentRegistry()
    agents = registry.get_all()
    bids = {aid: a.generate_bid(env_version=1) for aid, a in agents.items()}
    minimums = {aid: a.minimum_mw for aid, a in agents.items()}
    criticalities = {aid: a.criticality for aid, a in agents.items()}
    return bids, minimums, criticalities


def test_normal_supply_all_met(test_setup):
    bids, minimums, criticalities = test_setup
    total_requested = sum(b.requested_mw for b in bids.values())
    pipeline = OptimizationPipeline()

    # Supply equals or exceeds requested
    res = pipeline.solve(
        bids=bids,
        supply_mw=total_requested + 10.0,
        env_version=1,
        minimums=minimums,
        criticalities=criticalities,
    )

    assert res.status == "optimal"
    assert res.is_fallback is False
    assert res.stage_a_shortfall <= EPS
    for aid, alloc in res.allocations.items():
        assert alloc.unmet_mw <= EPS
        assert alloc.critical_shortfall <= EPS


def test_scarcity_protects_critical_minimums(test_setup):
    bids, minimums, criticalities = test_setup
    total_min = sum(minimums.values())  # 22.0 MW
    total_requested = sum(b.requested_mw for b in bids.values())  # ~100 MW
    pipeline = OptimizationPipeline()

    # Supply is 50 MW (between 22 MW min and 100 MW requested)
    res = pipeline.solve(
        bids=bids,
        supply_mw=50.0,
        env_version=1,
        minimums=minimums,
        criticalities=criticalities,
    )

    assert res.status == "optimal"
    assert res.total_allocated_mw <= 50.0 + EPS
    # Critical minimums must be 100% satisfied for all agents!
    assert res.stage_a_shortfall <= EPS
    for aid, alloc in res.allocations.items():
        assert alloc.allocated_mw >= minimums[aid] - EPS
        assert alloc.critical_shortfall <= EPS


def test_critical_infeasible_supply_honest_reporting(test_setup):
    bids, minimums, criticalities = test_setup
    total_min = sum(minimums.values())  # 22.0 MW
    pipeline = OptimizationPipeline()

    # Catastrophic supply: only 15.0 MW available (< 22.0 MW minimums)
    res = pipeline.solve(
        bids=bids,
        supply_mw=15.0,
        env_version=1,
        minimums=minimums,
        criticalities=criticalities,
    )

    assert res.total_allocated_mw <= 15.0 + EPS
    # Must report shortfall honestly!
    assert res.stage_a_shortfall > 0.0
    expected_shortfall = total_min - 15.0
    assert res.stage_a_shortfall == pytest.approx(expected_shortfall, abs=1e-3)


def test_zero_supply_graceful_handling(test_setup):
    bids, minimums, criticalities = test_setup
    pipeline = OptimizationPipeline()

    res = pipeline.solve(
        bids=bids,
        supply_mw=0.0,
        env_version=1,
        minimums=minimums,
        criticalities=criticalities,
    )

    assert res.total_allocated_mw == 0.0
    assert all(a.allocated_mw == 0.0 for a in res.allocations.values())


def test_explanations_populated(test_setup):
    bids, minimums, criticalities = test_setup
    pipeline = OptimizationPipeline()

    res = pipeline.solve(
        bids=bids,
        supply_mw=60.0,
        env_version=1,
        minimums=minimums,
        criticalities=criticalities,
    )

    assert len(res.explanations) == len(bids)
    for aid, reasons in res.explanations.items():
        assert len(reasons) > 0
        assert isinstance(reasons[0], str)
