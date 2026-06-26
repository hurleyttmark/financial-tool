"""
pulse.py — Fused pulse computation engine.

Components:
  1. Fibonacci MA Momentum   — EMAs at Fibonacci periods (8,13,21,34,55,89) → momentum score
  2. Candlestick Conviction  — pattern-based score per bar (doji, hammer, engulfing, etc.)
  3. Wyckoff Cycle Proxy     — volume/price spread proxy for accumulation/distribution phases

Final pulse = weighted fusion, bounded to [−1, +1].
Calibration: 252-bar rolling normalization of momentum component.
"""
import numpy as np
from typing import Any


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _ema(arr: np.ndarray, period: int) -> np.ndarray:
    """Exponential moving average, NaN-filled for warm-up period."""
    alpha = 2.0 / (period + 1)
    out = np.full(len(arr), np.nan)
    if len(arr) < period:
        return out
    out[period - 1] = np.mean(arr[:period])
    for i in range(period, len(arr)):
        out[i] = alpha * arr[i] + (1 - alpha) * out[i - 1]
    return out


def _rolling_zscore(arr: np.ndarray, window: int = 252) -> np.ndarray:
    """Rolling z-score normalisation."""
    out = np.full(len(arr), np.nan)
    for i in range(window - 1, len(arr)):
        sl = arr[i - window + 1 : i + 1]
        mu = np.nanmean(sl)
        sd = np.nanstd(sl)
        if sd > 1e-10:
            out[i] = (arr[i] - mu) / sd
    return out


def _clip(arr: np.ndarray) -> np.ndarray:
    return np.clip(arr, -1.0, 1.0)


def _tanh_norm(arr: np.ndarray) -> np.ndarray:
    """Map any range to (−1, +1) via tanh."""
    return np.tanh(arr)


# ──────────────────────────────────────────────
# Component 1: Fibonacci MA Momentum
# ──────────────────────────────────────────────

FIB_PERIODS = [8, 13, 21, 34, 55, 89]
FIB_WEIGHTS = np.array([0.30, 0.25, 0.20, 0.12, 0.08, 0.05])  # sum=1.0


def compute_fib_momentum(closes: np.ndarray) -> np.ndarray:
    """
    For each Fibonacci period, compute (close - EMA) / EMA as fractional deviation.
    Weighted sum across periods, then tanh-normalise.
    Uses adaptive z-score window; early bars fall back to raw-scaled tanh.
    Returns array of length n, bounded [-1, +1].
    """
    n = len(closes)
    composite = np.zeros(n)
    valid_mask = np.zeros(n, dtype=bool)

    for period, weight in zip(FIB_PERIODS, FIB_WEIGHTS):
        ema = _ema(closes, period)
        dev = np.where(ema > 1e-10, (closes - ema) / ema, np.nan)
        mask = ~np.isnan(dev)
        composite[mask] += weight * dev[mask]
        valid_mask |= mask

    composite[~valid_mask] = np.nan

    # Adaptive window: never require more than half the available bars
    zscore_window = max(20, min(252, n // 2))
    zscored = _rolling_zscore(composite, window=zscore_window)

    # Bars before z-score window fills: use tanh of raw composite scaled to similar range
    raw_scaled = np.tanh(composite * 30.0)
    result = np.where(np.isnan(zscored), raw_scaled, np.tanh(zscored))
    result = np.nan_to_num(result, nan=0.0)
    return np.clip(result, -1.0, 1.0)


# ──────────────────────────────────────────────
# Component 2: Candlestick Conviction
# ──────────────────────────────────────────────

def _body_size(o: float, c: float) -> float:
    return abs(c - o)


def _full_range(h: float, l: float) -> float:
    return max(h - l, 1e-10)


def _upper_wick(o: float, h: float, c: float) -> float:
    return h - max(o, c)


def _lower_wick(o: float, l: float, c: float) -> float:
    return min(o, c) - l


def score_single_candle(
    o: float, h: float, l: float, c: float,
    prev_o: float, prev_h: float, prev_l: float, prev_c: float,
) -> float:
    """
    Score a single candle bar in [−1, +1].
    Positive = bullish conviction; negative = bearish conviction; near-zero = neutral.
    Patterns checked (ordered by priority):
      Bullish: Hammer, Bullish Engulfing, Morning Doji Star (simplified), Marubozu bull
      Bearish: Shooting Star, Bearish Engulfing, Marubozu bear, Gravestone Doji
      Neutral: Doji
    """
    rng = _full_range(h, l)
    body = _body_size(o, c)
    body_ratio = body / rng
    upper = _upper_wick(o, h, c)
    lower = _lower_wick(o, l, c)
    bullish_candle = c >= o
    prev_bullish = prev_c >= prev_o
    prev_body = _body_size(prev_o, prev_c)
    score = 0.0

    # Doji — indecision
    if body_ratio < 0.05:
        # Gravestone doji (upper wick dominates, at resistance)
        if upper > 2 * lower and upper > 0.6 * rng:
            score = -0.35
        # Dragonfly doji (lower wick dominates, at support)
        elif lower > 2 * upper and lower > 0.6 * rng:
            score = +0.35
        else:
            score = 0.0
    # Bullish Engulfing
    elif (
        bullish_candle
        and not prev_bullish
        and o < prev_c
        and c > prev_o
        and body > prev_body * 0.8
    ):
        score = +0.85
    # Bearish Engulfing
    elif (
        not bullish_candle
        and prev_bullish
        and o > prev_c
        and c < prev_o
        and body > prev_body * 0.8
    ):
        score = -0.85
    # Hammer (bullish reversal at bottom of range)
    elif (
        lower > 2 * body
        and lower > 2 * upper
        and body_ratio > 0.05
        and bullish_candle
    ):
        score = +0.70
    # Shooting Star (bearish reversal at top of range)
    elif (
        upper > 2 * body
        and upper > 2 * lower
        and body_ratio > 0.05
        and not bullish_candle
    ):
        score = -0.70
    # Bullish Marubozu (no wicks, strong bull)
    elif bullish_candle and body_ratio > 0.85:
        score = +0.60
    # Bearish Marubozu (no wicks, strong bear)
    elif not bullish_candle and body_ratio > 0.85:
        score = -0.60
    # Spinning top / minor indecision
    elif body_ratio < 0.30:
        score = 0.0
    else:
        # Default: proportional to body direction
        score = (0.3 * body_ratio) * (1.0 if bullish_candle else -1.0)

    return float(np.clip(score, -1.0, 1.0))


def compute_candlestick_conviction(
    opens: np.ndarray, highs: np.ndarray, lows: np.ndarray, closes: np.ndarray
) -> np.ndarray:
    """Score each bar. First bar gets a neutral score (no prior bar)."""
    n = len(closes)
    scores = np.zeros(n)
    for i in range(1, n):
        scores[i] = score_single_candle(
            opens[i], highs[i], lows[i], closes[i],
            opens[i - 1], highs[i - 1], lows[i - 1], closes[i - 1],
        )
    return scores


# ──────────────────────────────────────────────
# Component 3: Wyckoff Cycle Proxy
# ──────────────────────────────────────────────

def compute_wyckoff_proxy(
    opens: np.ndarray,
    highs: np.ndarray,
    lows: np.ndarray,
    closes: np.ndarray,
    volumes: np.ndarray,
    window: int = 20,
) -> np.ndarray:
    """
    V1 proxy (no volume profile clustering per spec [6]).
    Uses two signals:
      a) Price spread efficiency: (close − open) / (high − low)  → effort vs result
      b) Volume-weighted directional pressure: money flow oscillator vs rolling mean

    Wyckoff phases mapped:
      Accumulation  → positive (smart money absorbing supply)
      Distribution  → negative (smart money distributing)
      Mark-up/down  → amplified momentum confirmation
    """
    n = len(closes)
    proxy = np.zeros(n)

    for i in range(window, n):
        sl_o = opens[i - window : i + 1]
        sl_h = highs[i - window : i + 1]
        sl_l = lows[i - window : i + 1]
        sl_c = closes[i - window : i + 1]
        sl_v = volumes[i - window : i + 1]

        rng = sl_h - sl_l
        rng = np.where(rng < 1e-10, 1e-10, rng)

        # Price spread efficiency
        spread_eff = (sl_c - sl_o) / rng  # −1 to +1 per bar

        # Money flow proxy: (typical_price − low) / range * volume
        typical = (sl_h + sl_l + sl_c) / 3.0
        mf = ((typical - sl_l) / rng) * sl_v  # 0..1 * volume

        total_vol = np.sum(sl_v)
        if total_vol > 0:
            mf_ratio = np.sum(mf) / total_vol  # 0..1; 0.5 is neutral
            mf_signal = (mf_ratio - 0.5) * 2.0  # −1..+1
        else:
            mf_signal = 0.0

        # Current bar spread efficiency (most recent)
        cur_spread = spread_eff[-1]

        # Volume surge: current vs rolling mean (amplifier)
        vol_mean = np.mean(sl_v[:-1]) if len(sl_v) > 1 else sl_v[-1]
        vol_surge = min(sl_v[-1] / max(vol_mean, 1.0), 3.0) / 3.0  # 0..1

        # Combine: spread efficiency + money flow, amplified by volume surge
        raw = 0.5 * cur_spread + 0.5 * mf_signal
        proxy[i] = float(np.clip(raw * (0.5 + 0.5 * vol_surge), -1.0, 1.0))

    # Fill warmup with forward-fill from first valid
    if window < n:
        proxy[:window] = proxy[window]

    return proxy


# ──────────────────────────────────────────────
# Wyckoff phase label (for tooltip)
# ──────────────────────────────────────────────

def wyckoff_phase_label(value: float) -> str:
    if value > 0.4:
        return "Mark-Up"
    elif value > 0.1:
        return "Accumulation"
    elif value > -0.1:
        return "Neutral"
    elif value > -0.4:
        return "Distribution"
    else:
        return "Mark-Down"


# ──────────────────────────────────────────────
# Fusion
# ──────────────────────────────────────────────

WEIGHTS = {
    "fib_momentum": 0.40,
    "candlestick": 0.30,
    "wyckoff": 0.30,
}


def compute_pulse(bars: list[dict]) -> list[dict]:
    """
    Main entry point. Accepts list of OHLCV dicts, returns enriched list with
    pulse values and per-component scores for each bar.

    Each output dict adds:
      pulse          float [−1, +1]  fused signal
      fib_score      float           Fibonacci MA momentum component
      candle_score   float           candlestick conviction component
      wyckoff_score  float           Wyckoff proxy component
      wyckoff_phase  str             phase label
      conviction     str             human-readable conviction label
    """
    if len(bars) < 2:
        raise ValueError("Need at least 2 bars to compute pulse.")

    opens = np.array([b["open"] for b in bars], dtype=float)
    highs = np.array([b["high"] for b in bars], dtype=float)
    lows = np.array([b["low"] for b in bars], dtype=float)
    closes = np.array([b["close"] for b in bars], dtype=float)
    volumes = np.array([b["volume"] for b in bars], dtype=float)

    fib = compute_fib_momentum(closes)
    candle = compute_candlestick_conviction(opens, highs, lows, closes)
    wyckoff = compute_wyckoff_proxy(opens, highs, lows, closes, volumes)

    fused = (
        WEIGHTS["fib_momentum"] * fib
        + WEIGHTS["candlestick"] * candle
        + WEIGHTS["wyckoff"] * wyckoff
    )
    pulse = np.clip(fused, -1.0, 1.0)

    result = []
    for i, bar in enumerate(bars):
        p = float(pulse[i])
        result.append(
            {
                **bar,
                "pulse": round(p, 4),
                "fib_score": round(float(fib[i]), 4),
                "candle_score": round(float(candle[i]), 4),
                "wyckoff_score": round(float(wyckoff[i]), 4),
                "wyckoff_phase": wyckoff_phase_label(float(wyckoff[i])),
                "conviction": _conviction_label(p),
            }
        )
    return result


def _conviction_label(pulse: float) -> str:
    if pulse > 0.6:
        return "Strong Bull"
    elif pulse > 0.2:
        return "Moderate Bull"
    elif pulse > -0.2:
        return "Neutral"
    elif pulse > -0.6:
        return "Moderate Bear"
    else:
        return "Strong Bear"

