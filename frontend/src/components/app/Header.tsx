import { BookOpen, Radar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { UniverseOption } from '@/lib/types'
import { cn } from '@/lib/utils'
import { STAGE_LABEL } from '@/lib/stages'

interface Props {
  universes: UniverseOption[]
  universe: string
  setUniverse: (u: string) => void
  live: boolean | null
}

const STAGE_HELP = {
  accumulation: 'Flat 30-week MA, price basing around it after a decline.',
  markup: 'Price above a rising 30-week MA, making higher highs near 52-week highs.',
  distribution: 'MA flattening after an advance; price churning near highs on heavy volume.',
  decline: 'Price below a falling 30-week MA, making lower lows.',
} as const

export function Header({ universes, universe, setUniverse, live }: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card/60 px-4 backdrop-blur">
      <Radar className="h-5 w-5 text-primary" />
      <div className="flex items-baseline gap-2">
        <h1 className="text-sm font-semibold tracking-tight">StockPicker</h1>
        <span className="hidden text-xs text-muted-foreground sm:inline">Same-stage chart matcher</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-up' : 'bg-stage-distribution')} />
              {live === null ? '…' : live ? 'Live' : 'Mock data'}
            </span>
          </TooltipTrigger>
          <TooltipContent>{live ? 'Connected to backend' : 'Backend unreachable — showing generated sample data. Set VITE_API_URL.'}</TooltipContent>
        </Tooltip>
        <Select value={universe} onValueChange={setUniverse}>
          <SelectTrigger className="w-48" aria-label="Universe">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {universes.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.label} <span className="text-muted-foreground">({u.count})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Methodology">
              <BookOpen />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle className="text-sm font-semibold">Methodology</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Weinstein stage analysis on daily bars, classified with deterministic rules.
            </SheetDescription>
            <div className="space-y-3 text-xs">
              {(Object.keys(STAGE_HELP) as (keyof typeof STAGE_HELP)[]).map((s) => (
                <div key={s}>
                  <div className="font-medium">{STAGE_LABEL[s]}</div>
                  <p className="text-muted-foreground">{STAGE_HELP[s]}</p>
                </div>
              ))}
              <div>
                <div className="font-medium">Similarity score (0–100)</div>
                <p className="text-muted-foreground">
                  55% correlation of normalized price path, 20% distance-from-MA closeness, 15% volatility closeness, 10%
                  volume-trend closeness.
                </p>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
