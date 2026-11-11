"""Small in-process attempt limiter for authentication endpoints.

State is per API process, which fits the single-instance deployment. Put a shared store
behind the same interface before running several instances.
"""

from collections import deque
from time import monotonic

from fastapi import HTTPException, Request


class AttemptLimiter:
    def __init__(self, max_keys: int = 20_000):
        self._attempts: dict[str, deque[float]] = {}
        self._max_keys = max_keys

    def _recent(self, key: str, window: float, now: float) -> deque[float]:
        attempts = self._attempts.get(key)
        if attempts is None:
            if len(self._attempts) >= self._max_keys:
                self._prune(now)
            attempts = self._attempts[key] = deque()
        while attempts and now - attempts[0] > window:
            attempts.popleft()
        return attempts

    def _prune(self, now: float) -> None:
        # Windows never exceed an hour; drop idle keys, then the oldest if still full.
        for key in [k for k, v in self._attempts.items() if not v or now - v[-1] > 3600]:
            del self._attempts[key]
        while len(self._attempts) >= self._max_keys:
            del self._attempts[next(iter(self._attempts))]

    def check(self, key: str, limit: int, window: float) -> None:
        now = monotonic()
        attempts = self._recent(key, window, now)
        if len(attempts) >= limit:
            retry = max(1, int(window - (now - attempts[0])) + 1)
            raise HTTPException(
                status_code=429,
                detail="Too many attempts. Please wait a few minutes and try again.",
                headers={"Retry-After": str(retry)},
            )

    def record(self, key: str, window: float) -> None:
        now = monotonic()
        self._recent(key, window, now).append(now)

    def reset(self, key: str) -> None:
        self._attempts.pop(key, None)


def client_host(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def limiter(request: Request) -> AttemptLimiter:
    return request.app.state.auth_limiter
