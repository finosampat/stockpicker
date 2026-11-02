import type { Stage } from './types'

export const STAGE_LABEL: Record<Stage, string> = {
  accumulation: 'Stage 1 · Accumulation',
  markup: 'Stage 2 · Markup',
  distribution: 'Stage 3 · Distribution',
  decline: 'Stage 4 · Decline',
}

export const STAGE_SHORT: Record<Stage, string> = {
  accumulation: 'Accum',
  markup: 'Markup',
  distribution: 'Distrib',
  decline: 'Decline',
}

export const STAGE_INDICATOR: Record<Stage, string> = {
  accumulation: 'bg-stage-accumulation',
  markup: 'bg-stage-markup',
  distribution: 'bg-stage-distribution',
  decline: 'bg-stage-decline',
}

export const STAGE_HEX: Record<Stage, string> = {
  accumulation: '#38bdf8',
  markup: '#2fc785',
  distribution: '#f5a524',
  decline: '#ea5455',
}
