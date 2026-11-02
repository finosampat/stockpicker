import { useMemo, useState } from 'react'
import { ChevronsUpDown, X } from 'lucide-react'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { SymbolOption } from '@/lib/types'

interface Props {
  value: string
  onChange: (symbol: string) => void
  onSubmit: (symbol: string) => void
  options: SymbolOption[]
}

export function SymbolCombobox({ value, onChange, onSubmit, options }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find((o) => o.symbol === value)

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return options.slice(0, 50)
    const starts = options.filter((o) => o.symbol.startsWith(q))
    const rest = options.filter((o) => !o.symbol.startsWith(q) && o.name.toUpperCase().includes(q))
    return [...starts, ...rest].slice(0, 50)
  }, [options, query])

  const pick = (sym: string) => {
    onChange(sym)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-label="Symbol"
            aria-expanded={open}
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm shadow-sm hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {value ? (
              <span className="flex min-w-0 items-baseline gap-2 pr-6">
                <span className="font-mono font-semibold">{value}</span>
                <span className="truncate text-xs text-muted-foreground">{selected?.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Search ticker…</span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        {value && (
          <button
            type="button"
            aria-label="Clear symbol"
            onClick={() => onChange('')}
            className="absolute right-7 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Ticker or company…"
            value={query}
            onValueChange={setQuery}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim() && filtered.length === 0) {
                const sym = query.trim().toUpperCase()
                pick(sym)
                onSubmit(sym)
              }
            }}
          />
          <CommandList>
            <CommandEmpty>
              {query.trim() ? (
                <>Press Enter to match <span className="font-mono">{query.trim().toUpperCase()}</span></>
              ) : (
                'No symbols'
              )}
            </CommandEmpty>
            {filtered.map((o) => (
              <CommandItem
                key={o.symbol}
                value={o.symbol}
                onSelect={() => {
                  pick(o.symbol)
                  onSubmit(o.symbol)
                }}
              >
                <span className="w-14 font-mono text-xs font-semibold">{o.symbol}</span>
                <span className="truncate text-xs text-muted-foreground">{o.name}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
