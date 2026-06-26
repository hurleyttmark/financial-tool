"""
main.py — FastAPI application entry point.

Endpoints:
  GET  /health                  — liveness check
  GET  /api/analyze/{symbol}    — full batch analysis (REST fallback)
  WS   /ws/analyze/{symbol}     — streaming pulse computation bar-by-bar
"""
import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from cache import init_db, get_cached_bars, save_bars, get_calibration, save_calibration
from fetcher import fetch_bars
from pulse import compute_pulse
from rate_limiter import limiter, get_limiter, TokenBucketLimiter
from models import AnalysisResponse, HealthResponse, PulseBar
from logger import log


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    log.info("STARTUP | data_source=%s | db=%s", settings.data_source, settings.db_path)
    yield
    log.info("SHUTDOWN")


app = FastAPI(title="Financial Pulse Analyzer", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────
# Health
# ──────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", data_source=settings.data_source)


# ──────────────────────────────────────────────
# REST endpoint (batch — useful for testing)
# ──────────────────────────────────────────────

@app.get("/api/analyze/{symbol}", response_model=AnalysisResponse)
async def analyze_rest(
    symbol: str,
    rate_limiter: TokenBucketLimiter = Depends(get_limiter),
):
    sym = symbol.strip().upper()
    if not sym or len(sym) > 10:
        raise HTTPException(status_code=400, detail=f"Invalid ticker symbol: '{symbol}'")

    cached_raw = get_cached_bars(sym)
    was_cached = cached_raw is not None and len(cached_raw) >= 50

    try:
        bars = await fetch_bars(sym, rate_limiter)
    except ValueError as exc:
        msg = str(exc)
        if "fewer" in msg or "Insufficient" in msg or "no data" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    if len(bars) < 50:
        raise HTTPException(
            status_code=404,
            detail=f"'{sym}' has only {len(bars)} bars (minimum 50 required). It may be newly listed or delisted.",
        )

    try:
        enriched = compute_pulse(bars)
    except Exception as exc:
        log.error("PULSE ERROR | symbol=%s | error=%s", sym, str(exc))
        raise HTTPException(status_code=500, detail=f"Pulse computation failed: {exc}")

    pulse_bars = [PulseBar(**b) for b in enriched]

    return AnalysisResponse(
        symbol=sym,
        bars=pulse_bars,
        bar_count=len(pulse_bars),
        source=settings.data_source,
        cached=was_cached,
    )


# ──────────────────────────────────────────────
# WebSocket endpoint — streams bars progressively
# ──────────────────────────────────────────────

@app.websocket("/ws/analyze/{symbol}")
async def analyze_ws(websocket: WebSocket, symbol: str):
    await websocket.accept()
    sym = symbol.strip().upper()
    log.info("WS OPEN | symbol=%s", sym)

    if not sym or len(sym) > 10:
        await websocket.send_json(
            {"type": "error", "message": f"Invalid ticker symbol: '{symbol}'"}
        )
        await websocket.close()
        return

    # Send status immediately
    await websocket.send_json({"type": "status", "message": f"Fetching data for {sym}…"})

    try:
        bars = await fetch_bars(sym, limiter)
    except ValueError as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
        await websocket.close()
        return
    except RuntimeError as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
        await websocket.close()
        return
    except Exception as exc:
        log.error("WS FETCH ERROR | symbol=%s | error=%s", sym, str(exc))
        await websocket.send_json({"type": "error", "message": f"Data fetch failed: {exc}"})
        await websocket.close()
        return

    if len(bars) < 50:
        await websocket.send_json(
            {
                "type": "error",
                "message": f"'{sym}' has only {len(bars)} bars (minimum 50 required). It may be newly listed or delisted.",
            }
        )
        await websocket.close()
        return

    await websocket.send_json(
        {"type": "status", "message": f"Computing pulse for {len(bars)} bars…"}
    )

    try:
        enriched = compute_pulse(bars)
    except Exception as exc:
        log.error("WS PULSE ERROR | symbol=%s | error=%s", sym, str(exc))
        await websocket.send_json({"type": "error", "message": f"Pulse computation failed: {exc}"})
        await websocket.close()
        return

    # Stream bars in chunks for progressive rendering
    CHUNK = 20
    try:
        for i in range(0, len(enriched), CHUNK):
            chunk = enriched[i : i + CHUNK]
            await websocket.send_json({"type": "bars", "bars": chunk})
            await asyncio.sleep(0)  # yield to event loop — allows first bars < 200ms

        await websocket.send_json(
            {
                "type": "complete",
                "symbol": sym,
                "bar_count": len(enriched),
                "source": settings.data_source,
            }
        )
        log.info("WS COMPLETE | symbol=%s | bars=%d", sym, len(enriched))
    except WebSocketDisconnect:
        log.info("WS DISCONNECT | symbol=%s", sym)
    except Exception as exc:
        log.error("WS STREAM ERROR | symbol=%s | error=%s", sym, str(exc))
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
