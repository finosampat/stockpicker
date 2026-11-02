"""Deterministic Weinstein stage classifier.

Stage 1 accumulation: flat 30-week MA, price chopping around it, well off highs.
Stage 2 markup:       price above a rising MA, near 52-week highs.
Stage 3 distribution: MA flattening after an advance, price churning near highs.
Stage 4 decline:      price below a falling MA, near 52-week lows.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

MA_WINDOW = 150          # ~30 weeks
SLOPE_LOOKBACK = 20      # trading days (~1 month)
FLAT_SLOPE = 0.01        # |MA change over lookback| below 1% = flat
YEAR = 252
STAGES = ("accumulation", "markup", "distribution", "decline")


@dataclass
class Features:
    close: float
    ma: float
    dist_from_ma: float      # close / MA - 1
    ma_slope: float          # MA % change over SLOPE_LOOKBACK
    pct_from_high: float     # close / 52wk high - 1 (<= 0)
    pct_from_low: float      # close / 52wk low - 1 (>= 0)
    volume_trend: float      # 50d avg vol / 200d avg vol
    relative_volume: float   # last 5d avg vol / 50d avg vol
    volatility: float        # annualised stdev of daily returns over lookback


@dataclass
class StageResult:
    stage: str
    confidence: float
    rationale: str
    scores: dict
    features: dict


def compute_features(df: pd.DataFrame, lookback: int = YEAR) -> Features | None:
    close, vol = df["Close"].astype(float), df["Volume"].astype(float)
    if len(close) < MA_WINDOW + SLOPE_LOOKBACK:
        return None
    ma = close.rolling(MA_WINDOW).mean()
    last, ma_now, ma_prev = close.iloc[-1], ma.iloc[-1], ma.iloc[-1 - SLOPE_LOOKBACK]
    yr = close.tail(YEAR)
    rets = np.log(close).diff().tail(lookback).dropna()
    v50, v200 = vol.tail(50).mean(), vol.tail(200).mean()
    return Features(
        close=float(last),
        ma=float(ma_now),
        dist_from_ma=float(last / ma_now - 1),
        ma_slope=float(ma_now / ma_prev - 1),
        pct_from_high=float(last / yr.max() - 1),
        pct_from_low=float(last / yr.min() - 1),
        volume_trend=float(v50 / v200) if v200 else 1.0,
        relative_volume=float(vol.tail(5).mean() / v50) if v50 else 1.0,
        volatility=float(rets.std() * np.sqrt(YEAR)) if len(rets) > 1 else 0.0,
    )


def _clip(x: float) -> float:
    return float(min(1.0, max(0.0, x)))


def _stage_scores(f: Features) -> dict[str, float]:
    up = _clip(f.ma_slope / 0.04)                 # 1 when MA rose >= 4%/month
    down = _clip(-f.ma_slope / 0.04)
    flat = _clip(1 - abs(f.ma_slope) / 0.03)      # 1 when MA is perfectly flat
    above = _clip(f.dist_from_ma / 0.10)
    below = _clip(-f.dist_from_ma / 0.10)
    near_ma = _clip(1 - abs(f.dist_from_ma) / 0.10)
    near_high = _clip(1 + f.pct_from_high / 0.25)   # 1 at the high, 0 when 25% off
    near_low = _clip(1 - f.pct_from_low / 0.30)     # 1 at the low, 0 when 30% up
    vol_up = _clip((f.volume_trend - 0.9) / 0.4)
    # Trend stages are driven by MA slope; base stages are gated by MA flatness.
    return {
        "markup": 0.45 * up + 0.25 * max(above, 0.5 * near_ma) + 0.20 * near_high + 0.10 * vol_up * up,
        "decline": 0.45 * down + 0.25 * max(below, 0.5 * near_ma) + 0.20 * max(near_low, 1 - near_high) * down
        + 0.10 * down,
        "accumulation": flat * (0.45 + 0.30 * near_ma + 0.25 * (1 - near_high)),
        "distribution": flat * (0.45 + 0.30 * near_ma + 0.25 * near_high),
    }


def _rationale(stage: str, f: Features) -> str:
    rel = "above" if f.dist_from_ma >= 0 else "below"
    slope = "rising" if f.ma_slope > FLAT_SLOPE else "falling" if f.ma_slope < -FLAT_SLOPE else "flat"
    vol = "expanding" if f.volume_trend > 1.1 else "contracting" if f.volume_trend < 0.9 else "steady"
    return (
        f"Price {abs(f.dist_from_ma):.1%} {rel} a {slope} 30-wk MA ({f.ma_slope:+.1%}/mo), "
        f"{abs(f.pct_from_high):.0%} off 52-wk high, {vol} volume — consistent with {stage}."
    )


def classify(df: pd.DataFrame, lookback: int = YEAR) -> StageResult | None:
    f = compute_features(df, lookback)
    if f is None:
        return None
    scores = _stage_scores(f)
    stage = max(scores, key=scores.get)
    ranked = sorted(scores.values(), reverse=True)
    # Confidence blends absolute fit with the margin over the runner-up.
    confidence = _clip(0.6 * ranked[0] + 0.4 * (ranked[0] - ranked[1]) / max(ranked[0], 1e-9))
    return StageResult(
        stage=stage,
        confidence=round(confidence, 3),
        rationale=_rationale(stage, f),
        scores={k: round(v, 3) for k, v in scores.items()},
        features=asdict(f),
    )
