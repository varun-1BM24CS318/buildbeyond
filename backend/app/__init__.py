"""Autonomous Multi-Agent Crisis Resource Allocation System
Package initialization.
"""
__version__ = "1.0.0"

import asyncio
import sys

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass
