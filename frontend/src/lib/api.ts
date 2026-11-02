import { MOCK_SYMBOLS, MOCK_UNIVERSES, mockImage, mockMatch } from './mock'
import type { ImageMatchResponse, Lookback, MatchResponse, SymbolOption, UniverseOption } from './types'

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let backendUp: boolean | null = null

/** True when VITE_API_URL is set and /api/health answers; otherwise the UI runs on mock data. */
export async function isBackendAvailable(): Promise<boolean> {
  if (!API_URL) return false
  if (backendUp !== null) return backendUp
  try {
    const res = await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(4000) })
    backendUp = res.ok
  } catch {
    backendUp = false
  }
  return backendUp
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, typeof body.detail === 'string' ? body.detail : `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export async function fetchUniverses(): Promise<UniverseOption[]> {
  return (await isBackendAvailable()) ? request('/api/universes') : MOCK_UNIVERSES
}

export async function fetchSymbols(universe: string): Promise<SymbolOption[]> {
  return (await isBackendAvailable()) ? request(`/api/symbols?universe_id=${encodeURIComponent(universe)}`) : MOCK_SYMBOLS
}

export async function matchSymbol(symbol: string, lookback: Lookback, universe: string): Promise<MatchResponse> {
  if (!(await isBackendAvailable())) {
    await new Promise((r) => setTimeout(r, 900))
    return mockMatch(symbol, lookback)
  }
  return request('/api/match/symbol', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, lookback, universe, limit: 12, same_stage_only: false }),
  })
}

export async function matchImage(file: File): Promise<ImageMatchResponse> {
  if (!(await isBackendAvailable())) {
    if (file.size < 8 * 1024) throw new ApiError(422, 'Image looks too small or low-quality to read. Try a larger screenshot or enter the symbol.')
    return mockImage()
  }
  const form = new FormData()
  form.append('file', file)
  return request('/api/match/image', { method: 'POST', body: form })
}
