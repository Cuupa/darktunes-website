'use client'

import { Lightning, ListChecks } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
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
        <Card className="border-border bg-card/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightning size={18} className="text-primary" aria-hidden="true" />
              {t.wizardModeQuickTitle}
            </CardTitle>
            <CardDescription className="text-xs">{t.wizardModeQuickDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" className="w-full" onClick={() => onSelect('quick')}>
              {t.wizardModeQuickButton}
            </Button>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks size={18} className="text-primary" aria-hidden="true" />
              {t.wizardModeAssistantTitle}
            </CardTitle>
            <CardDescription className="text-xs">{t.wizardModeAssistantDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="default" className="w-full" onClick={() => onSelect('assistant')}>
              {t.wizardModeAssistantButton}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}