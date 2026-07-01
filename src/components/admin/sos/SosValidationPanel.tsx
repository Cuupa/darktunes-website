'use client'

import { Warning, XCircle, CheckCircle } from '@phosphor-icons/react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { WizardValidationIssue } from '@/lib/sos/wizardValidation'
import { wizardHasBlockingIssues } from '@/lib/sos/wizardValidation'

interface SosValidationPanelProps {
  issues: WizardValidationIssue[]
  onIssueAction?: (issue: WizardValidationIssue) => void
}

export function SosValidationPanel({ issues, onIssueAction }: SosValidationPanelProps) {
  const hasBlocking = wizardHasBlockingIssues(issues)

  if (issues.length === 0) {
    return (
      <Alert className="mx-6 border-emerald-500/30 bg-emerald-500/5">
        <CheckCircle size={16} className="text-emerald-400" aria-hidden="true" />
        <AlertTitle className="text-sm">Alles in Ordnung</AlertTitle>
        <AlertDescription className="text-xs">
          Keine Probleme gefunden. Sie können mit der Prüfung der Auszahlungen fortfahren.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <Alert variant={hasBlocking ? 'destructive' : 'default'} className="border-border">
        {hasBlocking ? (
          <XCircle size={16} aria-hidden="true" />
        ) : (
          <Warning size={16} className="text-amber-400" aria-hidden="true" />
        )}
        <AlertTitle className="text-sm">
          {hasBlocking
            ? `${issues.filter((i) => i.severity === 'error').length} Fehler müssen behoben werden`
            : `${issues.length} Hinweise zur Prüfung`}
        </AlertTitle>
        <AlertDescription className="text-xs">
          {hasBlocking
            ? 'Beheben Sie die markierten Fehler, bevor Sie fortfahren.'
            : 'Warnungen können Sie bestätigen und trotzdem fortfahren.'}
        </AlertDescription>
      </Alert>

      <ul className="space-y-3" role="list">
        {issues.map((issue) => (
          <li
            key={issue.id}
            className="rounded-lg border border-border bg-card/40 p-4 space-y-2"
          >
            <div className="flex items-start gap-2">
              {issue.severity === 'error' ? (
                <XCircle size={16} className="text-destructive shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <Warning size={16} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{issue.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{issue.description}</p>
              </div>
            </div>
            {issue.actionLabel && onIssueAction && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onIssueAction(issue)}
              >
                {issue.actionLabel}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}