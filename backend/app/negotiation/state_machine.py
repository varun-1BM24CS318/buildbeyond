"""
Negotiation Protocol State Machine
==================================

Orchestrates multi-agent crisis negotiation through the protocol states:
COLLECT_BIDS -> SHORTAGE_CHECK -> CONCESSION_ROUND(k) -> OPTIMIZE ->
PRICE -> PROPOSE -> ACCEPT/COUNTER -> VALIDATE -> COMMIT -> AUDIT

Key Guarantees:
- Hard round limit: MAX_ROUNDS = 6.
- Degraded agent fail-safe: Last valid bid used for critical minimum protection only.
- Bounded restart on concurrent event: Bumps env_version; restarts up to 3 times.
- Monotonic bid versions; stale versions strictly rejected.
- Emits real ledger events at each phase.
"""

from __future__ import annotations

import enum
import logging
from typing import Any, Callable

from app.agents.base_agent import BaseAgent
from app.config import EPS, MAX_ROUNDS
from app.negotiation.ledger import Ledger
from app.negotiation.messages import (
    AllocationResult,
    BidMessage,
    NegotiationEvent,
    SegmentAllocation,
)
from app.optimization.validator import AllocationValidator

logger = logging.getLogger("negotiation")


class NegotiationState(str, enum.Enum):
    COLLECT_BIDS = "COLLECT_BIDS"
    SHORTAGE_CHECK = "SHORTAGE_CHECK"
    CONCESSION_ROUND = "CONCESSION_ROUND"
    OPTIMIZE = "OPTIMIZE"
    PRICE = "PRICE"
    PROPOSE = "PROPOSE"
    ACCEPT_COUNTER = "ACCEPT_COUNTER"
    VALIDATE = "VALIDATE"
    COMMIT = "COMMIT"
    AUDIT = "AUDIT"
    FAILED = "FAILED"


class NegotiationSession:
    """Manages a single negotiation cycle for one simulation step."""

    def __init__(
        self,
        step: int,
        env_version: int,
        supply_mw: float,
        agents: dict[str, BaseAgent],
        ledger: Ledger,
        optimizer_fn: Callable[..., dict[str, AllocationResult]] | None = None,
        pricing_fn: Callable[..., dict[str, float]] | None = None,
        max_restarts: int = 3,
    ) -> None:
        self.step: int = step
        self.env_version: int = env_version
        self.supply_mw: float = supply_mw
        self.agents: dict[str, BaseAgent] = agents
        self.ledger: Ledger = ledger
        self.optimizer_fn = optimizer_fn or self._default_lp_optimizer
        self.pricing_fn = pricing_fn

        self.state: NegotiationState = NegotiationState.COLLECT_BIDS
        self.round_num: int = 1
        self.restarts_count: int = 0
        self.max_restarts: int = max_restarts

        # Active round data
        self.bids: dict[str, BidMessage] = {}
        self.last_valid_bids: dict[str, BidMessage] = {}
        self.degraded_agents: set[str] = set()
        self.proposed_allocations: dict[str, AllocationResult] = {}
        self.committed_allocations: dict[str, AllocationResult] = {}
        self.events: list[NegotiationEvent] = []
        self.credits_charged: dict[str, float] = {}

    def _emit(self, event_type: str, agent_id: str | None, payload: dict) -> NegotiationEvent:
        """Record an event in memory and the append-only ledger."""
        ev = NegotiationEvent(
            round=self.round_num,
            agent_id=agent_id,
            event_type=event_type,
            payload=payload,
            env_version=self.env_version,
            step=self.step,
            seq=len(self.events) + 1,
        )
        self.events.append(ev)
        self.ledger.append(
            txn_type="EVENT",
            env_version=self.env_version,
            step=self.step,
            agent_id=agent_id,
            payload={"event_type": event_type, "round": self.round_num, **payload},
        )
        return ev

    def handle_concurrent_event(self, new_env_version: int, new_supply_mw: float | None = None) -> bool:
        """Handle concurrent environment mutation mid-negotiation.

        Restarts up to max_restarts times to prevent livelock.
        """
        self.restarts_count += 1
        self.env_version = new_env_version
        if new_supply_mw is not None:
            self.supply_mw = new_supply_mw

        self._emit(
            "CONCURRENT_EVENT_RESTART",
            None,
            {"new_env_version": new_env_version, "restart_attempt": self.restarts_count},
        )

        if self.restarts_count > self.max_restarts:
            # Bounded: commit fallback safe allocation
            logger.warning("Max negotiation restarts reached. Enforcing safe priority fallback.")
            self._emit("LIVELOCK_GUARD_FALLBACK", None, {"reason": "max_restarts_exceeded"})
            self._execute_safe_fallback()
            return False

        # Reset negotiation round state
        self.state = NegotiationState.COLLECT_BIDS
        self.round_num = 1
        for a in self.agents.values():
            a.reset_negotiation_round()
        return True

    def collect_bids(self) -> None:
        """Collect initial or revised bids from all active agents."""
        self.state = NegotiationState.COLLECT_BIDS
        current_bids: dict[str, BidMessage] = {}

        for aid, agent in self.agents.items():
            if aid in self.degraded_agents:
                # Use degraded fallback bid (critical minimum only)
                if aid in self.last_valid_bids:
                    last_b = self.last_valid_bids[aid]
                    bid = BidMessage(
                        bid_id=f"degraded-{last_b.bid_id}",
                        agent_id=aid,
                        env_version=self.env_version,
                        bid_version=agent.current_bid_version + 1,
                        requested_mw=agent.minimum_mw,
                        min_acceptable_mw=agent.minimum_mw,
                        segments=[
                            s for s in last_b.segments if s.name.lower() in ("critical", "life-support", "dispatch")
                        ] or last_b.segments[:1],
                        criticality=agent.criticality,
                        urgency=agent.urgency,
                        max_concession=0.0,
                        reason=f"DEGRADED fallback: protecting critical minimum {agent.minimum_mw:.1f} MW",
                    )
                else:
                    bid = agent.generate_bid(self.env_version, self.round_num)
            else:
                try:
                    bid = agent.generate_bid(self.env_version, self.round_num)
                except Exception as err:
                    logger.error(f"Agent {aid} failed during bidding: {err}")
                    self.degraded_agents.add(aid)
                    self._emit("AGENT_DEGRADED", aid, {"error": str(err)})
                    continue

            # Invariant check: Monotonic bid version
            if aid in self.last_valid_bids:
                if bid.bid_version <= self.last_valid_bids[aid].bid_version:
                    logger.warning(f"Agent {aid} non-monotonic bid_version; rejecting.")
                    continue

            # Invariant check: Never exceed certified max
            if bid.requested_mw > agent.certified_max_mw + EPS:
                logger.warning(f"Agent {aid} requested {bid.requested_mw} > certified {agent.certified_max_mw}")
                bid.requested_mw = agent.certified_max_mw

            current_bids[aid] = bid
            self.last_valid_bids[aid] = bid
            self._emit(
                "BID_SUBMITTED",
                aid,
                {
                    "requested_mw": bid.requested_mw,
                    "min_mw": bid.min_acceptable_mw,
                    "bid_version": bid.bid_version,
                    "urgency": bid.urgency,
                },
            )

        self.bids = current_bids

    def check_shortage_and_negotiate(self) -> None:
        """Check grid shortage; run concession rounds if needed, then optimize."""
        self.state = NegotiationState.SHORTAGE_CHECK
        total_requested = sum(b.requested_mw for b in self.bids.values())
        shortage = total_requested - self.supply_mw

        self._emit(
            "SHORTAGE_CHECKED",
            None,
            {
                "total_requested_mw": total_requested,
                "supply_mw": self.supply_mw,
                "shortage_mw": max(0.0, shortage),
                "is_shortage": shortage > EPS,
            },
        )

        # Multi-round concessions if shortage exists
        while shortage > EPS and self.round_num < MAX_ROUNDS:
            self.state = NegotiationState.CONCESSION_ROUND
            self.round_num += 1

            total_concessions = 0.0
            concessions_made: dict[str, float] = {}

            for aid, agent in self.agents.items():
                if aid in self.degraded_agents:
                    continue
                c = agent.make_concession(self.round_num, shortage)
                if c > EPS:
                    concessions_made[aid] = c
                    total_concessions += c

            self._emit(
                "CONCESSION_ROUND_COMPLETED",
                None,
                {
                    "round": self.round_num,
                    "concessions": concessions_made,
                    "total_conceded_mw": total_concessions,
                },
            )

            # Re-collect revised bids after concessions
            self.collect_bids()
            total_requested = sum(b.requested_mw for b in self.bids.values())
            shortage = total_requested - self.supply_mw

            if total_concessions <= EPS:
                # No more concessions possible; proceed to optimizer resolution
                break

    def run_optimization(self) -> None:
        """Stage: OPTIMIZE -> PRICE -> PROPOSE -> VALIDATE -> COMMIT."""
        self.state = NegotiationState.OPTIMIZE

        # Run optimizer
        allocations = self.optimizer_fn(
            bids=self.bids,
            supply_mw=self.supply_mw,
            env_version=self.env_version,
            agents=self.agents,
        )
        self.proposed_allocations = allocations

        # Stage: PRICE (VCG credits)
        self.state = NegotiationState.PRICE
        if self.pricing_fn:
            self.credits_charged = self.pricing_fn(
                allocations=allocations,
                bids=self.bids,
                supply_mw=self.supply_mw,
                agents=self.agents,
            )
        else:
            self.credits_charged = {aid: 0.0 for aid in allocations}

        # Stage: PROPOSE & ACCEPT/COUNTER
        self.state = NegotiationState.PROPOSE
        accepted: dict[str, bool] = {}
        for aid, alloc in allocations.items():
            if aid in self.agents:
                accepted[aid] = self.agents[aid].evaluate_proposal(alloc.allocated_mw)

        self.state = NegotiationState.ACCEPT_COUNTER
        self._emit(
            "PROPOSAL_EVALUATED",
            None,
            {
                "accepted": accepted,
                "allocations": {aid: a.allocated_mw for aid, a in allocations.items()},
                "credits": self.credits_charged,
            },
        )

        # Stage: VALIDATE (Two-phase commit: RESERVE -> COMMIT)
        self.state = NegotiationState.VALIDATE
        cert_maxes = {aid: a.certified_max_mw for aid, a in self.agents.items()}
        mins = {aid: a.minimum_mw for aid, a in self.agents.items()}

        val_result = AllocationValidator.validate_allocation(
            allocations=list(allocations.values()),
            bids=self.bids,
            supply_mw=self.supply_mw,
            expected_env_version=self.env_version,
            certified_maxes=cert_maxes,
            minimums=mins,
        )

        if not val_result.valid:
            logger.error(f"Validator rejected allocation: {val_result.errors}")
            self._emit("VALIDATION_FAILED", None, {"errors": val_result.errors})
            # Fall back to safe priority ladder
            self._execute_safe_fallback()
            return

        # Write RESERVED transaction to ledger
        import uuid
        txn_id = str(uuid.uuid4())
        reserved_row = self.ledger.append(
            txn_type="RESERVED",
            env_version=self.env_version,
            step=self.step,
            agent_id=None,
            payload={
                "txn_id": txn_id,
                "allocations": {aid: a.allocated_mw for aid, a in allocations.items()},
                "credits": self.credits_charged,
                "supply_mw": self.supply_mw,
                "critical_shortfall": val_result.critical_shortfall,
            },
            txn_id=txn_id,
        )

        # Flip to COMMITTED atomically
        self.state = NegotiationState.COMMIT
        commit_success = self.ledger.update_status(txn_id, "COMMITTED")
        if not commit_success:
            logger.critical("Atomic commit failed in SQLite ledger!")
            self._execute_safe_fallback()
            return

        self.committed_allocations = allocations
        for aid, alloc in allocations.items():
            if aid in self.agents:
                self.agents[aid].receive_allocation(alloc)
                # Deduct credits
                charge = self.credits_charged.get(aid, 0.0)
                self.agents[aid].credits -= charge

        self._emit(
            "ALLOCATION_COMMITTED",
            None,
            {
                "txn_id": txn_id,
                "allocations": {aid: a.allocated_mw for aid, a in allocations.items()},
                "supply_mw": self.supply_mw,
                "critical_shortfall": val_result.critical_shortfall,
                "critical_feasible": val_result.critical_feasible,
            },
        )

    def _execute_safe_fallback(self) -> None:
        """Safe fallback ladder: Strict-priority allocation provably respecting capacity."""
        logger.info("Executing strict-priority fallback ladder.")
        # Sort agents by criticality descending
        sorted_agents = sorted(
            self.agents.values(), key=lambda a: (a.criticality, a.urgency), reverse=True
        )

        rem_supply = self.supply_mw
        fallback_allocs: dict[str, AllocationResult] = {}
        import uuid
        txn_id = f"fallback-{uuid.uuid4()}"

        for agent in sorted_agents:
            aid = agent.agent_id
            bid = self.bids.get(aid)
            req = bid.requested_mw if bid else agent.minimum_mw
            granted = min(rem_supply, req)
            rem_supply -= granted

            shortfall = max(0.0, agent.minimum_mw - granted)
            unmet = max(0.0, req - granted)

            fallback_allocs[aid] = AllocationResult(
                agent_id=aid,
                allocated_mw=round(granted, 4),
                segments=[SegmentAllocation(name="fallback", allocated_mw=round(granted, 4), capacity_mw=req)],
                unmet_mw=round(unmet, 4),
                critical_shortfall=round(shortfall, 4),
                env_version=self.env_version,
                txn_id=txn_id,
                fallback=True,
            )

        # Validate fallback
        val = AllocationValidator.validate_allocation(
            allocations=list(fallback_allocs.values()),
            bids=self.bids or {a.agent_id: a.generate_bid(self.env_version) for a in self.agents.values()},
            supply_mw=self.supply_mw,
            expected_env_version=self.env_version,
        )

        # Commit fallback
        self.ledger.append(
            txn_type="COMMITTED",
            env_version=self.env_version,
            step=self.step,
            agent_id=None,
            payload={
                "txn_id": txn_id,
                "allocations": {aid: a.allocated_mw for aid, a in fallback_allocs.items()},
                "fallback": True,
            },
            txn_id=txn_id,
            status="COMMITTED",
        )
        self.committed_allocations = fallback_allocs
        for aid, a in fallback_allocs.items():
            if aid in self.agents:
                self.agents[aid].receive_allocation(a)

        self._emit("FALLBACK_COMMITTED", None, {"allocations": {aid: a.allocated_mw for aid, a in fallback_allocs.items()}})

    def _default_lp_optimizer(
        self,
        bids: dict[str, BidMessage],
        supply_mw: float,
        env_version: int,
        agents: dict[str, BaseAgent],
    ) -> dict[str, AllocationResult]:
        """SciPy HiGHS lexicographic LP pipeline allocator."""
        from app.optimization.pipeline import OptimizationPipeline

        pipeline = OptimizationPipeline()
        minimums = {aid: a.minimum_mw for aid, a in agents.items()}
        criticalities = {aid: a.criticality for aid, a in agents.items()}

        res = pipeline.solve(
            bids=bids,
            supply_mw=supply_mw,
            env_version=env_version,
            minimums=minimums,
            criticalities=criticalities,
        )
        return res.allocations

    def run(self) -> dict[str, AllocationResult]:
        """Execute the complete negotiation session end-to-end."""
        self.collect_bids()
        self.check_shortage_and_negotiate()
        self.run_optimization()
        return self.committed_allocations
