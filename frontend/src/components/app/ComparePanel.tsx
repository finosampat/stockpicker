import { useMemo, useState } from 'react'
import { Columns2, Layers, MousePointerClick } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Match, QueryResult } from '@/lib/types'
import { PriceChart, type ChartLine } from './PriceChart'
import { StageBadge } from './StageBadge'

type Mode = 'overlay' | 'side'

export function ComparePanel({ query, match }: { query: QueryResult | null; match: Match | null }) {
  const [mode, setMode] = useState<Mode>('overlay')
  const q = useMemo<ChartLine | null>(() => (query ? { label: query.symbol, color: '#e6e9ef', data: query.series } : null), [query])
  const m = useMemo<ChartLine | null>(() => (match ? { label: match.symbol, color: '#38bdf8', data: match.series } : null), [match])
  const overlay = useMemo(() => [q, m].filter(Boolean) as ChartLine[], [q, m])
  const qOnly = useMemo(() => (q ? [q] : []), [q])
  const mOnly = useMemo(() => (m ? [m] : []), [m])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compare</span>
        {query && match ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="font-mono font-semibold">{query.symbol}</span>
            <span className="text-muted-foreground">vs</span>
            <span className="font-mono font-semibold text-primary">{match.symbol}</span>
            <StageBadge stage={match.stage} short />
            <span className="text-muted-foreground">% change over lookback</span>
          </span>
        ) : null}
        <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as Mode)} className="ml-auto">
          <ToggleGroupItem value="overlay" aria-label="Overlay">
            <Layers className="h-3.5 w-3.5" /> <span className="ml-1">Overlay</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="side" aria-label="Side by side">
            <Columns2 className="h-3.5 w-3.5" /> <span className="ml-1">Side-by-side</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="min-h-0 flex-1 p-2">
        {!query || !match ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
            <MousePointerClick className="h-4 w-4" /> Click a match card to compare it with {query?.symbol ?? 'the query'}.
          </div>
        ) : mode === 'overlay' ? (
          <PriceChart key="overlay" lines={overlay} />
        ) : (
          <div className="grid h-full grid-cols-2 gap-2">
            <PriceChart key="q" lines={qOnly} />
            <PriceChart key="m" lines={mOnly} />
          </div>
        )}
      </div>
    </div>
  )
}
