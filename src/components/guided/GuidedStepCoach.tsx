'use client'

import { CheckCircle, Circle, Warning } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export type GuidedCoachCheck = {
  id: string
  label: string
  done: boolean
}

export interface GuidedStepCoachProps {
  title: string
  body: string
  checks?: GuidedCoachCheck[]
  blockedReason?: string | null
  className?: string
}

export function GuidedStepCoach({
  title,
  body,
  checks = [],
  blockedReason,
  className,
}: GuidedStepCoachProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card/50 p-4 space-y-3',
        className,
      )}
      aria-label={title}
    >
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
      </div>
      {checks.length > 0 && (
        <ul className="space-y-1.5" role="list">
          {checks.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-xs">
              {item.done ? (
                <CheckCircle
                  size={14}
                  className="text-emerald-400 shrink-0 mt-0.5"
                  weight="fill"
                  aria-hidden="true"
                />
              ) : (
                <Circle size={14} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <span className={item.done ? 'text-muted-foreground' : 'text-foreground'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      )}
      {blockedReason ? (
        <p
          className="flex items-start gap-2 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2"
          role="status"
        >
          <Warning size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{blockedReason}</span>
        </p>
      ) : null}
    </div>
  )
}
