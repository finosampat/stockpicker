# StockPicker — Same-Stage Chart Matcher

Drop a chart image or type a ticker, and StockPicker returns other stocks whose charts are in the **same Weinstein stage** (accumulation, markup, distribution, decline), ranked by chart similarity.

> **Similarity matches, not investment advice.** Output is a mechanical pattern comparison on public daily price data. It is not a recommendation to buy or sell any security.

## Features

- **Symbol matching** — classify a ticker's current stage and rank the universe by similarity over a 6mo / 1y / 2y lookback.
- **Image drop zone** — drag, drop or paste a chart screenshot. v1 validates the image and points you to symbol input; a vision model plugs into `POST /api/match/image` later (see `TODO(vision)` in `backend/app/main.py`).
- **Deterministic stage classifier** — price vs. 150-day (30-week) MA, MA slope, distance from 52-week high/low, volume trend → stage, confidence and a one-line rationale.
- **Feature-based similarity** — normalized price-path correlation, MA distance, volatility and volume trend.
- **Configurable universe** — S&P 500 + NASDAQ-100 by default (static CSVs), names averaging < 500k shares/day are excluded.
- **Trading-app UI** — dark, dense layout with shadcn/ui and TradingView Lightweight Charts; stage filter chips, compare panel (overlay / side-by-side), mock-data fallback when the backend is offline.

## Architecture

```
┌──────────────────────────── frontend/ (Vite + React + TS) ───────────────────────────┐
│ InputPanel ── DropZone / SymbolCombobox / Lookback ToggleGroup / Match               │
│ ResultsPanel ── stage Badge + confidence + rationale, stage chips, MatchCard grid    │
│ ComparePanel ── lightweight-charts overlay or side-by-side (% change)                │
│ lib/api.ts ── VITE_API_URL ─┐   (falls back to lib/mock.ts if backend is unreachable)│
└─────────────────────────────┼────────────────────────────────────────────────────────┘
                              ▼
┌──────────────────────────── backend/ (FastAPI) ──────────────────────────────────────┐
│ main.py            POST /api/match/symbol · POST /api/match/image · GET /api/...     │
│ universe.py        static CSV universes + liquidity filter                           │
│ data.py            yfinance batch download, on-disk cache refreshed once per day     │
│ stage_classifier.py  rules → stage + confidence + rationale                          │
│ similarity.py      feature-based scoring (0–100)                                     │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | Liveness check |
| `GET /api/universes` | Available universes and sizes |
| `GET /api/symbols?universe_id=sp500_ndx` | Symbols for the autocomplete |
| `POST /api/match/symbol` | `{symbol, lookback: "6mo"\|"1y"\|"2y", universe?, limit?, same_stage_only?}` → query stage + ranked matches |
| `POST /api/match/image` | multipart `file` → v1 placeholder response (`status: "unsupported"`); 415/413/422 for non-image, too large, low-quality |

See [`docs/design.md`](docs/design.md) for the stage taxonomy, rules, similarity method and UI spec.

## Run locally

Backend (Python 3.10+):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# http://localhost:8000/docs
```

The first full-universe request downloads ~3 years of daily bars for ~520 symbols (≈30–60 s); results are cached in `backend/.cache/` and refreshed once per day.

Frontend (Node 20+):

```bash
cd frontend
cp .env.example .env.local   # VITE_API_URL=http://localhost:8000
npm install
npm run dev                  # http://localhost:5173
```

Leave `VITE_API_URL` empty (or stop the backend) to run the UI on generated mock data — the header shows **Mock data** instead of **Live**.

Checks: `npm run lint`, `npm run build` (frontend).

## Configuration

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_API_URL` | frontend | – | Backend base URL |
| `CORS_ORIGINS` | backend | `*` | Comma-separated allowed origins |
| `DEFAULT_UNIVERSE` | backend | `sp500_ndx` | `sp500_ndx`, `sp500` or `ndx` |
| `MIN_AVG_VOLUME` | backend | `500000` | Liquidity filter (50-day avg shares) |
| `CACHE_DIR` | backend | `backend/.cache` | OHLCV cache location |
| `HISTORY_PERIOD` | backend | `3y` | yfinance history period |

Universe CSVs live in `backend/data/` (`symbol,name,sector`); add a file and register it in `UNIVERSES` in `backend/app/universe.py`.

## Deploy

Backend on Render (`render.yaml`) or any Docker host (`backend/Dockerfile`), frontend on Vercel. See [`docs/deploy.md`](docs/deploy.md).

## Disclaimer

Similarity matches, not investment advice. Data comes from Yahoo Finance via the unofficial `yfinance` library and may be delayed, incomplete or wrong. Use at your own risk.
