# Financial Pulse Analyzer

A local full-stack financial analysis tool that fetches 300 daily OHLCV bars and fuses
**Fibonacci MA Momentum**, **Candlestick Conviction**, and **Wyckoff Cycle Proxy** into
a single continuous pulse value bounded [−1, +1].

## Architecture

```
frontend (React/Vite :5173)
    │  WebSocket /ws/analyze/{symbol}
    │  REST GET  /api/analyze/{symbol}
    ▼
backend (FastAPI/uvicorn :8000)
    │  Token-bucket rate limiter (5 req/min)
    │  SQLite cache (24h TTL)
    ▼
Alpha Vantage API  ─── or ─── yfinance (fallback)
```

## Quick Start

### 1. Backend

```bash
cd backend

# Copy and fill in env
cp .env.example .env
# Edit .env — set ALPHA_VANTAGE_API_KEY to your free key
# (get one at https://www.alphavantage.co/support/#api-key)

# Create virtualenv (recommended)
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The server validates required env vars at startup and exits with a named list of
missing vars before binding the port.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**, type a ticker (e.g. `AAPL`), press Enter.

---

## Using yfinance fallback (no API key required)

```env
# .env
DATA_SOURCE=yfinance
```

yfinance requires no API key and has no rate limits but may have different data quality.
All error handling is identical to the Alpha Vantage path.

---

## Running tests

```bash
cd backend
pytest tests/ -v
```

Tests cover:
- `test_pulse.py` — pulse bounds, component scorers, labels
- `test_cache.py` — SQLite write/read round-trip, TTL expiry, upsert

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ALPHA_VANTAGE_API_KEY` | Yes (unless `DATA_SOURCE=yfinance`) | — | Alpha Vantage free API key |
| `DATA_SOURCE` | No | `alphavantage` | `alphavantage` or `yfinance` |
| `DB_PATH` | No | `./cache.db` | SQLite database file path |
| `LOG_PATH` | No | `./app.log` | Rotating log file path |

---

## Pulse Components

| Component | Weight | Description |
|---|---|---|
| Fibonacci MA Momentum | 40% | EMAs at periods 8,13,21,34,55,89 — price deviation, z-scored and tanh-normalised |
| Candlestick Conviction | 30% | Pattern scoring: engulfing, hammer, shooting star, doji, marubozu |
| Wyckoff Cycle Proxy | 30% | Price spread efficiency + volume-weighted money flow (v1 proxy) |

Fused pulse = weighted sum, clipped to [−1, +1].

**Conviction labels:**
- Strong Bull: pulse > 0.6
- Moderate Bull: 0.2 – 0.6
- Neutral: −0.2 – 0.2
- Moderate Bear: −0.6 – −0.2
- Strong Bear: pulse < −0.6

**Wyckoff phases:** Mark-Up / Accumulation / Neutral / Distribution / Mark-Down

---

## Features

- **Candlestick chart** with Wyckoff background colour bands
- **Oscillator lane** with coloured fill, pulse line, ±0.2/±0.6 threshold markers
- **Heatmap strip** — 8-bucket pulse summary across visible range
- **Conviction tooltip** on hover — OHLCV + all component scores + Wyckoff phase
- **Replay scrubber** — drag to animate historical pulse bar-by-bar
- **WebSocket streaming** — chart renders incrementally as computation completes
- **SQLite cache** — 24h TTL, avoids redundant Alpha Vantage calls
- **Token-bucket rate limiter** — server-side 5 req/min enforcement
- **Rotating log** — every outbound API call logged to `app.log`

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `GET` | `/api/analyze/{symbol}` | Full batch analysis (REST) |
| `WS` | `/ws/analyze/{symbol}` | Streaming pulse computation |

---

## Architecture Notes (from conflict resolution)

- **CONFLICT A** — Alpha Vantage is primary; yfinance is `DATA_SOURCE=yfinance` fallback only
- **CONFLICT B** — WebSocket streams computed bars progressively (no live price feed implied)
- **CONFLICT C** — SQLite caches raw OHLCV (24h TTL) and calibration separately
- **CONFLICT D** — Local single-user: token bucket + rotating log file; no cloud dashboard
- **CONFLICT E** — CORS allows only `localhost:5173` and `127.0.0.1:5173`; no wildcard
- **CONFLICT F** — Layout self-check at 320px/1400px omitted per RUNTIME CONTEXT
