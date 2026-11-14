"""Pytest configuration and event loop policy for Windows."""

import asyncio
import os
import sys

# Ensure unit tests execute with ephemeral in-memory ledger
os.environ["LEDGER_DB_PATH"] = ":memory:"

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass
