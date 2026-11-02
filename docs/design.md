# Design — Same-Stage Chart Matcher

## 1. Goal

Given a query chart (ticker symbol in v1, image later), determine its **Weinstein stage** and return other stocks in the same stage whose recent price action looks most alike, ranked by a 0–100 similarity score.

## 2. Stage taxonomy

| # | Stage | Typical picture |
| --- | --- | --- |
| 1 | **Accumulation** | After a decline, the 30-week MA flattens; price chops sideways around it, well below the old high. |
| 2 | **Markup** | Price breaks out and holds above a **rising** 30-week MA; higher highs near 52-week highs; volume expands. |
| 3 | **Distribution** | After an advance, the MA flattens; price churns near highs, often on heavy volume. |
| 4 | **Decline** | Price below a **falling** 30-week MA; lower lows near 52-week lows. |

## 3. Classification rules (`backend/app/stage_classifier.py`)

All rules use daily bars; the 30-week MA is approximated by the **150-day SMA**.

Features:

| Feature | Definition |
| --- | --- |
| `dist_from_ma` | close / MA150 − 1 |
| `ma_slope` | MA150 today / MA150 20 trading days ago − 1 |
| `pct_from_high` | close / 252-day high − 1 |
| `pct_from_low` | close / 252-day low − 1 |
| `volume_trend` | 50-day avg volume / 200-day avg volume |
| `relative_volume` | 5-day avg volume / 50-day avg volume |
| `volatility` | annualized stdev of daily log returns over the lookback |

Each feature is mapped to a soft `[0,1]` signal (clip-scaled), e.g. `up = clip(ma_slope / 4%)`, `flat = clip(1 − |ma_slope| / 3%)`, `near_high = clip(1 + pct_from_high / 25%)`, `near_ma = clip(1 − |dist_from_ma| / 10%)`.

```
markup       = 0.45·up   + 0.25·max(above, ½·near_ma) + 0.20·near_high + 0.10·vol_up·up
decline      = 0.45·down + 0.25·max(below, ½·near_ma) + 0.20·max(near_low, 1−near_high)·down + 0.10·down
accumulation = flat · (0.45 + 0.30·near_ma + 0.25·(1 − near_high))
distribution = flat · (0.45 + 0.30·near_ma + 0.25·near_high)
```

Trend stages are driven by MA slope; base stages are gated by MA flatness, so a pullback below a rising MA stays "markup". The stage is the arg-max.

**Confidence** = `0.6 · top_score + 0.4 · (top − runner_up) / top`, clipped to [0,1] — high when the fit is strong *and* unambiguous.

**Rationale** is templated from the features, e.g. *"Price 3.1% below a rising 30-wk MA (+2.8%/mo), 14% off 52-wk high, contracting volume — consistent with markup."*

Symbols need ≥ 170 bars; fewer → HTTP 422.

## 4. Similarity methodology (`backend/app/similarity.py`)

For the query and every candidate (same lookback window):

| Component | Weight | Computation |
| --- | --- | --- |
| Shape | 0.55 | Close path normalized to % change, resampled to 64 points, z-scored; Pearson correlation mapped to `(ρ+1)/2` |
| MA distance | 0.20 | `exp(−|Δ dist_from_ma| / 10%)` |
| Volatility | 0.15 | `exp(−|Δ ln volatility| / 0.5)` |
| Volume trend | 0.10 | `exp(−|Δ volume_trend| / 0.3)` |

`score = 100 · Σ weight · component`. Resampling makes the shape comparison independent of holidays/missing bars. By default (`same_stage_only=true`) only candidates in the query's stage are ranked; the UI requests `same_stage_only=false`, which returns the top `limit` per stage so the stage chips can switch without a refetch.

**Universe & liquidity**: `backend/data/sp500.csv` + `nasdaq100.csv` (deduped, Yahoo share-class notation `BRK-B`). Candidates with 50-day average volume < 500k shares are excluded and counted in `meta.skipped_low_volume`.

**Data**: `yfinance` batch downloads (50 tickers/request) of 3 years of adjusted daily bars, cached per symbol on disk and refreshed once per UTC day. Failed symbols aren't retried until the next day; stale cache is served if Yahoo refuses a request.

## 5. Image input (v1)

`POST /api/match/image` validates content type (415), size ≤ 8 MB (413) and a minimum size (422 "low-quality"). The frontend additionally rejects images smaller than 300×150 px. It returns `status: "unsupported"` with a message directing the user to symbol input. `TODO(vision)` marks where a vision model will (1) read the ticker/timeframe from the chart and/or (2) digitize the price line into a normalized series fed to `similarity.score`.

## 6. UI design spec

**Look & feel** — dark, fintech/trading-terminal aesthetic (TradingView / Bloomberg-lite). Muted navy-charcoal background (`hsl(222 24% 7%)`), cards one step lighter, 1px low-contrast borders, compact 11–13px type (Inter; JetBrains Mono for tickers and numbers, tabular figures). Primary accent is cyan; stages have dedicated accents used for badges, chips, sparklines and confidence bars:

| Stage | Color |
| --- | --- |
| Accumulation | cyan `#38bdf8` |
| Markup | green `#2fc785` |
| Distribution | amber `#f5a524` |
| Decline | red `#ea5455` |

Up/down numbers use green/red.

**Layout** (single page, full viewport):

```
┌ Header: logo · "StockPicker" · Live/Mock indicator · Universe Select · Methodology Sheet ┐
├──────────────┬───────────────────────────────────────────────────────────────────────────┤
│ Input Card   │ Results panel (resizable, top)                                            │
│  drop zone   │  summary Card: ticker · stage Badge · confidence Progress · rationale     │
│  ── or ──    │  stage filter chips (All / per stage, "same" tag, counts) · meta text     │
│  Combobox    │  grid of MatchCards (auto-fill, min 210px)                                │
│  Lookback    ├──────────────────── ResizableHandle ──────────────────────────────────────┤
│  Match btn   │ Compare panel (bottom): query vs selected match, Overlay | Side-by-side   │
├──────────────┴───────────────────────────────────────────────────────────────────────────┤
│ Footer: "Similarity matches, not investment advice." · data attribution                  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

On narrow screens the input card stacks above the results.

**shadcn/ui components** (hand-added under `frontend/src/components/ui/`): Card, Badge (stage variants), Button, Input, Command + Popover (Combobox), ToggleGroup, Progress, Tooltip, Select, Sheet, Skeleton, Resizable (react-resizable-panels).

**Behaviors**

- *Drop zone*: dashed border; highlights on drag-over; accepts drag/drop, click-to-browse and global paste (Ctrl/Cmd+V). Shows a thumbnail with a remove button. Low-quality/invalid images show an inline destructive alert under the zone; the v1 placeholder response shows an inline info note.
- *Symbol Combobox*: searchable by ticker prefix or company name (top 50 shown); selecting an item runs matching immediately; Enter on an unknown ticker submits it as-is.
- *Lookback ToggleGroup* (6mo/1y/2y): re-runs the current query.
- *Universe Select* (header): re-runs the current query against the new universe and reloads autocomplete options.
- *Loading*: skeleton summary + 8 skeleton cards, with a progress bar and step text ("Fetching OHLCV history…", "Classifying universe…", "Ranking by similarity…"). Stale responses are discarded if a newer query starts.
- *Results summary*: ticker, name, stage Badge, confidence Progress tinted with the stage color, rationale, key stats.
- *Stage chips*: default to the query's stage after each match; "All" shows everything.
- *MatchCard*: ticker, % change over lookback, name, similarity score (tooltip breaks down the four components), stage-colored sparkline, stats (% from 52-wk high, distance from MA, relative volume), stage badge, sector. Click/Enter selects it.
- *Compare panel*: TradingView Lightweight Charts lines of query (white) and match (cyan) normalized to % change from the start of the lookback; ToggleGroup switches overlay ↔ side-by-side. The first same-stage match is preselected.
- *Errors*: API errors render as an inline alert in the results panel.
- *Mock fallback*: if `VITE_API_URL` is unset or `/api/health` fails, the app uses deterministic generated data and the header shows "Mock data".
