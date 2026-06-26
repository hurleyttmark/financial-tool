"""
fetcher.py — Fetches 300 daily OHLCV bars from Alpha Vantage (primary) or
yfinance (fallback when DATA_SOURCE=yfinance). All network errors handled
uniformly. Every outbound call is logged with timing.
"""
import asyncio
import time
from typing import Optional

import httpx
import pandas as pd

from config import settings
from logger import log
from rate_limiter import TokenBucketLimiter


AV_BASE = "https://www.alphavantage.co/query"
TARGET_BARS = 300


def _parse_av_response(data: dict, symbol: str) -> list[dict]:
    """Parse Alpha Vantage TIME_SERIES_DAILY response."""
    ts_key = "Time Series (Daily)"
    if ts_key not in data:
        # Check for error messages
        if "Note" in data:
            raise ValueError(f"Alpha Vantage rate limit note: {data['Note']}")
        if "Information" in data:
            raise ValueError(f"Alpha Vantage info: {data['Information']}")
        if "Error Message" in data:
            raise ValueError(f"Alpha Vantage error: {data['Error Message']}")
        raise ValueError(f"Unexpected Alpha Vantage response shape for {symbol}")

    ts = data[ts_key]
    bars = []
    for date_str, vals in sorted(ts.items()):
        bars.append(
            {
                "date": date_str,
                "open": float(vals.get("1. open", 0)),
                "high": float(vals.get("2. high", 0)),
                "low": float(vals.get("3. low", 0)),
                "close": float(vals.get("4. close", 0)),
                "volume": float(vals.get("5. volume", vals.get("5. volume", 0))),
            }
        )
    return bars[-TARGET_BARS:]  # most recent 300


async def fetch_alphavantage(
    symbol: str, limiter: TokenBucketLimiter
) -> list[dict]:
    """
    Fetch daily bars from Alpha Vantage with exponential backoff on 429.
    Retries: 1s, 2s, 4s — then raises.
    """
    delays = [1, 2, 4]
    last_exc: Optional[Exception] = None

    for attempt, delay in enumerate([0] + delays):
        if delay:
            log.info("AV RETRY | symbol=%s | attempt=%d | wait=%ds", symbol, attempt, delay)
            await asyncio.sleep(delay)

        await limiter.wait_and_acquire()

        params = {
            "function": "TIME_SERIES_DAILY",
            "symbol": symbol.upper(),
            "outputsize": "full",
            "apikey": settings.alpha_vantage_api_key,
            "datatype": "json",
        }

        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(AV_BASE, params=params)

            elapsed_ms = int((time.monotonic() - t0) * 1000)
            log.info(
                "AV FETCH | symbol=%s | status=%d | ms=%d",
                symbol, resp.status_code, elapsed_ms,
            )

            if resp.status_code == 429:
                last_exc = ValueError("Alpha Vantage returned 429")
                continue

            resp.raise_for_status()
            data = resp.json()
            bars = _parse_av_response(data, symbol)

            if not bars:
                raise ValueError(f"No bars returned for symbol '{symbol}'. It may be invalid or delisted.")

            return bars

        except httpx.TimeoutException as exc:
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            log.warning("AV TIMEOUT | symbol=%s | ms=%d", symbol, elapsed_ms)
            last_exc = exc
        except httpx.HTTPStatusError as exc:
            log.warning("AV HTTP ERROR | symbol=%s | status=%d", symbol, exc.response.status_code)
            last_exc = exc
        except ValueError as exc:
            log.warning("AV PARSE ERROR | symbol=%s | error=%s", symbol, str(exc))
            raise  # Parse errors are not retryable

    raise RuntimeError(
        f"Alpha Vantage fetch failed after {len(delays)+1} attempts for '{symbol}': {last_exc}"
    )


def fetch_yfinance(symbol: str) -> list[dict]:
    """
    Synchronous yfinance fetch wrapped for uniform error handling.
    Returns list of OHLCV dicts sorted ascending by date.
    """
    import yfinance as yf  # imported lazily; only used when DATA_SOURCE=yfinance

    t0 = time.monotonic()
    try:
        ticker = yf.Ticker(symbol.upper())
        df = ticker.history(period="2y", interval="1d", auto_adjust=True)
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        log.info("YF FETCH | symbol=%s | rows=%d | ms=%d", symbol, len(df), elapsed_ms)
    except Exception as exc:
        elapsed_ms = int((time.monotonic() - t0) * 1000)
        log.warning("YF ERROR | symbol=%s | error=%s | ms=%d", symbol, str(exc), elapsed_ms)
        raise RuntimeError(f"yfinance fetch failed for '{symbol}': {exc}") from exc

    if df.empty:
        raise ValueError(f"yfinance returned no data for '{symbol}'. Symbol may be invalid.")

    df = df.reset_index()
    df = df.sort_values("Date")
    bars = []
    for _, row in df.tail(TARGET_BARS).iterrows():
        date_val = row["Date"]
        date_str = date_val.strftime("%Y-%m-%d") if hasattr(date_val, "strftime") else str(date_val)[:10]
        bars.append(
            {
                "date": date_str,
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": float(row.get("Volume", 0)),
            }
        )
    return bars


async def fetch_bars(symbol: str, limiter: TokenBucketLimiter) -> list[dict]:
    """
    Top-level fetch dispatcher. Checks cache first, then routes to the
    configured data source. Caches fresh results.
    """
    from cache import get_cached_bars, save_bars  # avoid circular at module level

    cached = get_cached_bars(symbol)
    if cached and len(cached) >= 50:
        return cached

    source = settings.data_source.lower()

    if source == "yfinance":
        bars = await asyncio.get_event_loop().run_in_executor(
            None, fetch_yfinance, symbol
        )
    else:
        bars = await fetch_alphavantage(symbol, limiter)

    if len(bars) < 50:
        raise ValueError(
            f"Insufficient data for '{symbol}': only {len(bars)} bars available (minimum 50 required)."
        )

    save_bars(symbol, bars)
    return bars
