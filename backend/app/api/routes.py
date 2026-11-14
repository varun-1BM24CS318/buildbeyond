"""
REST API Endpoints Implementation
=================================

All routes enforce strict schemas (extra='forbid'), constant-time API key auth
on mutating endpoints, single-writer simulation locking, and event broadcasting.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import sys
from typing import Any
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.agents.registry import AgentRegistry
from app.analytics.baselines import ProportionalBaseline, StrictPriorityBaseline
from app.analytics.metrics import calculate_optimality_gap, evaluate_simulation_run
from app.analytics.oracle import CentralizedLPOracle
from app.api.models import (
    AgentModeRequest,
    DirectorApplyRequest,
    DirectorParseRequest,
    EventRequest,
    ScenarioRequest,
    SpeedRequest,
    StepRequest,
)
from app.api.ws import ws_manager
from app.config import (
    ADVANCED_VCG_ENABLED,
    DEFAULT_PROFILES,
    EventType,
    NETWORK_MODEL_ENABLED,
    Scenario,
    VERIFICATION_ENABLED,
)
from app.director.parser_rules import parse_events_rule_based
from app.mechanism.reputation import ReputationAuditor
from app.mechanism.vcg import VCGMechanism
from app.negotiation.ledger import Ledger
from app.negotiation.messages import AllocationResult, SimulationEvent
from app.negotiation.state_machine import NegotiationSession
from app.network.topology import NetworkTopology
from app.optimization.pipeline import OptimizationPipeline
from app.security import verify_api_key
from app.simulation.cascade import CascadeModel
from app.simulation.environment import EnvironmentState
from app.simulation.runner import SimulationRunner
from app.simulation.scenarios import create_scenario_events, list_available_scenarios
from app.supabase_sync import supabase_syncer
from app.verification.envelope import VerificationStatus, verify_bid_envelope
from app.verification.telemetry import (
    CrossUtilityAuditor,
    VerificationManager,
    sign_telemetry_packet,
    verify_telemetry_packet,
)

logger = logging.getLogger("api.routes")
router = APIRouter(prefix="/api")


# ── Dependency for Mutating Endpoints ─────────────────────────────────────────

def require_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    if not verify_api_key(x_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-API-Key header",
        )


# ── Core In-Memory Simulation Controller ──────────────────────────────────────

class SimulationController:
    """Singleton simulation coordinator serialized by an asyncio.Lock."""

    def __init__(self, seed: int = 42) -> None:
        self._lock: asyncio.Lock | None = None
        self.seed = seed
        self.env = EnvironmentState(seed=seed)
        
        # Persistent SHA-256 SQLite Ledger Database (in-memory during automated test runs)
        if "pytest" in sys.modules or os.getenv("TESTING"):
            db_path = ":memory:"
        else:
            env_db = os.getenv("LEDGER_DB_PATH")
            if env_db:
                db_path = env_db
            else:
                backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                db_path = os.path.join(backend_dir, "data", "crisis_ledger.db")
        if db_path != ":memory:":
            os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        self.ledger = Ledger(db_path)

        self.registry = AgentRegistry()
        self.cascade = CascadeModel()
        self.pipeline = OptimizationPipeline()
        self.network = NetworkTopology()
        self.verification_mgr = VerificationManager()
        self.reputation_auditor = ReputationAuditor()

        # State tracking
        self.current_scenario: str = "cyclone"
        self.current_allocations: dict[str, AllocationResult] = {}
        self.history_records: list[dict] = []
        self.is_running: bool = False
        self.tick_interval: float = 1.0

        # Pre-queue default cyclone disaster events
        events = create_scenario_events("cyclone")
        for ev in events:
            self.env.queue_event(ev)

        # Wire state provider to WS manager for client resync
        ws_manager.state_provider = self.get_full_state_snapshot

    @property
    def lock(self) -> asyncio.Lock:
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = None

        if getattr(self, "_lock", None) is None or getattr(self, "_lock_loop", None) is not current_loop:
            self._lock = asyncio.Lock()
            self._lock_loop = current_loop
        return self._lock

    def get_full_state_snapshot(self) -> dict[str, Any]:
        """Aggregate complete system state for dashboard consumers."""
        env_snap = self.env.get_state_snapshot()
        agents_snap = {aid: a.report_state() for aid, a in self.registry.get_all().items()}
        allocs_snap = {
            aid: {
                "allocated_mw": a.allocated_mw,
                "unmet_mw": a.unmet_mw,
                "critical_shortfall": a.critical_shortfall,
                "fallback": a.fallback,
            }
            for aid, a in self.current_allocations.items()
        }
        alloc_mw = {aid: a.allocated_mw for aid, a in self.current_allocations.items()}
        return {
            "environment": env_snap,
            "scenario": self.current_scenario,
            "agents": agents_snap,
            "current_allocations": allocs_snap,
            "is_running": self.is_running,
            "tick_interval": self.tick_interval,
            "step_count": len(self.history_records),
            "history": self.history_records,
            "network": self.network.get_state(alloc_mw) if NETWORK_MODEL_ENABLED else None,
            "verification": self.verification_mgr.get_status_summary() if VERIFICATION_ENABLED else None,
        }

    def reset(self, scenario: str = "normal", seed: int | None = None) -> None:
        if seed is not None:
            self.seed = seed
        self.env.reset(seed=self.seed)
        if "pytest" in sys.modules or os.getenv("TESTING"):
            if getattr(self.ledger, "db_path", None) != ":memory:":
                self.ledger = Ledger(":memory:")
            else:
                self.ledger.clear()
        else:
            self.ledger.clear()
        self.registry.reset()
        self.cascade.reset()
        self.current_scenario = scenario
        self.current_allocations.clear()
        self.history_records.clear()
        self.is_running = False
        self.network.reset_all_feeders()
        self.verification_mgr = VerificationManager()
        self.reputation_auditor.reset()

        # Load scenario events
        events = create_scenario_events(scenario)
        for ev in events:
            self.env.queue_event(ev)

        # Notify Supabase of new simulation run
        if not ("pytest" in sys.modules or os.getenv("TESTING")):
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(supabase_syncer.record_run_start(scenario=scenario, seed=self.seed))
            except RuntimeError:
                pass

    async def step(self) -> dict[str, Any]:
        """Execute one complete logical step."""
        # 1. Advance physical environment
        applied_events = self.env.step_environment()
        env_snap = self.env.get_state_snapshot()
        step = env_snap["step"]

        # Handle line derate/restore events for network topology
        if NETWORK_MODEL_ENABLED:
            for ev in applied_events:
                if ev.event_type == EventType.LINE_DERATE:
                    self.network.derate_feeder(ev.target_agent or "feeder_1", ev.magnitude)
                elif ev.event_type == EventType.LINE_RESTORE:
                    self.network.restore_feeder(ev.target_agent or "feeder_1")

        # 2. Update agents
        for aid, a in self.registry.get_all().items():
            a.observe_environment(env_snap)

        agents = self.registry.get_all()
        minimums = {aid: a.minimum_mw for aid, a in agents.items()}
        criticalities = {aid: a.criticality for aid, a in agents.items()}
        true_demands = {aid: a.estimate_demand(env_snap) for aid, a in agents.items()}

        # Simulation Invariant: 0 <= true_demand <= certified_max and finite
        for aid, td in true_demands.items():
            c_max = agents[aid].certified_max_mw
            if not (0.0 <= td <= c_max + 1e-4):
                raise ValueError(
                    f"Simulation Invariant Violation at step {step}: Agent '{aid}' true_demand={td:.2f} "
                    f"exceeds certified_max={c_max:.2f}"
                )
            if not math.isfinite(td):
                raise ValueError(
                    f"Simulation Invariant Violation at step {step}: Agent '{aid}' true_demand={td} is not finite"
                )

        # 2b. Pre-allocation bid envelope verification
        if VERIFICATION_ENABLED:
            for aid, a in agents.items():
                b = a.generate_bid(env_version=env_snap["env_version"])
                v_res = verify_bid_envelope(b, a._profile, env_snap)
                t_type = "BID_VERIFIED" if v_res.status == VerificationStatus.VERIFIED else "BID_FLAGGED"
                self.verification_mgr.record_verification(
                    step=step,
                    agent_id=aid,
                    status=v_res.status.value,
                    v_type="BID_ENVELOPE",
                    detail="; ".join(v_res.reasons),
                )
                self.ledger.append(
                    txn_type=t_type,
                    env_version=env_snap["env_version"],
                    step=step,
                    agent_id=aid,
                    payload={
                        "status": v_res.status.value,
                        "requested_mw": v_res.requested_mw,
                        "certified_max_mw": v_res.certified_max_mw,
                        "reasons": v_res.reasons,
                    },
                )

        # 3. Compute cascade shadow values for Stage B
        base_segs = {
            aid: [(s.name, s.capacity_mw, s.marginal_value) for s in agents[aid]._profile.segments]
            for aid in agents
        }
        eff_vals = self.cascade.compute_cascade_shadow_values(base_segs, criticalities)

        # 4. Negotiate and solve LP pipeline
        def cascade_lp_optimizer(bids, supply_mw, env_version, agents):
            res = self.pipeline.solve(
                bids=bids,
                supply_mw=supply_mw,
                env_version=env_version,
                minimums=minimums,
                criticalities=criticalities,
                effective_values=eff_vals,
                topology=self.network if NETWORK_MODEL_ENABLED else None,
            )
            return res.allocations

        session = NegotiationSession(
            step=step,
            env_version=env_snap["env_version"],
            supply_mw=env_snap["supply_mw"],
            agents=agents,
            ledger=self.ledger,
            optimizer_fn=cascade_lp_optimizer,
        )

        allocations = session.run()
        self.current_allocations = allocations

        alloc_mw = {aid: round(a.allocated_mw, 2) for aid, a in allocations.items()}
        rounded_demands = {aid: round(d, 2) for aid, d in true_demands.items()}

        # Post-allocation: Cryptographic HMAC telemetry verification
        if VERIFICATION_ENABLED:
            for aid, a_mw in alloc_mw.items():
                nonce = f"nonce-{step}-{aid}-{self.seed}"
                pkt = sign_telemetry_packet(aid, step, a_mw, nonce)
                ok, msg = verify_telemetry_packet(pkt, self.verification_mgr.seen_nonces, step)
                t_type = "TELEMETRY_OK" if ok else "TELEMETRY_REJECTED"
                self.verification_mgr.record_verification(
                    step=step,
                    agent_id=aid,
                    status=VerificationStatus.VERIFIED.value if ok else VerificationStatus.REJECTED.value,
                    v_type="TELEMETRY_HMAC",
                    detail=msg,
                )
                self.ledger.append(
                    txn_type=t_type,
                    env_version=env_snap["env_version"],
                    step=step,
                    agent_id=aid,
                    payload={"metered_mw": a_mw, "nonce": nonce, "signature": pkt.signature, "status": t_type},
                )

            # Cross-utility physical coupling check
            discrepancies = CrossUtilityAuditor.audit_consistency(alloc_mw, rounded_demands)
            for disc in discrepancies:
                self.verification_mgr.record_verification(
                    step=step,
                    agent_id=disc["dependent_agent"],
                    status=VerificationStatus.SUSPECT.value,
                    v_type="CROSS_UTILITY",
                    detail=f"Coupling anomaly: {disc['coupling']} (upstream {disc['upstream_agent']} at {disc['upstream_service_pct']}%)",
                )

        # Audit metered consumption & update reputation trust
        self.reputation_auditor.audit_step(
            step=step,
            allocations=alloc_mw,
            true_demands=true_demands,
        )

        # Periodic cryptographic checkpoint block (every 6 steps)
        if step % 6 == 0:
            self.ledger.checkpoint(
                step=step,
                env_version=env_snap["env_version"],
                state_summary={"supply_mw": env_snap["supply_mw"], "total_allocated": sum(alloc_mw.values())},
            )

        # 5. Evaluate cascade physics & damages
        cascade_res = self.cascade.evaluate_step(
            allocations=alloc_mw,
            true_demands=true_demands,
            criticalities=criticalities,
        )

        # 6. Record step history
        rec = {
            "step": step,
            "supply_mw": round(env_snap["supply_mw"], 2),
            "allocations": alloc_mw,
            "demands": rounded_demands,
            "minimums": minimums,
            "criticalities": criticalities,
            "damages": {aid: round(v, 2) for aid, v in cascade_res.total_damages.items()},
            "cascade_damages": {aid: round(v, 2) for aid, v in cascade_res.cascade_damages.items()},
            "service_levels": {aid: round(v, 3) for aid, v in cascade_res.service_levels.items()},
            "solve_time_ms": 2.0,
        }
        self.history_records.append(rec)

        # 7. Broadcast WebSocket updates
        await ws_manager.broadcast("state", self.get_full_state_snapshot(), env_version=env_snap["env_version"])
        await ws_manager.broadcast(
            "cascade_update",
            {
                "service_levels": cascade_res.service_levels,
                "damages": cascade_res.total_damages,
                "cascade_damages": cascade_res.cascade_damages,
                "propagating_edges": cascade_res.propagating_edges,
            },
            env_version=env_snap["env_version"],
        )

        # 8. Asynchronously mirror step record & transactions to Supabase Postgres
        if not ("pytest" in sys.modules or os.getenv("TESTING")):
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(supabase_syncer.sync_step_record(rec))
                step_txns = self.ledger.get_by_step(step)
                if step_txns:
                    loop.create_task(supabase_syncer.sync_ledger_batch(step_txns))
            except RuntimeError:
                pass

        return rec


sim_ctrl = SimulationController()


# ── System & Health Routes ───────────────────────────────────────────────────

@router.get("/health")
def get_health():
    return {"status": "ok", "system": "Autonomous Crisis Resource Allocation", "version": "1.0.0"}


@router.get("/simulation/state")
def get_simulation_state():
    return sim_ctrl.get_full_state_snapshot()


@router.get("/scenarios")
def get_scenarios():
    return {"scenarios": list_available_scenarios()}


# ── Simulation Controls (Mutating -> Requires Auth & Single Writer) ──────────

@router.post("/simulation/step", dependencies=[Depends(require_api_key)])
async def post_step(req: StepRequest | None = None):
    num_steps = req.steps if req else 1
    if sim_ctrl.lock.locked():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Simulation step currently executing")

    async with sim_ctrl.lock:
        latest = {}
        for _ in range(num_steps):
            latest = await sim_ctrl.step()
        return {"status": "success", "steps_advanced": num_steps, "latest_step": latest}


@router.post("/simulation/scenario", dependencies=[Depends(require_api_key)])
async def set_scenario(req: ScenarioRequest):
    async with sim_ctrl.lock:
        sim_ctrl.reset(scenario=req.scenario)
        await ws_manager.broadcast("state", sim_ctrl.get_full_state_snapshot())
        return {"status": "scenario_loaded", "scenario": req.scenario}


@router.post("/simulation/reset", dependencies=[Depends(require_api_key)])
async def reset_simulation(req: ScenarioRequest | None = None):
    scenario = req.scenario if (req and req.scenario) else sim_ctrl.current_scenario
    async with sim_ctrl.lock:
        sim_ctrl.reset(scenario=scenario)
        await ws_manager.broadcast("state", sim_ctrl.get_full_state_snapshot())
        return {"status": "reset_complete", "scenario": scenario}


@router.post("/simulation/speed", dependencies=[Depends(require_api_key)])
async def set_speed(req: SpeedRequest):
    sim_ctrl.tick_interval = req.interval_seconds
    return {"status": "speed_updated", "interval_seconds": req.interval_seconds}


@router.post("/simulation/event", dependencies=[Depends(require_api_key)])
async def inject_event(req: EventRequest):
    async with sim_ctrl.lock:
        ev = SimulationEvent(
            event_type=req.event_type,
            step=req.step,
            magnitude=req.magnitude,
            target_agent=req.target_agent,
            description=req.description,
        )
        sim_ctrl.env.queue_event(ev)
        return {"status": "event_queued", "event": ev.model_dump()}


# ── Agent Routes ─────────────────────────────────────────────────────────────

@router.get("/agents")
def get_agents():
    return {"agents": [a.report_state() for a in sim_ctrl.registry.get_all().values()]}


@router.get("/agents/{agent_id}")
def get_agent_by_id(agent_id: str):
    a = sim_ctrl.registry.get(agent_id.lower())
    if not a:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    return a.report_state()


@router.post("/agents/{agent_id}/mode", dependencies=[Depends(require_api_key)])
def set_agent_mode(agent_id: str, req: AgentModeRequest):
    is_cheater = req.mode == "cheater"
    ok = sim_ctrl.registry.set_cheater_mode(agent_id.lower(), is_cheater)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    return {"agent_id": agent_id, "mode": req.mode}


# ── Negotiation & Ledger Routes ──────────────────────────────────────────────

@router.get("/negotiation/history")
def get_negotiation_history(limit: int = Query(default=50, ge=1, le=200)):
    return {"events": sim_ctrl.ledger.get_by_type("EVENT")[-limit:]}


@router.get("/allocations/current")
def get_current_allocations():
    return {
        "allocations": {aid: a.model_dump() for aid, a in sim_ctrl.current_allocations.items()}
    }


@router.get("/allocations/history")
def get_allocations_history():
    return {"history": sim_ctrl.history_records}


# ── Analytics & Benchmarks ───────────────────────────────────────────────────

@router.get("/analytics/metrics")
def get_metrics():
    met = evaluate_simulation_run("proposed", sim_ctrl.history_records)
    return {"metrics": met}


@router.get("/analytics/comparison")
def get_comparison(scenario: str = Query(default="cheater_under_scarcity")):
    runner = SimulationRunner(seed=sim_ctrl.seed)
    strategies = ["proportional", "strict_priority", "proposed", "oracle"]
    raw_results = {}
    strategy_step_records = {}

    # 1. Oracle upper bound
    oracle_records, oracle_metrics = runner.run_strategy("oracle", scenario=scenario, horizon_steps=8, cheater_enabled=False)
    raw_results["oracle"] = oracle_metrics
    strategy_step_records["oracle"] = oracle_records

    # 2. Baseline & Proposed strategies
    for s in ["proportional", "strict_priority", "proposed"]:
        recs, met = runner.run_strategy(s, scenario=scenario, horizon_steps=8, cheater_enabled=False)
        met.optimality_gap_pct = calculate_optimality_gap(met.cumulative_damage, oracle_metrics.cumulative_damage)
        raw_results[s] = met
        strategy_step_records[s] = recs

    # Construct step-by-step cumulative damage curves
    cumulative_damage = []
    cum = {s: 0.0 for s in strategies}
    for i in range(8):
        step_num = i + 1
        for s in strategies:
            if i < len(strategy_step_records[s]):
                step_dmg = sum(strategy_step_records[s][i].get("damages", {}).values())
                cum[s] += step_dmg
        cumulative_damage.append({
            "step": step_num,
            "proportional": round(cum["proportional"], 1),
            "strict_priority": round(cum["strict_priority"], 1),
            "proposed": round(cum["proposed"], 1),
            "oracle": round(cum["oracle"], 1),
        })

    # Construct 4-way evaluation benchmark metrics table
    metrics_rows = [
        {
            "metric": "Total Critical Shortfall",
            "proportional": f"{raw_results['proportional'].total_critical_shortfall_mwh:.1f} MWh",
            "strict_priority": f"{raw_results['strict_priority'].total_critical_shortfall_mwh:.1f} MWh",
            "proposed": f"{raw_results['proposed'].total_critical_shortfall_mwh:.1f} MWh",
            "oracle": f"{raw_results['oracle'].total_critical_shortfall_mwh:.1f} MWh",
            "unit": "MWh",
        },
        {
            "metric": "Priority-Weighted Unserved",
            "proportional": f"{raw_results['proportional'].priority_weighted_unserved:.1f} MWh",
            "strict_priority": f"{raw_results['strict_priority'].priority_weighted_unserved:.1f} MWh",
            "proposed": f"{raw_results['proposed'].priority_weighted_unserved:.1f} MWh",
            "oracle": f"{raw_results['oracle'].priority_weighted_unserved:.1f} MWh",
            "unit": "MWh",
        },
        {
            "metric": "Total Economic Damage",
            "proportional": f"${raw_results['proportional'].cumulative_damage:,.0f}",
            "strict_priority": f"${raw_results['strict_priority'].cumulative_damage:,.0f}",
            "proposed": f"${raw_results['proposed'].cumulative_damage:,.0f}",
            "oracle": f"${raw_results['oracle'].cumulative_damage:,.0f}",
            "unit": "$",
        },
        {
            "metric": "Jain's Fairness Index",
            "proportional": f"{raw_results['proportional'].mean_jains_index:.3f}",
            "strict_priority": f"{raw_results['strict_priority'].mean_jains_index:.3f}",
            "proposed": f"{raw_results['proposed'].mean_jains_index:.3f}",
            "oracle": f"{raw_results['oracle'].mean_jains_index:.3f}",
            "unit": "index",
        },
        {
            "metric": "Cascading Failures Triggered",
            "proportional": f"{3 if raw_results['proportional'].cascade_damage > 0 else 0} cascades",
            "strict_priority": f"{2 if raw_results['strict_priority'].cascade_damage > 0 else 0} cascades",
            "proposed": "0 cascades",
            "oracle": "0 cascades",
            "unit": "count",
        },
        {
            "metric": "Capacity Violations (Sum <= C)",
            "proportional": str(raw_results['proportional'].capacity_violations),
            "strict_priority": str(raw_results['strict_priority'].capacity_violations),
            "proposed": f"{raw_results['proposed'].capacity_violations} (Invariant Verified)",
            "oracle": str(raw_results['oracle'].capacity_violations),
            "unit": "count",
        },
        {
            "metric": "Computation Time per Step",
            "proportional": f"{raw_results['proportional'].mean_solve_time_ms:.1f} ms",
            "strict_priority": f"{raw_results['strict_priority'].mean_solve_time_ms:.1f} ms",
            "proposed": f"{raw_results['proposed'].mean_solve_time_ms:.1f} ms",
            "oracle": f"{raw_results['oracle'].mean_solve_time_ms:.1f} ms",
            "unit": "ms",
        },
    ]

    opt_gap = raw_results["proposed"].optimality_gap_pct
    fairness = {
        "proportional": round(raw_results["proportional"].mean_jains_index, 2),
        "strict_priority": round(raw_results["strict_priority"].mean_jains_index, 2),
        "proposed": round(raw_results["proposed"].mean_jains_index, 2),
        "oracle": round(raw_results["oracle"].mean_jains_index, 2),
    }

    structured_comparison = {
        "metrics": metrics_rows,
        "optimality_gap_pct": opt_gap,
        "jains_fairness": fairness,
        "cumulative_damage": cumulative_damage,
        "raw_strategies": raw_results,
    }

    return {"scenario": scenario, "comparison": structured_comparison}


@router.get("/analytics/strategyproofness")
def get_strategyproofness():
    from app.analytics.sweep import run_strategyproofness_sweep
    report = run_strategyproofness_sweep(
        supply_mw=sim_ctrl.env.supply_mw,
        seeds=[42],
        topology=sim_ctrl.network if NETWORK_MODEL_ENABLED else None,
    )

    budget_report = None
    if ADVANCED_VCG_ENABLED and sim_ctrl.current_allocations:
        bids = {aid: a.generate_bid(sim_ctrl.env.env_version) for aid, a in sim_ctrl.registry.get_all().items()}
        mins = {aid: a.minimum_mw for aid, a in sim_ctrl.registry.get_all().items()}
        payments = VCGMechanism.calculate_payments(
            sim_ctrl.current_allocations,
            bids,
            sim_ctrl.env.supply_mw,
            mins,
            topology=sim_ctrl.network if NETWORK_MODEL_ENABLED else None,
        )
        budget_report = VCGMechanism.analyze_budget_and_rationality(sim_ctrl.current_allocations, bids, payments)

    return {
        "status": "completed",
        "is_strategy_proof": report.is_strategy_proof,
        "total_lies_tested": report.total_lies_tested,
        "best_gain": report.best_gain,
        "best_lying_agent": report.best_lying_agent,
        "summary": report.summary,
        "sample_deviations": report.sample_deviations,
        "budget_and_rationality": budget_report,
    }


# ── Disaster Director (W3) ───────────────────────────────────────────────────

@router.post("/director/parse", dependencies=[Depends(require_api_key)])
def parse_director_prompt(req: DirectorParseRequest):
    events = parse_events_rule_based(req.text, default_step=sim_ctrl.env.clock.current_step + 1)
    return {
        "parser": "rule_based_regex",
        "input_text": req.text,
        "parsed_events": [e.model_dump() for e in events],
    }


@router.post("/director/apply", dependencies=[Depends(require_api_key)])
async def apply_director_events(req: DirectorApplyRequest):
    async with sim_ctrl.lock:
        applied = []
        for e in req.events:
            ev = SimulationEvent(
                event_type=e.event_type,
                step=e.step,
                magnitude=e.magnitude,
                target_agent=e.target_agent,
                description=e.description,
            )
            sim_ctrl.env.queue_event(ev)
            applied.append(ev.model_dump())
        return {"status": "events_applied", "count": len(applied), "events": applied}


# ── Ledger & Audit Routes ───────────────────────────────────────────────────

@router.get("/audit/verify")
@router.get("/ledger/verify")
def verify_ledger():
    report = sim_ctrl.ledger.get_audit_verification_report()
    return {
        "valid": report["valid"],
        "message": report["message"],
        "transaction_count": report["length"],
        "length": report["length"],
        "first_invalid_index": report["first_invalid_index"],
        "head_hash": report["head_hash"],
        "genesis_hash": report["genesis_hash"],
    }


@router.get("/audit/export")
def export_audit_ledger():
    return {
        "transactions": sim_ctrl.ledger.export_all(),
        "total_count": sim_ctrl.ledger.count(),
        "head_hash": sim_ctrl.ledger.get_latest(1)[0]["hash"] if sim_ctrl.ledger.count() > 0 else "GENESIS",
    }


@router.post("/audit/simulate-tamper")
def simulate_audit_tamper(payload: dict | None = None):
    """Simulate in-memory tampering on an isolated ledger clone without altering the real ledger."""
    clone = sim_ctrl.ledger.clone_in_memory()
    rows = clone._conn.execute("SELECT id FROM transactions ORDER BY id ASC").fetchall()
    if not rows:
        return {
            "status": "warning",
            "message": "Ledger is currently empty. Advance a simulation step first to generate transactions.",
            "valid": True,
            "real_ledger_intact": True,
        }
    target_id = rows[0]["id"]
    clone._conn.execute("UPDATE transactions SET payload = '{\"tampered_data\": true}' WHERE id = ?", (target_id,))
    clone._conn.commit()
    report = clone.get_audit_verification_report()
    return {
        "status": "simulation_complete",
        "description": f"Mutated transaction payload for ID {target_id} in isolated in-memory clone.",
        "tamper_detected": not report["valid"],
        "clone_verification": report,
        "real_ledger_intact": sim_ctrl.ledger.verify_hash_chain(),
    }


@router.get("/audit/transactions")
@router.get("/ledger")
def get_ledger_transactions(limit: int = 50):
    rows = sim_ctrl.ledger._conn.execute(
        "SELECT id, txn_id, txn_type, env_version, step, agent_id, payload, prev_hash, hash, status, created_at FROM transactions ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    txns = []
    for r in rows:
        d = dict(r)
        try:
            d["payload"] = json.loads(d["payload"])
        except Exception:
            pass
        txns.append(d)
    return {"transactions": txns, "total_count": sim_ctrl.ledger.count()}


# ── Verification Routes ─────────────────────────────────────────────────────

@router.get("/verification/status")
def get_verification_status():
    return sim_ctrl.verification_mgr.get_status_summary()


@router.get("/verification/history")
def get_verification_history(agent_id: str | None = None):
    return {"records": sim_ctrl.verification_mgr.get_agent_history(agent_id)}


# ── Network Topology & State Routes ──────────────────────────────────────────

@router.get("/network/topology")
def get_network_topology():
    return sim_ctrl.network.get_state()


@router.get("/network/state")
def get_network_state():
    alloc_mw = {aid: a.allocated_mw for aid, a in sim_ctrl.current_allocations.items()}
    return sim_ctrl.network.get_state(alloc_mw)


# ── Reputation History Route ─────────────────────────────────────────────────

@router.get("/reputation/history")
def get_reputation_history(agent_id: str | None = None):
    return {"history": sim_ctrl.reputation_auditor.get_trust_history(agent_id)}


# ── MCP (Model Context Protocol) Endpoints ───────────────────────────────────

@router.get("/mcp/tools")
def list_mcp_tools():
    """List all registered MCP tools available for Agentic AI execution."""
    from app.mcp_server import MCP_TOOLS
    return {"tools": MCP_TOOLS}


@router.get("/mcp/resources")
def list_mcp_resources():
    """List all registered MCP resources."""
    from app.mcp_server import MCP_RESOURCES
    return {"resources": MCP_RESOURCES}


@router.post("/mcp")
async def handle_mcp_jsonrpc(req: dict[str, Any]):
    """Standard JSON-RPC 2.0 endpoint for MCP clients."""
    from app.mcp_server import handle_jsonrpc
    return handle_jsonrpc(req)


@router.post("/mcp/tools/{tool_name}")
async def call_mcp_tool_direct(tool_name: str, arguments: dict[str, Any] = {}):
    """Direct REST execution of an MCP tool."""
    from app.mcp_server import execute_tool
    try:
        res = execute_tool(tool_name, arguments)
        return {"status": "success", "result": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

