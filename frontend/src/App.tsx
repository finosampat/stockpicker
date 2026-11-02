import { useCallback, useEffect, useRef, useState } from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ComparePanel } from '@/components/app/ComparePanel'
import { Header } from '@/components/app/Header'
import { InputPanel } from '@/components/app/InputPanel'
import { ResultsPanel } from '@/components/app/ResultsPanel'
import { ApiError, fetchSymbols, fetchUniverses, isBackendAvailable, matchImage, matchSymbol } from '@/lib/api'
import { MOCK_UNIVERSES } from '@/lib/mock'
import type { Lookback, Match, MatchResponse, Stage, SymbolOption, UniverseOption } from '@/lib/types'

const PROGRESS_STEPS = ['Fetching OHLCV history…', 'Computing 30-wk MA & stage features…', 'Classifying universe…', 'Ranking by similarity…']

export default function App() {
  const [live, setLive] = useState<boolean | null>(null)
  const [universes, setUniverses] = useState<UniverseOption[]>(MOCK_UNIVERSES)
  const [universe, setUniverse] = useState('sp500_ndx')
  const [symbols, setSymbols] = useState<SymbolOption[]>([])
  const [symbol, setSymbol] = useState('')
  const [lookback, setLookback] = useState<Lookback>('1y')
  const [image, setImage] = useState<File | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageNotice, setImageNotice] = useState<string | null>(null)
  const [result, setResult] = useState<MatchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ value: 0, text: '' })
  const [error, setError] = useState<string | null>(null)
  const [stageFilter, setStageFilter] = useState<Stage | 'all'>('all')
  const [selected, setSelected] = useState<Match | null>(null)
  const runId = useRef(0)

  useEffect(() => {
    isBackendAvailable().then(setLive)
    fetchUniverses().then(setUniverses).catch(() => {})
  }, [])

  useEffect(() => {
    fetchSymbols(universe).then(setSymbols).catch(() => setSymbols([]))
  }, [universe])

  const run = useCallback(
    async (sym: string, lb: Lookback, uni: string) => {
      const id = ++runId.current
      setLoading(true)
      setError(null)
      setSelected(null)
      let tick = 0
      setProgress({ value: 5, text: PROGRESS_STEPS[0] })
      const timer = setInterval(() => {
        tick++
        setProgress({ value: Math.min(92, 5 + tick * 6), text: PROGRESS_STEPS[Math.min(PROGRESS_STEPS.length - 1, Math.floor(tick / 4))] })
      }, 400)
      try {
        const res = await matchSymbol(sym, lb, uni)
        if (id !== runId.current) return
        setResult(res)
        setStageFilter(res.query.stage)
        setSelected(res.matches.find((m) => m.stage === res.query.stage) ?? null)
      } catch (e) {
        if (id === runId.current) setError(e instanceof Error ? e.message : 'Matching failed')
      } finally {
        clearInterval(timer)
        if (id === runId.current) setLoading(false)
      }
    },
    [],
  )

  const onMatch = useCallback(
    async (sym?: string) => {
      const s = (sym ?? symbol).trim().toUpperCase()
      if (sym || (s && !image)) return run(s, lookback, universe)
      if (!image) return
      setImageError(null)
      try {
        // v1: images are validated server-side but not parsed; see backend TODO(vision).
        const res = await matchImage(image)
        if (res.detected_symbol) {
          setSymbol(res.detected_symbol)
          run(res.detected_symbol, lookback, universe)
        } else {
          setImageNotice(res.message)
        }
      } catch (e) {
        setImageError(e instanceof ApiError || e instanceof Error ? e.message : 'Image upload failed')
      }
    },
    [symbol, image, lookback, universe, run],
  )

  // The most recent input wins: a dropped chart clears the symbol and vice versa.
  const onImage = useCallback((f: File | null) => {
    setImage(f)
    setImageNotice(null)
    if (f) setSymbol('')
  }, [])

  const onSymbol = useCallback((s: string) => {
    setSymbol(s)
    if (s) {
      setImage(null)
      setImageError(null)
      setImageNotice(null)
    }
  }, [])

  const changeLookback = (lb: Lookback) => {
    setLookback(lb)
    if (result) run(result.query.symbol, lb, universe)
  }

  const changeUniverse = (u: string) => {
    setUniverse(u)
    if (result) run(result.query.symbol, lookback, u)
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col">
        <Header universes={universes} universe={universe} setUniverse={changeUniverse} live={live} />
        <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:flex-row">
          <aside className="w-full shrink-0 md:w-72">
            <InputPanel
              symbol={symbol}
              setSymbol={onSymbol}
              lookback={lookback}
              setLookback={changeLookback}
              image={image}
              setImage={onImage}
              imageError={imageError}
              setImageError={setImageError}
              imageNotice={imageNotice}
              symbols={symbols}
              loading={loading}
              onMatch={onMatch}
            />
          </aside>
          <section className="min-h-[600px] min-w-0 flex-1 overflow-hidden rounded-lg border bg-card/40">
            <ResizablePanelGroup direction="vertical" autoSaveId="stockpicker-layout">
              <ResizablePanel defaultSize={62} minSize={30}>
                <ResultsPanel
                  result={result}
                  loading={loading}
                  progress={progress}
                  error={error}
                  stageFilter={stageFilter}
                  setStageFilter={setStageFilter}
                  selected={selected}
                  onSelect={setSelected}
                />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={38} minSize={20}>
                <ComparePanel query={result?.query ?? null} match={selected} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </section>
        </main>
        <footer className="flex h-7 shrink-0 items-center justify-between border-t px-4 text-[11px] text-muted-foreground">
          <span>Similarity matches, not investment advice.</span>
          <span className="hidden sm:inline">Data: Yahoo Finance (daily, cached) · Charts: TradingView Lightweight Charts</span>
        </footer>
      </div>
    </TooltipProvider>
  )
}
