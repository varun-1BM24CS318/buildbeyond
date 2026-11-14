"""
FastAPI Server Gateway & WebSocket Dispatcher
============================================

Root application entry point configuring:
- Defensive middleware stack (Security headers, Rate limiting, CORS).
- REST API routing (/api/*).
- Live WebSocket event broadcast (/ws).
- Inbound resync and buffer-capped messaging.
"""

from __future__ import annotations

import json
import logging
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load backend environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.api.ws import ws_manager
from app.ratelimit import RateLimitMiddleware
from app.security import SecurityHeadersMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("gateway")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Crisis Allocation System Gateway starting up...")
    yield
    logger.info("Crisis Allocation System Gateway shutting down...")


app = FastAPI(
    title="Autonomous Multi-Agent Crisis Resource Allocation System",
    description="Agent-based negotiation with stateless mediator for resilient disaster power allocation.",
    version="1.0.0",
    lifespan=lifespan,
)

# 1. CORS Middleware & Origins
raw_origins = os.getenv("ALLOWED_ORIGINS", "")
if raw_origins.strip():
    allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
else:
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

origin_regex = os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Defensive Security Headers
app.add_middleware(SecurityHeadersMiddleware)

# 3. Token Bucket Rate Limiting
app.add_middleware(RateLimitMiddleware, enabled=True)

# 4. Attach REST API Routes
app.include_router(api_router)


# 5. Live WebSocket Endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    connected = await ws_manager.connect(websocket)
    if not connected:
        return

    try:
        while True:
            # Receive inbound messages (max 4 KB)
            raw_text = await websocket.receive_text()
            if len(raw_text.encode("utf-8")) > 4096:
                await ws_manager.send_personal_message(
                    websocket, {"error": "Message size exceeds 4 KB cap"}
                )
                continue

            try:
                data = json.loads(raw_text)
                msg_type = data.get("type")

                # Handle client resync
                if msg_type == "resync":
                    if ws_manager.state_provider:
                        snap = ws_manager.state_provider()
                        await ws_manager.send_personal_message(
                            websocket,
                            {
                                "type": "resync_state",
                                "seq": ws_manager.seq,
                                "payload": snap,
                            },
                        )

            except json.JSONDecodeError:
                await ws_manager.send_personal_message(
                    websocket, {"error": "Invalid JSON received"}
                )

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as exc:
        logger.warning(f"WebSocket error: {exc}")
        ws_manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
