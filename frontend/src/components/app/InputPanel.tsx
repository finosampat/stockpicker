import { AlertTriangle, Info, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Lookback, SymbolOption } from '@/lib/types'
import { DropZone } from './DropZone'
import { SymbolCombobox } from './SymbolCombobox'

interface Props {
  symbol: string
  setSymbol: (s: string) => void
  lookback: Lookback
  setLookback: (l: Lookback) => void
  image: File | null
  setImage: (f: File | null) => void
  imageError: string | null
  setImageError: (e: string | null) => void
  imageNotice: string | null
  symbols: SymbolOption[]
  loading: boolean
  onMatch: (symbol?: string) => void
}

export function InputPanel(p: Props) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Query</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <section className="space-y-2">
          <label className="text-[11px] font-medium text-muted-foreground">Chart image</label>
          <DropZone file={p.image} onFile={p.setImage} onError={p.setImageError} disabled={p.loading} />
          {p.imageError && (
            <p role="alert" className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {p.imageError}
            </p>
          )}
          {p.imageNotice && !p.imageError && (
            <p className="flex items-start gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5 text-[11px] text-primary">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" />
              {p.imageNotice}
            </p>
          )}
        </section>

        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <section className="space-y-2">
          <label className="text-[11px] font-medium text-muted-foreground">Symbol</label>
          <SymbolCombobox value={p.symbol} onChange={p.setSymbol} onSubmit={(s) => p.onMatch(s)} options={p.symbols} />
        </section>

        <section className="space-y-2">
          <label className="text-[11px] font-medium text-muted-foreground">Lookback</label>
          <ToggleGroup
            type="single"
            value={p.lookback}
            onValueChange={(v) => v && p.setLookback(v as Lookback)}
            className="flex w-full"
          >
            {(['6mo', '1y', '2y'] as Lookback[]).map((l) => (
              <ToggleGroupItem key={l} value={l}>
                {l}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </section>

        <Button onClick={() => p.onMatch()} disabled={p.loading || (!p.symbol && !p.image)} className="w-full">
          {p.loading ? <Loader2 className="animate-spin" /> : <Search />}
          {p.loading ? 'Matching…' : 'Match'}
        </Button>

        <p className="mt-auto text-[11px] leading-relaxed text-muted-foreground">
          Classifies the chart into a Weinstein stage, then ranks the universe by shape, MA distance, volatility and volume
          similarity.
        </p>
      </CardContent>
    </Card>
  )
}
