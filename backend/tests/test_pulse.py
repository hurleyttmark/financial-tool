"""
test_pulse.py — Tests for pulse computation bounds and component scorers.
"""
import numpy as np
import pytest

from pulse import (
    compute_pulse,
    compute_fib_momentum,
    compute_candlestick_conviction,
    compute_wyckoff_proxy,
    score_single_candle,
    _conviction_label,
    wyckoff_phase_label,
)


class TestPulseBounds:
    def test_pulse_bounded_30_bars(self, synthetic_bars_30):
        result = compute_pulse(synthetic_bars_30)
        pulses = [b["pulse"] for b in result]
        assert all(-1.0 <= p <= 1.0 for p in pulses), (
            f"Pulse out of bounds: min={min(pulses):.4f} max={max(pulses):.4f}"
        )

    def test_pulse_bounded_300_bars(self, synthetic_bars_300):
        result = compute_pulse(synthetic_bars_300)
        pulses = [b["pulse"] for b in result]
        assert all(-1.0 <= p <= 1.0 for p in pulses), (
            f"Pulse out of bounds: min={min(pulses):.4f} max={max(pulses):.4f}"
        )

    def test_pulse_output_length_matches_input(self, synthetic_bars_300):
        result = compute_pulse(synthetic_bars_300)
        assert len(result) == len(synthetic_bars_300)

    def test_pulse_output_has_required_keys(self, synthetic_bars_30):
        result = compute_pulse(synthetic_bars_30)
        required = {"date", "open", "high", "low", "close", "volume",
                    "pulse", "fib_score", "candle_score", "wyckoff_score",
                    "wyckoff_phase", "conviction"}
        for bar in result:
            assert required.issubset(bar.keys()), f"Missing keys: {required - bar.keys()}"

    def test_pulse_raises_on_too_few_bars(self):
        with pytest.raises(ValueError, match="at least 2"):
            compute_pulse([])
        with pytest.raises(ValueError, match="at least 2"):
            compute_pulse([{"date": "2024-01-01", "open": 100, "high": 101,
                            "low": 99, "close": 100.5, "volume": 10000}])


class TestFibMomentum:
    def test_fib_output_bounded(self, synthetic_bars_300):
        closes = np.array([b["close"] for b in synthetic_bars_300])
        fib = compute_fib_momentum(closes)
        assert np.all(fib >= -1.0) and np.all(fib <= 1.0), "Fib momentum out of [-1,1]"

    def test_fib_length(self, synthetic_bars_300):
        closes = np.array([b["close"] for b in synthetic_bars_300])
        fib = compute_fib_momentum(closes)
        assert len(fib) == len(closes)

    def test_fib_positive_for_strong_uptrend(self):
        """Strong uptrend → positive Fibonacci momentum (use geometric price series)."""
        # Geometric series so price is always above all EMAs (no z-score collapse)
        closes = np.array([100.0 * (1.003 ** i) for i in range(300)])
        fib = compute_fib_momentum(closes)
        # After full warmup (89 bars for longest period + 252 for z-score), majority positive
        assert np.mean(fib[252:]) > 0.0


class TestCandlestickConviction:
    def test_candlestick_bounded(self, synthetic_bars_30):
        o = np.array([b["open"] for b in synthetic_bars_30])
        h = np.array([b["high"] for b in synthetic_bars_30])
        l = np.array([b["low"] for b in synthetic_bars_30])
        c = np.array([b["close"] for b in synthetic_bars_30])
        scores = compute_candlestick_conviction(o, h, l, c)
        assert np.all(scores >= -1.0) and np.all(scores <= 1.0)

    def test_bullish_engulfing_positive(self):
        score = score_single_candle(
            o=100, h=103, l=99, c=102,       # current: bullish
            prev_o=101, prev_h=102, prev_l=98, prev_c=99,  # prev: bearish
        )
        assert score > 0, f"Expected positive for bullish engulfing, got {score}"

    def test_bearish_engulfing_negative(self):
        score = score_single_candle(
            o=101, h=102, l=97, c=98,         # current: bearish
            prev_o=99, prev_h=102, prev_l=98, prev_c=100,  # prev: bullish
        )
        assert score < 0, f"Expected negative for bearish engulfing, got {score}"

    def test_hammer_positive(self):
        # Big lower wick, small body at top
        score = score_single_candle(
            o=100, h=100.3, l=97, c=100.2,
            prev_o=99, prev_h=100, prev_l=98, prev_c=99.5,
        )
        assert score > 0, f"Expected positive hammer, got {score}"

    def test_shooting_star_negative(self):
        # Big upper wick, small body at bottom
        score = score_single_candle(
            o=100, h=103, l=99.8, c=99.9,
            prev_o=100, prev_h=101, prev_l=99, prev_c=100.5,
        )
        assert score < 0, f"Expected negative shooting star, got {score}"


class TestWyckoffProxy:
    def test_wyckoff_bounded(self, synthetic_bars_300):
        o = np.array([b["open"] for b in synthetic_bars_300])
        h = np.array([b["high"] for b in synthetic_bars_300])
        l = np.array([b["low"] for b in synthetic_bars_300])
        c = np.array([b["close"] for b in synthetic_bars_300])
        v = np.array([b["volume"] for b in synthetic_bars_300])
        proxy = compute_wyckoff_proxy(o, h, l, c, v)
        assert np.all(proxy >= -1.0) and np.all(proxy <= 1.0)

    def test_wyckoff_length(self, synthetic_bars_300):
        o = np.array([b["open"] for b in synthetic_bars_300])
        h = np.array([b["high"] for b in synthetic_bars_300])
        l = np.array([b["low"] for b in synthetic_bars_300])
        c = np.array([b["close"] for b in synthetic_bars_300])
        v = np.array([b["volume"] for b in synthetic_bars_300])
        proxy = compute_wyckoff_proxy(o, h, l, c, v)
        assert len(proxy) == len(o)


class TestLabels:
    @pytest.mark.parametrize("pulse,expected", [
        (0.8, "Strong Bull"),
        (0.5, "Moderate Bull"),
        (0.0, "Neutral"),
        (-0.5, "Moderate Bear"),
        (-0.8, "Strong Bear"),
    ])
    def test_conviction_labels(self, pulse, expected):
        assert _conviction_label(pulse) == expected

    @pytest.mark.parametrize("value,expected", [
        (0.6, "Mark-Up"),
        (0.2, "Accumulation"),
        (0.0, "Neutral"),
        (-0.2, "Distribution"),
        (-0.6, "Mark-Down"),
    ])
    def test_wyckoff_phase_labels(self, value, expected):
        assert wyckoff_phase_label(value) == expected
