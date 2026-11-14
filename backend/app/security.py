"""
Security Controls & Authentication
==================================

- Constant-time API Key verification (hmac.compare_digest) for mutating endpoints.
- Read endpoints and WebSocket are read-only.
- Demo mode support: If DEMO_MODE=True, allows local UI requests without rigid auth.
- Security headers middleware: X-Content-Type-Options, X-Frame-Options, Referrer-Policy.
"""

from __future__ import annotations

import hmac
import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

API_KEY_ENV_VAR = "X_API_KEY"
DEFAULT_DEMO_KEY = "crisis-allocation-demo-secret-key-2026"
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() in ("true", "1", "yes")
SERVER_API_KEY = os.getenv(API_KEY_ENV_VAR, DEFAULT_DEMO_KEY)


def verify_api_key(provided_key: str | None) -> bool:
    """Constant-time comparison against configured server API key."""
    if DEMO_MODE and not provided_key:
        return True
    if not provided_key:
        return False
    return hmac.compare_digest(provided_key.encode("utf-8"), SERVER_API_KEY.encode("utf-8"))


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enforces essential defensive HTTP response headers."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
