import { AlertTriangle, LineChart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import type { Match, MatchResponse, Stage } from '@/lib/types'
import { STAGES } from '@/lib/types'
import { cn, pct } from '@/lib/utils'
import { MatchCard } from './MatchCard'
import { STAGE_INDICATOR, STAGE_SHORT } from '@/lib/stages'
import { StageBadge } from './StageBadge'

interface Props {
  result: MatchResponse | null
  loading: boolean
  progress: { value: number; text: string }
  error: string | null
  stageFilter: Stage | 'all'
  setStageFilter: (s: Stage | 'all') => void
  selected: Match | null
  onSelect: (m: Match) => void
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors',
        active ? 'border-primary/60 bg-primary/15 text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function LoadingState({ progress }: { progress: Props['progress'] }) {
  return (
    <div className="space-y-3 p-3">
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{progress.text}</span>
          <span className="font-mono">{Math.round(progress.value)}%</span>
        </div>
        <Progress value={progress.value} />
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[150px]" />
        ))}
      </div>
    </div>
  )
}

export function ResultsPanel({ result, loading, progress, error, stageFilter, setStageFilter, selected, onSelect }: Props) {
  if (loading) return <LoadingState progress={progress} />
  if (error)
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p role="alert" className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> {error}
        </p>
      </div>
    )
  if (!result)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
        <LineChart className="h-8 w-8" />
        <p className="text-sm">Pick a symbol or drop a chart to find stocks in the same stage.</p>
      </div>
    )

  const { query, matches, meta } = result
  const shown = matches.filter((m) => stageFilter === 'all' || m.stage === stageFilter)
  const counts = Object.fromEntries(STAGES.map((s) => [s, matches.filter((m) => m.stage === s).length])) as Record<Stage, number>

  return (
    <div className="flex h-full flex-col">
      <Card className="m-3 mb-2 grid grid-cols-1 gap-3 p-3 md:grid-cols-[auto_1fr_auto]">
        <div className="flex items-center gap-3">
          <div>
            <div className="font-mono text-xl font-semibold leading-none">{query.symbol}</div>
            <div className="mt-1 max-w-40 truncate text-[11px] text-muted-foreground">{query.name}</div>
          </div>
          <StageBadge stage={query.stage} className="text-xs" />
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">Confidence</span>
            <Progress value={query.confidence * 100} className="h-1.5 max-w-48" indicatorClassName={STAGE_INDICATOR[query.stage]} />
            <span className="font-mono">{Math.round(query.confidence * 100)}%</span>
          </div>
          <p className="text-xs leading-snug text-muted-foreground">{query.rationale}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-right font-mono text-xs md:grid-cols-1 md:gap-0.5">
          <div><span className="text-muted-foreground">52wk hi </span>{pct(query.stats.pct_from_high)}</div>
          <div><span className="text-muted-foreground">vs MA </span>{pct(query.stats.dist_from_ma)}</div>
          <div><span className="text-muted-foreground">rel vol </span>{query.stats.relative_volume.toFixed(2)}×</div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
        <Chip active={stageFilter === 'all'} onClick={() => setStageFilter('all')}>
          All <span className="font-mono text-muted-foreground">{matches.length}</span>
        </Chip>
        {STAGES.map((s) => (
          <Chip key={s} active={stageFilter === s} onClick={() => setStageFilter(s)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', STAGE_INDICATOR[s])} />
            {STAGE_SHORT[s]}
            {s === query.stage && <Badge variant="secondary" className="px-1 py-0 text-[9px]">same</Badge>}
            <span className="font-mono text-muted-foreground">{counts[s]}</span>
          </Chip>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {meta.evaluated} evaluated · {meta.skipped_low_volume} excluded (&lt;500k vol) · {meta.lookback}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {shown.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2">
            {shown.map((m) => (
              <MatchCard key={m.symbol} match={m} selected={selected?.symbol === m.symbol} onSelect={() => onSelect(m)} />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No matches in this stage.</p>
        )}
      </div>
    </div>
  )
}
