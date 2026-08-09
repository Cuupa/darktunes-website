'use client'

import { Lightning, ListChecks, Star } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { GuidedMode } from '@/lib/guided/guidedSteps'

export interface GuidedModeChooserProps {
  title: string
  subtitle: string
  recommendedLabel?: string
  assistantTitle: string
  assistantDesc: string
  assistantButton: string
  advancedTitle: string
  advancedDesc: string
  advancedButton: string
  whatNextTitle?: string
  whatNextSteps?: string[]
  onSelect: (mode: GuidedMode) => void
  /** Prefer showing Assistant first (DAU). Default true. */
  assistantFirst?: boolean
}

export function GuidedModeChooser({
  title,
  subtitle,
  recommendedLabel = 'Recommended',
  assistantTitle,
  assistantDesc,
  assistantButton,
  advancedTitle,
  advancedDesc,
  advancedButton,
  whatNextTitle,
  whatNextSteps,
  onSelect,
  assistantFirst = true,
}: GuidedModeChooserProps) {
  const assistantCard = (
    <Card className="border-primary/40 bg-primary/5 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 mb-1">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks size={18} className="text-primary" aria-hidden="true" />
            {assistantTitle}
          </CardTitle>
          <Badge variant="secondary" className="gap-1 text-[10px] shrink-0">
            <Star size={10} weight="fill" aria-hidden="true" />
            {recommendedLabel}
          </Badge>
        </div>
        <CardDescription className="text-xs leading-relaxed">{assistantDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" className="w-full min-h-11" onClick={() => onSelect('assistant')}>
          {assistantButton}
        </Button>
      </CardContent>
    </Card>
  )

  const advancedCard = (
    <Card className="border-border bg-card/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightning size={18} className="text-muted-foreground" aria-hidden="true" />
          {advancedTitle}
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed">{advancedDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="outline"
          className="w-full min-h-11"
          onClick={() => onSelect('advanced')}
        >
          {advancedButton}
        </Button>
      </CardContent>
    </Card>
  )

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 sm:p-8 min-h-[360px]">
      <div className="text-center space-y-2 max-w-lg">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 w-full max-w-2xl">
        {assistantFirst ? (
          <>
            {assistantCard}
            {advancedCard}
          </>
        ) : (
          <>
            {advancedCard}
            {assistantCard}
          </>
        )}
      </div>
      {whatNextTitle && whatNextSteps && whatNextSteps.length > 0 && (
        <div className="w-full max-w-2xl rounded-lg border border-border bg-muted/10 p-4 space-y-2">
          <p className="text-xs font-semibold text-foreground">{whatNextTitle}</p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
            {whatNextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
