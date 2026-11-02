"""Configurable symbol universe backed by static CSVs in backend/data/."""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import pandas as pd

DATA_DIR = Path(os.getenv("UNIVERSE_DIR", Path(__file__).resolve().parent.parent / "data"))
MIN_AVG_VOLUME = int(os.getenv("MIN_AVG_VOLUME", "500000"))
DEFAULT_UNIVERSE = os.getenv("DEFAULT_UNIVERSE", "sp500_ndx")


@dataclass(frozen=True)
class UniverseDef:
    id: str
    label: str
    files: tuple[str, ...]


UNIVERSES: dict[str, UniverseDef] = {
    "sp500_ndx": UniverseDef("sp500_ndx", "S&P 500 + NASDAQ-100", ("sp500.csv", "nasdaq100.csv")),
    "sp500": UniverseDef("sp500", "S&P 500", ("sp500.csv",)),
    "ndx": UniverseDef("ndx", "NASDAQ-100", ("nasdaq100.csv",)),
}


def to_yahoo(symbol: str) -> str:
    """Yahoo uses '-' for share classes (BRK.B -> BRK-B)."""
    return symbol.strip().upper().replace(".", "-")


@lru_cache(maxsize=None)
def load_universe(universe_id: str = DEFAULT_UNIVERSE) -> pd.DataFrame:
    """Return DataFrame[symbol, name, sector] de-duplicated by symbol."""
    if universe_id not in UNIVERSES:
        raise KeyError(f"Unknown universe '{universe_id}'")
    frames = [pd.read_csv(DATA_DIR / f, dtype=str).fillna("") for f in UNIVERSES[universe_id].files]
    df = pd.concat(frames, ignore_index=True)
    df["symbol"] = df["symbol"].map(to_yahoo)
    return df.drop_duplicates("symbol").reset_index(drop=True)


def list_universes() -> list[dict]:
    return [{"id": u.id, "label": u.label, "count": len(load_universe(u.id))} for u in UNIVERSES.values()]


def symbol_meta(symbol: str) -> dict:
    df = load_universe("sp500_ndx")
    row = df[df["symbol"] == to_yahoo(symbol)]
    if row.empty:
        return {"symbol": to_yahoo(symbol), "name": to_yahoo(symbol), "sector": ""}
    return row.iloc[0].to_dict()


def passes_liquidity(volume: pd.Series, window: int = 50) -> bool:
    """Exclude thinly traded names: avg daily volume over `window` days < MIN_AVG_VOLUME."""
    v = volume.dropna().tail(window)
    return bool(len(v) and v.mean() >= MIN_AVG_VOLUME)
