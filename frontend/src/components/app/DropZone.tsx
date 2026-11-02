import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImageUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const MIN_W = 300
const MIN_H = 150

function imageSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => reject(new Error('Unreadable image'))
    img.src = url
  })
}

interface Props {
  file: File | null
  onFile: (file: File | null) => void
  onError: (msg: string | null) => void
  disabled?: boolean
}

export function DropZone({ file, onFile, onError, disabled }: Props) {
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = useCallback(
    async (f: File | undefined | null) => {
      if (!f) return
      if (!f.type.startsWith('image/')) return onError('That file is not an image. Drop a PNG, JPEG or WebP chart screenshot.')
      try {
        const { w, h } = await imageSize(f)
        if (w < MIN_W || h < MIN_H) return onError(`Image is ${w}×${h}px — too low-quality to read. Use at least ${MIN_W}×${MIN_H}px.`)
      } catch {
        return onError('Could not read that image. Try another screenshot.')
      }
      onError(null)
      onFile(f)
    },
    [onFile, onError],
  )

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'))
      if (item) accept(item.getAsFile())
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [accept])

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Drop a chart image"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        accept(e.dataTransfer.files?.[0])
      }}
      className={cn(
        'group relative flex h-32 cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-md border border-dashed border-input bg-muted/40 text-center transition-colors hover:border-primary/60 hover:bg-muted',
        over && 'border-primary bg-primary/10',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      {preview ? (
        <>
          <img src={preview} alt="Chart preview" className="absolute inset-0 h-full w-full object-cover opacity-60" />
          <button
            type="button"
            aria-label="Remove image"
            onClick={(e) => {
              e.stopPropagation()
              onFile(null)
            }}
            className="absolute right-1.5 top-1.5 rounded bg-background/80 p-1 hover:bg-background"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <span className="relative rounded bg-background/80 px-2 py-0.5 text-xs">{file?.name}</span>
        </>
      ) : (
        <>
          <ImageUp className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
          <p className="text-xs font-medium">Drop chart image</p>
          <p className="text-[11px] text-muted-foreground">drag · click · or paste (Ctrl+V)</p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
