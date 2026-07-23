'use client'

import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowLeft, ArrowRight, Check } from '@phosphor-icons/react'
import type { WizardStep } from '@/lib/submissions/wizardSteps'
import { humanizeGroupKey } from '@/lib/submissions/wizardSteps'

interface SubmissionWizardShellProps {
  steps: WizardStep[]
  activeIndex: number
  onStepChange: (index: number) => void
  /** Max step index the user may jump to (completed + current). */
  maxReachableIndex: number
  stepTitle: string
  stepDescription: string
  children: React.ReactNode
  onBack: () => void
  onNext: () => void
  nextLabel: string
  backLabel: string
  nextDisabled?: boolean
  hideNext?: boolean
  footerExtra?: React.ReactNode
  getStepLabel: (step: WizardStep) => string
}

export function SubmissionWizardShell({
  steps,
  activeIndex,
  onStepChange,
  maxReachableIndex,
  stepTitle,
  stepDescription,
  children,
  onBack,
  onNext,
  nextLabel,
  backLabel,
  nextDisabled,
  hideNext,
  footerExtra,
  getStepLabel,
}: SubmissionWizardShellProps) {
  const progress = ((activeIndex + 1) / steps.length) * 100

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Progress
          value={progress}
          className="h-1.5"
          aria-label={`Step ${activeIndex + 1} of ${steps.length}`}
        />
        <nav aria-label="Submission steps">
          <ol className="flex flex-wrap gap-2">
            {steps.map((step, index) => {
              const isActive = index === activeIndex
              const isComplete = index < activeIndex
              const canNavigate = index <= maxReachableIndex
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    disabled={!canNavigate}
                    aria-current={isActive ? 'step' : undefined}
                    onClick={() => {
                      if (canNavigate) onStepChange(index)
                    }}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      isActive
                        ? 'border-primary/50 bg-primary/10 text-foreground'
                        : isComplete
                          ? 'border-border bg-background text-muted-foreground hover:text-foreground'
                          : 'border-border/60 text-muted-foreground',
                      canNavigate ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
                        isActive || isComplete ? 'bg-primary text-primary-foreground' : 'bg-muted',
                      )}
                    >
                      {isComplete ? <Check className="h-3 w-3" aria-hidden /> : index + 1}
                    </span>
                    <span className="hidden sm:inline">{getStepLabel(step)}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold tracking-tight" tabIndex={-1} id="submission-step-heading">
            {stepTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{stepDescription}</p>
        </div>
        <div className="space-y-4 px-4 py-5 sm:px-6">{children}</div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={activeIndex === 0}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
            {backLabel}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {footerExtra}
            {!hideNext && (
              <Button type="button" onClick={onNext} disabled={nextDisabled}>
                {nextLabel}
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Resolve display title for a step when i18n custom group name is needed. */
export function defaultStepLabel(
  step: WizardStep,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  if (step.kind === 'group' && step.groupKey && step.titleKey === 'submission_wizard_step_custom') {
    try {
      return t('submission_wizard_step_custom', { group: humanizeGroupKey(step.groupKey) })
    } catch {
      return humanizeGroupKey(step.groupKey)
    }
  }
  try {
    return t(step.titleKey)
  } catch {
    return step.id
  }
}
