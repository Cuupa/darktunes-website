'use client'

import { Lightning, ListChecks } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type SosWizardMode = 'quick' | 'assistant'

interface SosWizardModeChooserProps {
  onSelect: (mode: SosWizardMode) => void
}

export function SosWizardModeChooser({ onSelect }: SosWizardModeChooserProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8 min-h-[420px]">
      <div className="text-center space-y-2 max-w-lg">
        <h2 className="text-lg font-semibold">Wie möchten Sie abrechnen?</h2>
        <p className="text-sm text-muted-foreground">
          Wählen Sie den Schnellstart für erfahrene Operatoren oder den Assistenten mit Setup und
          Fehlerprüfung.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 w-full max-w-2xl">
        <Card className="border-border bg-card/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightning size={18} className="text-primary" aria-hidden="true" />
              Schnellstart
            </CardTitle>
            <CardDescription className="text-xs">
              Upload → Review → Publish. Für wiederkehrende monatliche Abrechnungen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" className="w-full" onClick={() => onSelect('quick')}>
              Schnellstart wählen
            </Button>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks size={18} className="text-primary" aria-hidden="true" />
              Assistent
            </CardTitle>
            <CardDescription className="text-xs">
              Setup mit allen Parametern, automatische Prüfung und Hilfe bei Fehlern.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="default" className="w-full" onClick={() => onSelect('assistant')}>
              Assistent starten
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}