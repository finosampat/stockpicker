import { useEffect, useRef } from 'react'
import { ColorType, LineSeries, createChart } from 'lightweight-charts'
import type { Point } from '@/lib/types'

export interface ChartLine {
  label: string
  color: string
  data: Point[]
}

export function PriceChart({ lines }: { lines: ChartLine[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = createChart(ref.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8b95a7',
        fontSize: 11,
        fontFamily: 'Inter, system-ui, sans-serif',
        attributionLogo: false,
      },
      grid: { vertLines: { color: '#1b2130' }, horzLines: { color: '#1b2130' } },
      rightPriceScale: { borderColor: '#232a38' },
      timeScale: { borderColor: '#232a38' },
      crosshair: { vertLine: { color: '#3b4558' }, horzLine: { color: '#3b4558' } },
      localization: { priceFormatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` },
    })
    for (const l of lines) {
      chart.addSeries(LineSeries, { color: l.color, lineWidth: 2, title: l.label, priceLineVisible: false }).setData(l.data)
    }
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [lines])

  return <div ref={ref} className="h-full w-full" />
}
