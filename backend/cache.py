"""
cache.py — SQLite cache for OHLCV bars (TTL 24h) and calibration results.
All queries use parameterized statements. Connections use context managers.
"""
import sqlite3
import json
import time
from datetime import datetime, timedelta
from typing import Optional
from contextlib import contextmanager

from config import settings
from logger import log


TTL_SECONDS = 3_600  # 24 hours


@contextmanager
def get_conn():
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Create tables if they do not exist."""
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS ohlcv_cache (
                symbol      TEXT NOT NULL,
                date        TEXT NOT NULL,
                open        REAL,
                high        REAL,
                low         REAL,
                close       REAL,
                volume      REAL,
                fetched_at  REAL NOT NULL,
                PRIMARY KEY (symbol, date)
            );

            CREATE TABLE IF NOT EXISTS calibration_cache (
                symbol              TEXT NOT NULL,
                calibration_date    TEXT NOT NULL,
                result_json         TEXT NOT NULL,
                fetched_at          REAL NOT NULL,
                PRIMARY KEY (symbol, calibration_date)
            );
            """
        )
    log.info("DB | init_db complete | path=%s", settings.db_path)


def get_cached_bars(symbol: str) -> Optional[list[dict]]:
    """
    Return cached OHLCV bars for symbol if TTL has not expired.
    Returns None if cache miss or expired.
    """
    cutoff = time.time() - TTL_SECONDS
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT date, open, high, low, close, volume, fetched_at
            FROM ohlcv_cache
            WHERE symbol = ? AND fetched_at > ?
            ORDER BY date ASC
            """,
            (symbol.upper(), cutoff),
        ).fetchall()

    if not rows:
        return None

    result = [
        {
            "date": r["date"],
            "open": r["open"],
            "high": r["high"],
            "low": r["low"],
            "close": r["close"],
            "volume": r["volume"],
        }
        for r in rows
    ]
    log.info("CACHE HIT | symbol=%s | bars=%d", symbol, len(result))
    return result


def save_bars(symbol: str, bars: list[dict]) -> None:
    """Upsert OHLCV bars into the cache."""
    now = time.time()
    sym = symbol.upper()
    with get_conn() as conn:
        conn.executemany(
            """
            INSERT OR REPLACE INTO ohlcv_cache
                (symbol, date, open, high, low, close, volume, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    sym,
                    b["date"],
                    b["open"],
                    b["high"],
                    b["low"],
                    b["close"],
                    b["volume"],
                    now,
                )
                for b in bars
            ],
        )
    log.info("CACHE WRITE | symbol=%s | bars=%d", sym, len(bars))


def get_calibration(symbol: str, calibration_date: str) -> Optional[dict]:
    """Return cached calibration result if present."""
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT result_json FROM calibration_cache
            WHERE symbol = ? AND calibration_date = ?
            """,
            (symbol.upper(), calibration_date),
        ).fetchone()
    if row:
        return json.loads(row["result_json"])
    return None


def save_calibration(symbol: str, calibration_date: str, result: dict) -> None:
    """Upsert calibration result."""
    with get_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO calibration_cache
                (symbol, calibration_date, result_json, fetched_at)
            VALUES (?, ?, ?, ?)
            """,
            (symbol.upper(), calibration_date, json.dumps(result), time.time()),
        )
    log.info("CALIBRATION WRITE | symbol=%s | date=%s", symbol, calibration_date)
