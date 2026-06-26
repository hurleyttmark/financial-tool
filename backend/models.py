"""
models.py — Pydantic models for all API request/response shapes.
"""
from pydantic import BaseModel, Field
from typing import Optional


class OHLCVBar(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class PulseBar(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    pulse: float = Field(ge=-1.0, le=1.0)
    fib_score: float
    candle_score: float
    wyckoff_score: float
    wyckoff_phase: str
    conviction: str


class AnalysisResponse(BaseModel):
    symbol: str
    bars: list[PulseBar]
    bar_count: int
    source: str
    cached: bool


class ErrorResponse(BaseModel):
    detail: str
    symbol: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    data_source: str
