"""
Launcher for FastAPI Backend Gateway
====================================
Runs Uvicorn on 127.0.0.1:8000 with Windows asyncio selector loop.
"""

import sys
import os
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Ensure backend directory is in python path
backend_dir = os.path.join(os.path.dirname(__file__), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, ".env"))
load_dotenv()

import uvicorn

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    print(f"[+] Starting Autonomous Multi-Agent Crisis Resource Allocation Gateway on http://{host}:{port}")
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
