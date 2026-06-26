"""
rate_limiter.py — Server-side token-bucket rate limiter for Alpha Vantage (5 req/min).
Implemented as a class with asyncio.Lock for safe concurrent use under uvicorn.
Injected via FastAPI Depends() so it can be mocked in tests.
"""
import asyncio
import time
from fastapi import HTTPException


class TokenBucketLimiter:
    """
    5 tokens/min capacity; one token consumed per Alpha Vantage call.
    Tokens replenish continuously: 1 token every 12 seconds.
    """

    def __init__(self, capacity: int = 5, refill_rate: float = 1 / 12):
        self.capacity = capacity
        self.refill_rate = refill_rate  # tokens per second
        self.tokens: float = float(capacity)
        self.last_refill: float = time.monotonic()
        self._lock = asyncio.Lock()

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

    async def acquire(self) -> None:
        """
        Consume one token. Raises HTTP 429 with Retry-After if bucket is empty.
        """
        async with self._lock:
            self._refill()
            if self.tokens < 1.0:
                wait_seconds = int((1.0 - self.tokens) / self.refill_rate) + 1
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit reached. Retry after {wait_seconds} seconds.",
                    headers={"Retry-After": str(wait_seconds)},
                )
            self.tokens -= 1.0

    async def wait_and_acquire(self) -> None:
        """
        Block until a token is available (used internally for background tasks).
        """
        while True:
            async with self._lock:
                self._refill()
                if self.tokens >= 1.0:
                    self.tokens -= 1.0
                    return
            await asyncio.sleep(1.0)


# Singleton instance shared across all requests
limiter = TokenBucketLimiter()


async def get_limiter() -> TokenBucketLimiter:
    """FastAPI dependency that returns the shared limiter."""
    return limiter
