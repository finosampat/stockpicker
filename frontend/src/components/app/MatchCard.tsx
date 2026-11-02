import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Match } from '@/lib/types'
import { cn, pct } from '@/lib/utils'
import { Sparkline } from './Sparkline'
import { STAGE_HEX } from '@/lib/stages'
import { StageBadge } from './StageBadge'

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('font-mono text-xs', tone === 'up' && 'text-up', tone === 'down' && 'text-down')}>{value}</div>
    </div>
  )
}

export function MatchCard({ match, selected, onSelect }: { match: Match; selected: boolean; onSelect: () => void }) {
  const s = match.stats
  const last = match.series.at(-1)?.value ?? 0
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      className={cn(
        'cursor-pointer p-2.5 transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        selected && 'border-primary bg-primary/5',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-sm font-semibold">{match.symbol}</span>
            <span className={cn('font-mono text-[11px]', last >= 0 ? 'text-up' : 'text-down')}>
              {last >= 0 ? '+' : ''}
              {last.toFixed(1)}%
            </span>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">{match.name}</div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-right">
              <div className="font-mono text-lg font-semibold leading-none text-primary">{match.similarity.toFixed(0)}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">similarity</div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">
            <div className="space-y-0.5 font-mono">
              {Object.entries(match.components).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{k.replace('_', ' ')}</span>
                  <span>{(v * 100).toFixed(0)}</span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="my-1.5">
        <Sparkline values={match.sparkline} color={STAGE_HEX[match.stage]} />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <Stat label="Off high" value={pct(s.pct_from_high)} tone="down" />
        <Stat label="vs MA" value={pct(s.dist_from_ma)} tone={s.dist_from_ma >= 0 ? 'up' : 'down'} />
        <Stat label="Rel vol" value={`${s.relative_volume.toFixed(2)}×`} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <StageBadge stage={match.stage} short />
        <span className="truncate pl-2 text-[10px] text-muted-foreground">{match.sector}</span>
      </div>
    </Card>
  )
}
