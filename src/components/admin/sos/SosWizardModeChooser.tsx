'use client'

import { Lightning, ListChecks, Star } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAccountingLabels } from '@/lib/i18n/accountingFallbacks'

export type SosWizardMode = 'quick' | 'assistant'

interface SosWizardModeChooserProps {
  onSelect: (mode: SosWizardMode) => void
}

export function SosWizardModeChooser({ onSelect }: SosWizardModeChooserProps) {
  const t = useAccountingLabels()
  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8 min-h-[420px]">
      <div className="text-center space-y-2 max-w-lg">
        <h2 className="text-lg font-semibold">{t.wizardModeTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.wizardModeSubtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 w-full max-w-2xl">
        {/* Assistant first — recommended DAU path */}
        <Card className="border-primary/40 bg-primary/5 order-1 sm:order-1 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks size={18} className="text-primary" aria-hidden="true" />
                {t.wizardModeAssistantTitle}
              </CardTitle>
              <Badge variant="secondary" className="gap-1 text-[10px] shrink-0">
                <Star size={10} weight="fill" aria-hidden="true" />
                {t.wizardModeRecommended}
              </Badge>
            </div>
            <CardDescription className="text-xs leading-relaxed">
              {t.wizardModeAssistantDesc}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" className="w-full min-h-11" onClick={() => onSelect('assistant')}>
              {t.wizardModeAssistantButton}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/40 order-2 sm:order-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightning size={18} className="text-muted-foreground" aria-hidden="true" />
              {t.wizardModeQuickTitle}
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {t.wizardModeQuickDesc}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-11"
              onClick={() => onSelect('quick')}
            >
              {t.wizardModeQuickButton}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="w-full max-w-2xl rounded-lg border border-border bg-muted/10 p-4 space-y-2">
        <p className="text-xs font-semibold text-foreground">{t.wizardModeWhatNextTitle}</p>
        <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
          <li>{t.wizardModeWhatNext1}</li>
          <li>{t.wizardModeWhatNext2}</li>
          <li>{t.wizardModeWhatNext3}</li>
          <li>{t.wizardModeWhatNext4}</li>
          <li>{t.wizardModeWhatNext5}</li>
        </ol>
      </div>
    </div>
  )
}
