"""OHLCV fetching via yfinance with an on-disk, daily-refresh cache.

Yahoo aggressively rate-limits datacenter IPs (Render, Fly, AWS...), so every
symbol is fetched at most once per calendar day (UTC) and persisted to disk.
Batch downloads are chunked and fall back to stale cache on failure.
"""
from __future__ import annotations

import logging
import os
import pickle
import threading
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

log = logging.getLogger(__name__)

CACHE_DIR = Path(os.getenv("CACHE_DIR", Path(__file__).resolve().parent.parent / ".cache"))
HISTORY_PERIOD = os.getenv("HISTORY_PERIOD", "3y")  # enough for 2y lookback + 52wk/150d windows
BATCH_SIZE = int(os.getenv("YF_BATCH_SIZE", "50"))
COLUMNS = ["Open", "High", "Low", "Close", "Volume"]

_mem: dict[str, tuple[str, pd.DataFrame]] = {}
_failed: dict[str, str] = {}  # symbol -> day Yahoo returned nothing (don't retry until tomorrow)
_lock = threading.Lock()


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _path(symbol: str) -> Path:
    return CACHE_DIR / f"{symbol}.pkl"


def _read_disk(symbol: str) -> tuple[str, pd.DataFrame] | None:
    p = _path(symbol)
    if not p.exists():
        return None
    try:
        with p.open("rb") as f:
            return pickle.load(f)
    except Exception:  # corrupt cache entry
        return None


def _write(symbol: str, df: pd.DataFrame) -> None:
    entry = (_today(), df)
    with _lock:
        _mem[symbol] = entry
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with _path(symbol).open("wb") as f:
        pickle.dump(entry, f)


def _cached(symbol: str, allow_stale: bool = False) -> pd.DataFrame | None:
    entry = _mem.get(symbol) or _read_disk(symbol)
    if entry is None:
        return None
    _mem[symbol] = entry
    day, df = entry
    return df if (allow_stale or day == _today()) else None


def _download(symbols: list[str]) -> dict[str, pd.DataFrame]:
    import yfinance as yf

    out: dict[str, pd.DataFrame] = {}
    for i in range(0, len(symbols), BATCH_SIZE):
        chunk = symbols[i : i + BATCH_SIZE]
        try:
            raw = yf.download(
                chunk, period=HISTORY_PERIOD, interval="1d", auto_adjust=True,
                group_by="ticker", threads=True, progress=False,
            )
        except Exception as exc:
            log.warning("yfinance batch failed (%s): %s", chunk[:3], exc)
            continue
        if raw is None or raw.empty:
            continue
        for sym in chunk:
            try:
                df = raw[sym] if isinstance(raw.columns, pd.MultiIndex) else raw
                df = df[COLUMNS].dropna(subset=["Close"])
            except KeyError:
                continue
            if len(df):
                df.index = pd.to_datetime(df.index).tz_localize(None)
                out[sym] = df
    return out


def get_history(symbols: list[str]) -> dict[str, pd.DataFrame]:
    """Return {symbol: OHLCV DataFrame}; fetches only symbols not cached today."""
    result: dict[str, pd.DataFrame] = {}
    missing: list[str] = []
    today = _today()
    for s in symbols:
        if _failed.get(s) == today:
            if (stale := _cached(s, allow_stale=True)) is not None:
                result[s] = stale
            continue
        df = _cached(s)
        if df is not None:
            result[s] = df
        else:
            missing.append(s)
    if missing:
        fetched = _download(missing)
        for s, df in fetched.items():
            _write(s, df)
            result[s] = df
        for s in missing:  # fall back to yesterday's data if Yahoo refused us
            if s in result:
                continue
            _failed[s] = today
            if (stale := _cached(s, allow_stale=True)) is not None:
                result[s] = stale
    return result


def get_one(symbol: str) -> pd.DataFrame | None:
    return get_history([symbol]).get(symbol)
