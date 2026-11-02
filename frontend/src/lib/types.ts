export type Stage = 'accumulation' | 'markup' | 'distribution' | 'decline'
export const STAGES: Stage[] = ['accumulation', 'markup', 'distribution', 'decline']
export type Lookback = '6mo' | '1y' | '2y'

export interface Point {
  time: string
  value: number
}

export interface Stats {
  pct_from_high: number
  dist_from_ma: number
  relative_volume: number
  volatility: number
  volume_trend: number
}

export interface QueryResult {
  symbol: string
  name: string
  sector: string
  stage: Stage
  confidence: number
  rationale: string
  scores: Record<Stage, number>
  stats: Stats
  series: Point[]
}

export interface Match {
  symbol: string
  name: string
  sector: string
  stage: Stage
  confidence: number
  rationale: string
  similarity: number
  components: Record<string, number>
  stats: Stats
  series: Point[]
  sparkline: number[]
}

export interface MatchResponse {
  query: QueryResult
  matches: Match[]
  meta: {
    lookback: Lookback
    universe: string
    universe_size: number
    evaluated: number
    skipped_low_volume: number
    stage_counts: Record<Stage, number>
  }
}

export interface ImageMatchResponse {
  status: 'unsupported' | 'ok'
  detected_symbol: string | null
  message: string
}

export interface UniverseOption {
  id: string
  label: string
  count: number
}

export interface SymbolOption {
  symbol: string
  name: string
  sector: string
}
