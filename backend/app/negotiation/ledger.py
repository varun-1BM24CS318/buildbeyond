"""Append-only hash-chained transaction ledger backed by SQLite."""

from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from datetime import datetime, timezone

# Valid transaction types for the ledger.
_VALID_TXN_TYPES = frozenset({"BID", "RESERVED", "COMMITTED", "EVENT", "AUDIT"})

# Genesis hash — the prev_hash of the very first transaction.
GENESIS_HASH: str = hashlib.sha256(b"GENESIS").hexdigest()


def _canonical_json(obj: dict) -> str:
    """Deterministic JSON serialisation with sorted keys and no extra whitespace."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


def _compute_hash(prev_hash: str, txn: dict) -> str:
    """Compute ``sha256(prev_hash || canonical_json(txn))``."""
    data = prev_hash.encode() + _canonical_json(txn).encode()
    return hashlib.sha256(data).hexdigest()


def _row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)


class Ledger:
    """Append-only hash-chained transaction ledger backed by SQLite."""

    _CREATE_TABLE = """
        CREATE TABLE IF NOT EXISTS transactions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            txn_id      TEXT    UNIQUE NOT NULL,
            txn_type    TEXT    NOT NULL,
            env_version INTEGER NOT NULL,
            step        INTEGER NOT NULL,
            agent_id    TEXT,
            payload     TEXT    NOT NULL,
            prev_hash   TEXT    NOT NULL,
            hash        TEXT    NOT NULL,
            status      TEXT    DEFAULT 'ACTIVE',
            created_at  TEXT    NOT NULL
        )
    """

    def __init__(self, db_path: str = ":memory:") -> None:
        self.db_path = db_path
        self._conn = sqlite3.connect(db_path, timeout=5.0, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute(self._CREATE_TABLE)
        self._conn.commit()

    # ------------------------------------------------------------------
    # Core write operations
    # ------------------------------------------------------------------

    def append(
        self,
        txn_type: str,
        env_version: int,
        step: int,
        agent_id: str | None,
        payload: dict,
        txn_id: str | None = None,
        status: str | None = None,
    ) -> dict:
        """Append a transaction to the ledger and return the full row as a dict."""
        if txn_type not in _VALID_TXN_TYPES:
            raise ValueError(
                f"Invalid txn_type '{txn_type}'. Must be one of {sorted(_VALID_TXN_TYPES)}"
            )

        if txn_id is None:
            txn_id = str(uuid.uuid4())

        if status is None:
            status = "RESERVED" if txn_type == "RESERVED" else "ACTIVE"

        created_at = datetime.now(timezone.utc).isoformat()

        # Determine prev_hash from the last row (or genesis).
        cursor = self._conn.execute(
            "SELECT hash FROM transactions ORDER BY id DESC LIMIT 1"
        )
        last = cursor.fetchone()
        prev_hash = last["hash"] if last else GENESIS_HASH

        # Build the transaction dict used for hashing.
        txn = {
            "txn_id": txn_id,
            "txn_type": txn_type,
            "env_version": env_version,
            "step": step,
            "agent_id": agent_id,
            "payload": payload,
            "prev_hash": prev_hash,
            "created_at": created_at,
        }
        txn_hash = _compute_hash(prev_hash, txn)

        payload_json = _canonical_json(payload)

        self._conn.execute(
            """
            INSERT INTO transactions
                (txn_id, txn_type, env_version, step, agent_id,
                 payload, prev_hash, hash, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                txn_id,
                txn_type,
                env_version,
                step,
                agent_id,
                payload_json,
                prev_hash,
                txn_hash,
                status,
                created_at,
            ),
        )
        self._conn.commit()

        # Return the full row.
        row = self._conn.execute(
            "SELECT * FROM transactions WHERE txn_id = ?", (txn_id,)
        ).fetchone()
        return _row_to_dict(row)

    # ------------------------------------------------------------------
    # Read operations
    # ------------------------------------------------------------------

    def get(self, txn_id: str) -> dict | None:
        """Return a single transaction by *txn_id*, or ``None``."""
        row = self._conn.execute(
            "SELECT * FROM transactions WHERE txn_id = ?", (txn_id,)
        ).fetchone()
        return _row_to_dict(row) if row else None

    def get_latest(self, n: int = 10) -> list[dict]:
        """Return the *n* most recent transactions (newest first)."""
        rows = self._conn.execute(
            "SELECT * FROM transactions ORDER BY id DESC LIMIT ?", (n,)
        ).fetchall()
        return [_row_to_dict(r) for r in rows]

    def get_by_type(self, txn_type: str) -> list[dict]:
        """Return all transactions of the given *txn_type*."""
        rows = self._conn.execute(
            "SELECT * FROM transactions WHERE txn_type = ? ORDER BY id", (txn_type,)
        ).fetchall()
        return [_row_to_dict(r) for r in rows]

    def get_by_agent(self, agent_id: str) -> list[dict]:
        """Return all transactions for a given *agent_id*."""
        rows = self._conn.execute(
            "SELECT * FROM transactions WHERE agent_id = ? ORDER BY id", (agent_id,)
        ).fetchall()
        return [_row_to_dict(r) for r in rows]

    def get_by_step(self, step: int) -> list[dict]:
        """Return all transactions for a given *step*."""
        rows = self._conn.execute(
            "SELECT * FROM transactions WHERE step = ? ORDER BY id", (step,)
        ).fetchall()
        return [_row_to_dict(r) for r in rows]

    # ------------------------------------------------------------------
    # Status transition
    # ------------------------------------------------------------------

    def update_status(self, txn_id: str, new_status: str) -> bool:
        """Update status, only allowing ``RESERVED → COMMITTED`` transitions.

        Returns ``True`` if the update was applied, ``False`` otherwise.
        """
        if new_status != "COMMITTED":
            return False

        cursor = self._conn.execute(
            """
            UPDATE transactions
               SET status = ?
             WHERE txn_id = ? AND status = 'RESERVED'
            """,
            (new_status, txn_id),
        )
        self._conn.commit()
        return cursor.rowcount > 0

    # ------------------------------------------------------------------
    # Integrity verification
    # ------------------------------------------------------------------

    def verify_chain(self) -> tuple[bool, str]:
        """Re-compute the entire hash chain from genesis.

        Returns ``(True, "Chain valid: N transactions")`` on success,
        or ``(False, "Tampered at txn {id}")`` on the first mismatch.
        """
        rows = self._conn.execute(
            "SELECT * FROM transactions ORDER BY id ASC"
        ).fetchall()

        if not rows:
            return (True, "Chain valid: 0 transactions")

        prev_hash = GENESIS_HASH

        for row in rows:
            row_d = _row_to_dict(row)
            # Reconstruct the transaction dict that was hashed at append time.
            txn = {
                "txn_id": row_d["txn_id"],
                "txn_type": row_d["txn_type"],
                "env_version": row_d["env_version"],
                "step": row_d["step"],
                "agent_id": row_d["agent_id"],
                "payload": json.loads(row_d["payload"]),
                "prev_hash": row_d["prev_hash"],
                "created_at": row_d["created_at"],
            }

            expected_hash = _compute_hash(prev_hash, txn)

            if row_d["prev_hash"] != prev_hash:
                return (False, f"Tampered at txn {row_d['id']}")
            if row_d["hash"] != expected_hash:
                return (False, f"Tampered at txn {row_d['id']}")

            prev_hash = row_d["hash"]

        return (True, f"Chain valid: {len(rows)} transactions")

    def verify_hash_chain(self) -> bool:
        """Convenience method returning True if chain is untampered, False otherwise."""
        valid, _ = self.verify_chain()
        return valid

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    def count(self) -> int:
        """Return the total number of transactions in the ledger."""
        row = self._conn.execute("SELECT COUNT(*) AS cnt FROM transactions").fetchone()
        return row["cnt"]

    def clear(self) -> None:
        """Delete all transactions. **For testing / reset only.**"""
        self._conn.execute("DELETE FROM transactions")
        self._conn.commit()
