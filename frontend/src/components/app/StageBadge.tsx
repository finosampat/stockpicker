import { Badge } from '@/components/ui/badge'
import { STAGE_INDICATOR, STAGE_LABEL, STAGE_SHORT } from '@/lib/stages'
import type { Stage } from '@/lib/types'
import { cn } from '@/lib/utils'

export function StageBadge({ stage, short, className }: { stage: Stage; short?: boolean; className?: string }) {
  return (
    <Badge variant={stage} className={cn(className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', STAGE_INDICATOR[stage])} />
      {short ? STAGE_SHORT[stage] : STAGE_LABEL[stage]}
    </Badge>
  )
}
