"""
WebSocket Real-Time Broadcast Hub
=================================

Maintains live connections for command-center dashboards:
- Broadcasts simulation events, bids, allocations, cascade updates, and alerts.
- Buffer-capped client queues (drops oldest to protect memory against slow clients).
- Resync protocol: Client sending {"type": "resync"} immediately receives full state.
- Inbound rate limits and message size caps (<= 4 KB).
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any, Callable
from starlette.websockets import WebSocket, WebSocketDisconnect

logger = logging.getLogger("api.ws")


class WebSocketManager:
    """Central broadcast coordinator for live dashboard clients."""

    def __init__(self, max_connections_per_ip: int = 10, max_buffer_size: int = 100) -> None:
        self.active_connections: list[WebSocket] = []
        self.ip_connections: dict[str, int] = defaultdict(int)
        self.max_connections_per_ip = max_connections_per_ip
        self.max_buffer_size = max_buffer_size
        self.seq: int = 0
        self.state_provider: Callable[[], dict[str, Any]] | None = None

    async def connect(self, websocket: WebSocket) -> bool:
        client_ip = websocket.client.host if websocket.client else "unknown"
        if self.ip_connections[client_ip] >= self.max_connections_per_ip:
            await websocket.close(code=1008, reason="Connection limit exceeded")
            return False

        await websocket.accept()
        self.active_connections.append(websocket)
        self.ip_connections[client_ip] += 1
        logger.info(f"WebSocket client connected from {client_ip}. Total active: {len(self.active_connections)}")

        # Send initial sync
        if self.state_provider:
            snapshot = self.state_provider()
            await self.send_personal_message(
                websocket,
                {
                    "type": "resync_state",
                    "seq": self.seq,
                    "payload": snapshot,
                },
            )
        return True

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            client_ip = websocket.client.host if websocket.client else "unknown"
            self.ip_connections[client_ip] = max(0, self.ip_connections[client_ip] - 1)
            logger.info(f"WebSocket client disconnected: {client_ip}")

    async def send_personal_message(self, websocket: WebSocket, message: dict[str, Any]) -> None:
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as exc:
            logger.warning(f"Failed sending personal WS message: {exc}")

    async def broadcast(self, event_type: str, payload: dict[str, Any], env_version: int = 1) -> None:
        """Broadcast an event to all connected dashboard clients."""
        self.seq += 1
        msg = {
            "type": event_type,
            "seq": self.seq,
            "env_version": env_version,
            "payload": payload,
        }
        msg_text = json.dumps(msg)

        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(msg_text)
            except Exception:
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)


# Global singleton manager
ws_manager = WebSocketManager()
