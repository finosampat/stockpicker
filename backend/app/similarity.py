"""Feature-based similarity ranking between a query chart and candidates.

score = 0.55 * shape correlation (normalized price path)
      + 0.20 * MA-distance closeness
      + 0.15 * volatility closeness
      + 0.10 * volume-trend closeness
All components are in [0, 1]; final score is reported as 0–100.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .stage_classifier import Features

RESAMPLE_POINTS = 64
WEIGHTS = {"shape": 0.55, "ma_distance": 0.20, "volatility": 0.15, "volume_trend": 0.10}


def normalized_path(close: pd.Series, lookback: int, points: int = RESAMPLE_POINTS) -> np.ndarray:
    """Cumulative % change over the lookback, resampled to a fixed length and z-scored."""
    c = close.tail(lookback).to_numpy(dtype=float)
    if len(c) < 2:
        return np.zeros(points)
    path = c / c[0] - 1
    x = np.linspace(0, len(path) - 1, points)
    r = np.interp(x, np.arange(len(path)), path)
    sd = r.std()
    return (r - r.mean()) / sd if sd > 0 else r * 0


def _closeness(a: float, b: float, scale: float) -> float:
    return float(np.exp(-abs(a - b) / scale))


def score(q_path: np.ndarray, q: Features, c_path: np.ndarray, c: Features) -> dict:
    corr = float(np.corrcoef(q_path, c_path)[0, 1]) if q_path.std() and c_path.std() else 0.0
    parts = {
        "shape": (np.nan_to_num(corr) + 1) / 2,
        "ma_distance": _closeness(q.dist_from_ma, c.dist_from_ma, 0.10),
        "volatility": _closeness(np.log(max(q.volatility, 1e-6)), np.log(max(c.volatility, 1e-6)), 0.5),
        "volume_trend": _closeness(q.volume_trend, c.volume_trend, 0.3),
    }
    total = sum(WEIGHTS[k] * v for k, v in parts.items())
    return {"score": round(100 * total, 1), "components": {k: round(v, 3) for k, v in parts.items()}}


def downsample(series: pd.Series, points: int) -> list[float]:
    v = series.to_numpy(dtype=float)
    if len(v) <= points:
        return v.tolist()
    idx = np.linspace(0, len(v) - 1, points).round().astype(int)
    return v[idx].tolist()
