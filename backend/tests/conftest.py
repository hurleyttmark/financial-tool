"""
conftest.py — Shared pytest fixtures for pulse and cache tests.
"""
import os
import sys
import pytest
import numpy as np

# Ensure backend package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Set env vars before importing config so validate_config passes
os.environ.setdefault("ALPHA_VANTAGE_API_KEY", "TEST_KEY")
os.environ.setdefault("DATA_SOURCE", "alphavantage")
os.environ.setdefault("DB_PATH", ":memory:")
os.environ.setdefault("LOG_PATH", "/tmp/test_app.log")


@pytest.fixture
def synthetic_bars_30():
    """
    30 bars of synthetic OHLCV data with a gentle uptrend.
    Dates are arbitrary ISO strings. Prices are deterministic (seeded RNG).
    """
    rng = np.random.default_rng(42)
    n = 30
    base = 100.0
    bars = []
    price = base
    for i in range(n):
        change = rng.normal(0.002, 0.015) * price
        o = round(price, 4)
        c = round(price + change, 4)
        h = round(max(o, c) + abs(rng.normal(0, 0.005)) * price, 4)
        l = round(min(o, c) - abs(rng.normal(0, 0.005)) * price, 4)
        vol = float(int(rng.integers(100_000, 1_000_000)))
        bars.append(
            {
                "date": f"2024-{(i // 20) + 1:02d}-{(i % 20) + 1:02d}",
                "open": o,
                "high": h,
                "low": l,
                "close": c,
                "volume": vol,
            }
        )
        price = c
    return bars


@pytest.fixture
def synthetic_bars_300():
    """
    300 bars of synthetic OHLCV data — enough for full calibration window.
    """
    rng = np.random.default_rng(99)
    n = 300
    bars = []
    price = 150.0
    for i in range(n):
        change = rng.normal(0.001, 0.018) * price
        o = round(price, 4)
        c = round(price + change, 4)
        h = round(max(o, c) + abs(rng.normal(0, 0.006)) * price, 4)
        l = round(min(o, c) - abs(rng.normal(0, 0.006)) * price, 4)
        vol = float(int(rng.integers(500_000, 5_000_000)))
        year = 2023 + i // 252
        day_of_year = i % 252
        month = day_of_year // 21 + 1
        day = day_of_year % 21 + 1
        bars.append(
            {
                "date": f"{year}-{min(month,12):02d}-{min(day,28):02d}",
                "open": o,
                "high": h,
                "low": l,
                "close": c,
                "volume": vol,
            }
        )
        price = max(c, 1.0)
    return bars
