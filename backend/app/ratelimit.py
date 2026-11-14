"""
Token Bucket Rate Limiting Middleware
=====================================

In-process token bucket per client IP with distinct rate tiers:
- General REST: 60 req/min
- Simulation stepping / mutation: 20 req/min
- Director actions: 5 req/min
- Returns 429 with 'Retry-After' header and structured JSON body.
"""

from __future__ import annotations

import time
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class TokenBucket:
    """Standard token bucket algorithm."""

    def __init__(self, capacity: int, refill_rate_per_sec: float) -> None:
        self.capacity: float = float(capacity)
        self.tokens: float = float(capacity)
        self.refill_rate: float = refill_rate_per_sec
        self.last_update: float = time.monotonic()

    def consume(self, amount: float = 1.0) -> bool:
        now = time.monotonic()
        elapsed = now - self.last_update
        self.last_update = now
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)

        if self.tokens >= amount:
            self.tokens -= amount
            return True
        return False

    def retry_after(self) -> int:
        needed = 1.0 - self.tokens
        if needed <= 0:
            return 0
        return max(1, int(needed / self.refill_rate) + 1)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Enforces rate limits by endpoint tier and client IP."""

    def __init__(self, app, enabled: bool = True) -> None:
        super().__init__(app)
        self.enabled = enabled
        # ip -> bucket
        self.general_buckets: dict[str, TokenBucket] = defaultdict(lambda: TokenBucket(60, 60.0 / 60.0))
        self.sim_buckets: dict[str, TokenBucket] = defaultdict(lambda: TokenBucket(20, 20.0 / 60.0))
        self.director_buckets: dict[str, TokenBucket] = defaultdict(lambda: TokenBucket(5, 5.0 / 60.0))

    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path

        # Determine tier
        bucket: TokenBucket | None = None
        if path.startswith("/api/director"):
            bucket = self.director_buckets[client_ip]
        elif path in ("/api/simulation/step", "/api/simulation/event", "/api/simulation/scenario"):
            bucket = self.sim_buckets[client_ip]
        elif path.startswith("/api/"):
            bucket = self.general_buckets[client_ip]

        if bucket and not bucket.consume(1.0):
            retry_secs = bucket.retry_after()
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too Many Requests",
                    "message": f"Rate limit exceeded. Try again in {retry_secs} seconds.",
                    "retry_after": retry_secs,
                },
                headers={"Retry-After": str(retry_secs)},
            )

        return await call_next(request)
