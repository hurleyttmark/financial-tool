"""
test_cache.py — Tests for SQLite cache write→read round-trip and TTL expiry.
Uses an in-memory SQLite DB (:memory:) via monkeypatched settings.
"""
import time
import sqlite3
import pytest
import os

# The conftest already sets DB_PATH=:memory: before importing config
from cache import init_db, get_cached_bars, save_bars, get_calibration, save_calibration, TTL_SECONDS


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    """Each test gets a fresh temp SQLite file."""
    db_file = str(tmp_path / "test.db")
    monkeypatch.setattr("cache.settings", type("S", (), {"db_path": db_file, "log_path": "/tmp/test.log"})())
    # Also patch the log import inside cache
    import cache
    monkeypatch.setattr(cache, "settings", type("S", (), {"db_path": db_file, "log_path": "/tmp/test.log"})())
    init_db()
    yield db_file


class TestBarCache:
    def test_cache_miss_returns_none(self):
        result = get_cached_bars("AAPL")
        assert result is None

    def test_write_then_read_roundtrip(self, synthetic_bars_30):
        save_bars("AAPL", synthetic_bars_30)
        result = get_cached_bars("AAPL")
        assert result is not None
        assert len(result) == len(synthetic_bars_30)

    def test_read_preserves_data_values(self, synthetic_bars_30):
        save_bars("TSLA", synthetic_bars_30)
        result = get_cached_bars("TSLA")
        assert result is not None
        for original, cached in zip(synthetic_bars_30, result):
            assert cached["date"] == original["date"]
            assert abs(cached["open"] - original["open"]) < 1e-6
            assert abs(cached["close"] - original["close"]) < 1e-6
            assert abs(cached["volume"] - original["volume"]) < 1.0

    def test_symbol_isolation(self, synthetic_bars_30):
        save_bars("AAPL", synthetic_bars_30)
        result = get_cached_bars("MSFT")
        assert result is None

    def test_symbol_case_insensitive(self, synthetic_bars_30):
        save_bars("aapl", synthetic_bars_30)
        result = get_cached_bars("AAPL")
        assert result is not None

    def test_ttl_expiry(self, synthetic_bars_30, tmp_path, monkeypatch):
        """Bars written with a timestamp older than TTL should not be returned."""
        import cache as cache_module

        # Write directly with an expired fetched_at timestamp using raw SQL
        import sqlite3, time as time_module
        db_path = str(tmp_path / "expired.db")

        # Redirect cache to a fresh db for this test
        monkeypatch.setattr(cache_module, "settings",
            type("S", (), {"db_path": db_path, "log_path": "/tmp/test.log"})())
        cache_module.init_db()

        past_time = time_module.time() - TTL_SECONDS - 100
        conn = sqlite3.connect(db_path)
        sym = "EXPIRED"
        conn.executemany(
            "INSERT OR REPLACE INTO ohlcv_cache (symbol,date,open,high,low,close,volume,fetched_at) VALUES (?,?,?,?,?,?,?,?)",
            [(sym, b["date"], b["open"], b["high"], b["low"], b["close"], b["volume"], past_time)
             for b in synthetic_bars_30]
        )
        conn.commit()
        conn.close()

        result = cache_module.get_cached_bars(sym)
        assert result is None, "Expired cache entries should not be returned"

    def test_upsert_updates_existing(self, synthetic_bars_30):
        save_bars("AAPL", synthetic_bars_30)
        # Update one bar's close
        modified = [dict(b) for b in synthetic_bars_30]
        modified[0]["close"] = 9999.99
        save_bars("AAPL", modified)
        result = get_cached_bars("AAPL")
        assert result is not None
        assert abs(result[0]["close"] - 9999.99) < 1e-4


class TestCalibrationCache:
    def test_calibration_miss_returns_none(self):
        result = get_calibration("AAPL", "2024-01-01")
        assert result is None

    def test_calibration_write_then_read(self):
        payload = {"mean": 0.05, "std": 0.12, "percentile_95": 0.45}
        save_calibration("AAPL", "2024-01-01", payload)
        result = get_calibration("AAPL", "2024-01-01")
        assert result is not None
        assert result["mean"] == 0.05
        assert result["std"] == 0.12

    def test_calibration_date_isolation(self):
        payload = {"mean": 0.1}
        save_calibration("AAPL", "2024-01-01", payload)
        result = get_calibration("AAPL", "2024-01-02")
        assert result is None

    def test_calibration_symbol_isolation(self):
        payload = {"mean": 0.1}
        save_calibration("AAPL", "2024-01-01", payload)
        result = get_calibration("TSLA", "2024-01-01")
        assert result is None
