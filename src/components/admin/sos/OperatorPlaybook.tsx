'use client'

import { ListNumbers } from '@phosphor-icons/react'

interface OperatorPlaybookProps {
  title: string
  step1: string
  step2: string
  step3: string
  className?: string
}

export function OperatorPlaybook({ title, step1, step2, step3, className }: OperatorPlaybookProps) {
  return (
    <div
      className={`rounded-lg border border-border bg-card/40 p-4 space-y-3 ${className ?? ''}`}
      aria-label={title}
    >
      <p className="text-sm font-medium flex items-center gap-2">
        <ListNumbers size={16} className="text-primary shrink-0" aria-hidden="true" />
        {title}
      </p>
      <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
        <li>{step1}</li>
        <li>{step2}</li>
        <li>{step3}</li>
      </ol>
    </div>
  )
}