"""Same-stage chart matcher API."""
from __future__ import annotations

import logging
import os
from typing import Literal

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import data, similarity, universe
from .stage_classifier import STAGES, classify, compute_features

logging.basicConfig(level=logging.INFO)

LOOKBACK_DAYS = {"6mo": 126, "1y": 252, "2y": 504}
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MIN_IMAGE_BYTES = 8 * 1024  # smaller than this is almost certainly a thumbnail/low-quality capture

app = FastAPI(title="StockPicker — Same-Stage Chart Matcher", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SymbolMatchRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=12, examples=["NVDA"])
    lookback: Literal["6mo", "1y", "2y"] = "1y"
    universe: str = universe.DEFAULT_UNIVERSE
    limit: int = Field(12, ge=1, le=50)
    same_stage_only: bool = True


def _stats(f) -> dict:
    return {
        "pct_from_high": round(f.pct_from_high, 4),
        "dist_from_ma": round(f.dist_from_ma, 4),
        "relative_volume": round(f.relative_volume, 3),
        "volatility": round(f.volatility, 4),
        "volume_trend": round(f.volume_trend, 3),
    }


def _series(df: pd.DataFrame, lookback: int) -> list[dict]:
    c = df["Close"].tail(lookback)
    base = float(c.iloc[0])
    return [{"time": d.strftime("%Y-%m-%d"), "value": round((float(v) / base - 1) * 100, 3)} for d, v in c.items()]


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/universes")
def universes() -> list[dict]:
    return universe.list_universes()


@app.get("/api/symbols")
def symbols(universe_id: str = universe.DEFAULT_UNIVERSE) -> list[dict]:
    try:
        return universe.load_universe(universe_id).to_dict("records")
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.post("/api/match/symbol")
def match_symbol(req: SymbolMatchRequest) -> dict:
    sym = universe.to_yahoo(req.symbol)
    lookback = LOOKBACK_DAYS[req.lookback]
    try:
        uni = universe.load_universe(req.universe)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc

    qdf = data.get_one(sym)
    if qdf is None:
        raise HTTPException(404, f"No price data for '{sym}'")
    q = classify(qdf, lookback)
    if q is None:
        raise HTTPException(422, f"Not enough history for '{sym}' to classify")
    qf = compute_features(qdf, lookback)
    q_path = similarity.normalized_path(qdf["Close"], lookback)

    candidates = [s for s in uni["symbol"] if s != sym]
    history = data.get_history(candidates)
    meta = uni.set_index("symbol").to_dict("index")

    matches, stage_counts, skipped_liquidity = [], {s: 0 for s in STAGES}, 0
    for s, df in history.items():
        if not universe.passes_liquidity(df["Volume"]):
            skipped_liquidity += 1
            continue
        res = classify(df, lookback)
        if res is None:
            continue
        stage_counts[res.stage] += 1
        if req.same_stage_only and res.stage != q.stage:
            continue
        cf = compute_features(df, lookback)
        sim = similarity.score(q_path, qf, similarity.normalized_path(df["Close"], lookback), cf)
        matches.append({
            "symbol": s,
            "name": meta.get(s, {}).get("name", s),
            "sector": meta.get(s, {}).get("sector", ""),
            "stage": res.stage,
            "confidence": res.confidence,
            "rationale": res.rationale,
            "similarity": sim["score"],
            "components": sim["components"],
            "stats": _stats(cf),
            "_df": df,
        })

    matches.sort(key=lambda m: m["similarity"], reverse=True)
    if req.same_stage_only:
        top = matches[: req.limit]
    else:  # top `limit` per stage so the UI can filter by stage chips
        top = [m for st in STAGES for m in [x for x in matches if x["stage"] == st][: req.limit]]
        top.sort(key=lambda m: m["similarity"], reverse=True)
    for m in top:
        df = m.pop("_df")
        series = _series(df, lookback)
        m["series"] = series
        m["sparkline"] = similarity.downsample(pd.Series([p["value"] for p in series]), 48)

    qmeta = universe.symbol_meta(sym)
    return {
        "query": {
            "symbol": sym,
            "name": qmeta.get("name", sym),
            "sector": qmeta.get("sector", ""),
            "stage": q.stage,
            "confidence": q.confidence,
            "rationale": q.rationale,
            "scores": q.scores,
            "stats": _stats(qf),
            "series": _series(qdf, lookback),
        },
        "matches": top,
        "meta": {
            "lookback": req.lookback,
            "universe": req.universe,
            "universe_size": len(uni),
            "evaluated": len(history),
            "skipped_low_volume": skipped_liquidity,
            "stage_counts": stage_counts,
        },
    }


@app.post("/api/match/image")
async def match_image(file: UploadFile = File(...)) -> dict:
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(415, "Please upload a PNG, JPEG or WebP chart image.")
    content = await file.read(MAX_IMAGE_BYTES + 1)
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image too large (max 8 MB).")
    if len(content) < MIN_IMAGE_BYTES:
        raise HTTPException(422, "Image looks too small or low-quality to read. Try a larger screenshot or enter the symbol.")

    # TODO(vision): plug a vision model in here. It should
    #   1) extract the ticker symbol (and timeframe) from the chart header/watermark, and/or
    #   2) digitise the price line into a normalized close series,
    # then reuse match_symbol() (or similarity.score on the digitised path) to rank matches.
    return {
        "status": "unsupported",
        "detected_symbol": None,
        "message": "Chart image recognition is coming soon. Enter the ticker symbol to find same-stage matches.",
        "filename": file.filename,
        "bytes": len(content),
    }
