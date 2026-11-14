"""
Supabase Cloud Synchronization Service
=======================================
Asynchronously mirrors local physical simulation results and hash-chained
ledger transactions to a cloud Postgres database on Supabase.

- Non-blocking: background async tasks never delay the logical clock.
- Graceful degradation: If network fails or Supabase is offline, the local
  simulation and SQLite ledger proceed with zero interruption.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import uuid
from typing import Any
import httpx
from dotenv import load_dotenv

# Ensure environment variables are loaded
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv()

logger = logging.getLogger("supabase.sync")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://povtxolmajhxrnwqyjhd.supabase.co").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")


class SupabaseSyncer:
    def __init__(self) -> None:
        self.url = os.getenv("SUPABASE_URL", "https://povtxolmajhxrnwqyjhd.supabase.co").rstrip("/")
        self.key = os.getenv("SUPABASE_KEY", "")
        self.current_run_id = f"run-{uuid.uuid4().hex[:12]}"
        self.current_scenario = "cyclone"
        self._recorded_runs: set[str] = set()
        self._client: httpx.AsyncClient | None = None
        self._force_enabled: bool | None = None

    @property
    def enabled(self) -> bool:
        if self._force_enabled is not None:
            return self._force_enabled
        if bool(os.getenv("TESTING")) or "pytest" in sys.modules:
            return False
        return bool(self.url and self.key)

    @enabled.setter
    def enabled(self, val: bool) -> None:
        self._force_enabled = val

    def reload_config(self) -> None:
        self.url = os.getenv("SUPABASE_URL", "https://povtxolmajhxrnwqyjhd.supabase.co").rstrip("/")
        self.key = os.getenv("SUPABASE_KEY", "")

    @property
    def headers(self) -> dict[str, str]:
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }

    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=4.0)
        return self._client

    async def ensure_run_exists(self, scenario: str | None = None, seed: int = 42, total_steps: int = 24) -> None:
        if not self.enabled or self.current_run_id in self._recorded_runs:
            return
        sc = scenario or self.current_scenario
        payload = {
            "run_id": self.current_run_id,
            "scenario": sc,
            "seed": seed,
            "total_steps": total_steps,
        }
        try:
            client = await self.get_client()
            headers = dict(self.headers)
            headers["Prefer"] = "resolution=merge-duplicates"
            res = await client.post(
                f"{self.url}/rest/v1/simulation_runs",
                headers=headers,
                json=payload,
            )
            if res.status_code < 400:
                self._recorded_runs.add(self.current_run_id)
                logger.info(f"Supabase recorded run {self.current_run_id} ({sc})")
        except Exception as exc:
            logger.debug(f"Supabase ensure_run_exists skipped: {exc}")

    async def record_run_start(self, scenario: str, seed: int = 42, total_steps: int = 24) -> None:
        if not self.enabled:
            return
        self.current_run_id = f"run-{uuid.uuid4().hex[:12]}"
        self.current_scenario = scenario
        await self.ensure_run_exists(scenario=scenario, seed=seed, total_steps=total_steps)

    async def sync_step_record(self, rec: dict[str, Any]) -> None:
        if not self.enabled:
            return
        await self.ensure_run_exists()

        payload = {
            "run_id": self.current_run_id,
            "step": rec["step"],
            "supply_mw": rec["supply_mw"],
            "total_demand": round(sum(rec.get("demands", {}).values()), 2),
            "total_allocated": round(sum(rec.get("allocations", {}).values()), 2),
            "shortage_mw": max(0.0, round(sum(rec.get("demands", {}).values()) - rec["supply_mw"], 2)),
            "capacity_violations": 0,
            "survival_rate": 100.0,
            "allocations": rec.get("allocations", {}),
            "demands": rec.get("demands", {}),
            "damages": rec.get("damages", {}),
            "cascade_damages": rec.get("cascade_damages", {}),
            "service_levels": rec.get("service_levels", {}),
            "solve_time_ms": rec.get("solve_time_ms", 2.0),
        }
        try:
            client = await self.get_client()
            res = await client.post(
                f"{self.url}/rest/v1/simulation_steps",
                headers=self.headers,
                json=payload,
            )
            if res.status_code == 409 and "foreign key" in res.text.lower():
                # Retry once after forcing run existence
                await self.ensure_run_exists()
                res = await client.post(
                    f"{self.url}/rest/v1/simulation_steps",
                    headers=self.headers,
                    json=payload,
                )

            if res.status_code >= 400:
                logger.warning(f"Supabase step sync returned {res.status_code}: {res.text}")
            else:
                logger.info(f"Supabase synced step {rec['step']} for run {self.current_run_id}")
        except Exception as exc:
            logger.debug(f"Supabase step sync skipped: {exc}")

    async def sync_ledger_transaction(self, txn: dict[str, Any]) -> None:
        if not self.enabled:
            return
        raw_payload = txn.get("payload", {})
        if isinstance(raw_payload, str):
            try:
                parsed_payload = json.loads(raw_payload)
            except Exception:
                parsed_payload = {"raw": raw_payload}
        else:
            parsed_payload = raw_payload

        payload = {
            "txn_id": txn.get("txn_id") or str(uuid.uuid4()),
            "txn_type": txn["txn_type"],
            "env_version": txn["env_version"],
            "step": txn["step"],
            "agent_id": txn.get("agent_id"),
            "payload": parsed_payload,
            "prev_hash": txn["prev_hash"],
            "hash": txn["hash"],
            "status": txn.get("status", "COMMITTED"),
        }
        try:
            client = await self.get_client()
            await client.post(
                f"{self.url}/rest/v1/crisis_ledger",
                headers=self.headers,
                json=payload,
            )
        except Exception as exc:
            logger.debug(f"Supabase ledger sync skipped: {exc}")

    async def sync_ledger_batch(self, txns: list[dict[str, Any]]) -> None:
        if not self.enabled or not txns:
            return
        records = []
        for txn in txns:
            raw_payload = txn.get("payload", {})
            if isinstance(raw_payload, str):
                try:
                    parsed_payload = json.loads(raw_payload)
                except Exception:
                    parsed_payload = {"raw": raw_payload}
            else:
                parsed_payload = raw_payload

            records.append({
                "txn_id": txn.get("txn_id") or str(uuid.uuid4()),
                "txn_type": txn["txn_type"],
                "env_version": txn["env_version"],
                "step": txn["step"],
                "agent_id": txn.get("agent_id"),
                "payload": parsed_payload,
                "prev_hash": txn["prev_hash"],
                "hash": txn["hash"],
                "status": txn.get("status", "COMMITTED"),
            })
        try:
            client = await self.get_client()
            res = await client.post(
                f"{self.url}/rest/v1/crisis_ledger",
                headers=self.headers,
                json=records,
            )
            if res.status_code >= 400:
                logger.warning(f"Supabase ledger batch sync returned {res.status_code}: {res.text}")
            else:
                logger.info(f"Supabase synced batch of {len(records)} transactions")
        except Exception as exc:
            logger.debug(f"Supabase ledger batch sync skipped: {exc}")


# Global syncer instance
supabase_syncer = SupabaseSyncer()
