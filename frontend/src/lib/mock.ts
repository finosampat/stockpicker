import type { ImageMatchResponse, Lookback, Match, MatchResponse, Point, Stage, Stats, SymbolOption, UniverseOption } from './types'
import { STAGES } from './types'

export const MOCK_SYMBOLS: SymbolOption[] = [
  ['AAPL', 'Apple', 'Information Technology'], ['MSFT', 'Microsoft', 'Information Technology'],
  ['NVDA', 'Nvidia', 'Information Technology'], ['AMZN', 'Amazon', 'Consumer Discretionary'],
  ['META', 'Meta Platforms', 'Communication Services'], ['GOOGL', 'Alphabet', 'Communication Services'],
  ['TSLA', 'Tesla', 'Consumer Discretionary'], ['AVGO', 'Broadcom', 'Information Technology'],
  ['JPM', 'JPMorgan Chase', 'Financials'], ['V', 'Visa', 'Financials'], ['UNH', 'UnitedHealth', 'Health Care'],
  ['XOM', 'ExxonMobil', 'Energy'], ['LLY', 'Eli Lilly', 'Health Care'], ['COST', 'Costco', 'Consumer Staples'],
  ['NFLX', 'Netflix', 'Communication Services'], ['AMD', 'AMD', 'Information Technology'],
  ['INTC', 'Intel', 'Information Technology'], ['PEP', 'PepsiCo', 'Consumer Staples'],
  ['KO', 'Coca-Cola', 'Consumer Staples'], ['NKE', 'Nike', 'Consumer Discretionary'],
  ['BA', 'Boeing', 'Industrials'], ['CAT', 'Caterpillar', 'Industrials'], ['CRM', 'Salesforce', 'Information Technology'],
  ['ADBE', 'Adobe', 'Information Technology'], ['ORCL', 'Oracle', 'Information Technology'],
  ['PFE', 'Pfizer', 'Health Care'], ['MRK', 'Merck', 'Health Care'], ['WMT', 'Walmart', 'Consumer Staples'],
  ['HD', 'Home Depot', 'Consumer Discretionary'], ['DIS', 'Disney', 'Communication Services'],
  ['CSCO', 'Cisco', 'Information Technology'], ['QCOM', 'Qualcomm', 'Information Technology'],
  ['GS', 'Goldman Sachs', 'Financials'], ['CVX', 'Chevron', 'Energy'], ['SBUX', 'Starbucks', 'Consumer Discretionary'],
  ['PLTR', 'Palantir', 'Information Technology'], ['MU', 'Micron', 'Information Technology'],
  ['UBER', 'Uber', 'Industrials'], ['PYPL', 'PayPal', 'Financials'], ['ABNB', 'Airbnb', 'Consumer Discretionary'],
].map(([symbol, name, sector]) => ({ symbol, name, sector }))

export const MOCK_UNIVERSES: UniverseOption[] = [
  { id: 'sp500_ndx', label: 'S&P 500 + NASDAQ-100', count: 518 },
  { id: 'sp500', label: 'S&P 500', count: 503 },
  { id: 'ndx', label: 'NASDAQ-100', count: 100 },
]

const DAYS: Record<Lookback, number> = { '6mo': 126, '1y': 252, '2y': 504 }

function hash(s: string) {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DRIFT: Record<Stage, (x: number) => number> = {
  accumulation: (x) => (x < 0.3 ? -0.002 : 0.0001),
  markup: () => 0.0018,
  distribution: (x) => (x < 0.4 ? 0.0015 : -0.0002),
  decline: () => -0.0016,
}

function series(symbol: string, stage: Stage, n: number): Point[] {
  const r = rng(hash(symbol + stage))
  const start = new Date()
  start.setDate(start.getDate() - Math.round(n * 1.45))
  const out: Point[] = []
  let p = 100
  const d = new Date(start)
  while (out.length < n) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() === 0 || d.getDay() === 6) continue
    p *= 1 + DRIFT[stage](out.length / n) + (r() - 0.5) * 0.035
    out.push({ time: d.toISOString().slice(0, 10), value: +(p - 100).toFixed(2) })
  }
  return out
}

function stats(symbol: string, stage: Stage): Stats {
  const r = rng(hash(symbol))
  const base = { accumulation: [-0.3, 0], markup: [-0.06, 0.12], distribution: [-0.08, 0], decline: [-0.45, -0.1] }[stage]
  return {
    pct_from_high: stage === 'markup' ? -r() * 0.08 : stage === 'distribution' ? -r() * 0.12 : -0.2 - r() * 0.35,
    dist_from_ma: base[0] / 3 + r() * (base[1] - base[0] / 3),
    relative_volume: 0.6 + r() * 1.2,
    volatility: 0.18 + r() * 0.4,
    volume_trend: 0.7 + r() * 0.7,
  }
}

const RATIONALE: Record<Stage, string> = {
  accumulation: 'Price basing around a flat 30-wk MA, well off 52-wk highs — consistent with accumulation.',
  markup: 'Price above a rising 30-wk MA, near 52-wk highs with expanding volume — consistent with markup.',
  distribution: 'Price churning near highs as the 30-wk MA flattens — consistent with distribution.',
  decline: 'Price below a falling 30-wk MA, near 52-wk lows — consistent with decline.',
}

export function mockMatch(symbol: string, lookback: Lookback): MatchResponse {
  const sym = symbol.toUpperCase()
  const n = DAYS[lookback]
  const stage = STAGES[hash(sym) % 4]
  const meta = MOCK_SYMBOLS.find((s) => s.symbol === sym)
  const r = rng(hash(sym + lookback))
  const matches: Match[] = MOCK_SYMBOLS.filter((s) => s.symbol !== sym).map((s, i) => {
    const st = i % 3 === 0 ? stage : STAGES[hash(s.symbol) % 4]
    const ser = series(s.symbol, st, n)
    const step = Math.max(1, Math.floor(ser.length / 48))
    return {
      ...s,
      stage: st,
      confidence: 0.45 + r() * 0.5,
      rationale: RATIONALE[st],
      similarity: +(st === stage ? 70 + r() * 28 : 40 + r() * 40).toFixed(1),
      components: { shape: r(), ma_distance: r(), volatility: r(), volume_trend: r() },
      stats: stats(s.symbol, st),
      series: ser,
      sparkline: ser.filter((_, j) => j % step === 0).map((p) => p.value),
    }
  })
  matches.sort((a, b) => b.similarity - a.similarity)
  const counts = Object.fromEntries(STAGES.map((s) => [s, matches.filter((m) => m.stage === s).length])) as Record<Stage, number>
  return {
    query: {
      symbol: sym,
      name: meta?.name ?? sym,
      sector: meta?.sector ?? '',
      stage,
      confidence: 0.55 + r() * 0.4,
      rationale: RATIONALE[stage],
      scores: Object.fromEntries(STAGES.map((s) => [s, s === stage ? 0.7 : r() * 0.4])) as Record<Stage, number>,
      stats: stats(sym, stage),
      series: series(sym, stage, n),
    },
    matches,
    meta: { lookback, universe: 'mock', universe_size: MOCK_SYMBOLS.length, evaluated: MOCK_SYMBOLS.length, skipped_low_volume: 0, stage_counts: counts },
  }
}

export function mockImage(): ImageMatchResponse {
  return {
    status: 'unsupported',
    detected_symbol: null,
    message: 'Chart image recognition is coming soon. Enter the ticker symbol to find same-stage matches.',
  }
}
