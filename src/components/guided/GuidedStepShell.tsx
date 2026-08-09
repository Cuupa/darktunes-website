'use client'

import { useMemo } from 'react'
import { ArrowLeft, ArrowRight, List } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { GuidedStepCoach, type GuidedCoachCheck } from '@/components/guided/GuidedStepCoach'
import {
  canNavigateToGuidedStep,
  guidedStepIndex,
  type GuidedStepDef,
} from '@/lib/guided/guidedSteps'
import { cn } from '@/lib/utils'

export interface GuidedStepShellProps {
  steps: readonly GuidedStepDef[]
  activeStepId: string
  onStepChange: (stepId: string) => void
  /** Highest index the user may jump to (inclusive). */
  maxReachableIndex: number
  coachTitle: string
  coachBody: string
  coachChecks?: GuidedCoachCheck[]
  blockedReason?: string | null
  canContinue: boolean
  onBack: () => void
  onNext: () => void
  backLabel?: string
  nextLabel?: string
  isLastStep?: boolean
  onSwitchToAdvanced?: () => void
  switchAdvancedLabel?: string
  children: React.ReactNode
  stepOfLabel?: (current: number, total: number) => string
  className?: string
}

export function GuidedStepShell({
  steps,
  activeStepId,
  onStepChange,
  maxReachableIndex,
  coachTitle,
  coachBody,
  coachChecks,
  blockedReason,
  canContinue,
  onBack,
  onNext,
  backLabel = 'Back',
  nextLabel = 'Continue',
  isLastStep = false,
  onSwitchToAdvanced,
  switchAdvancedLabel = 'Switch to advanced',
  children,
  stepOfLabel = (c, t) => `Step ${c} of ${t}`,
  className,
}: GuidedStepShellProps) {
  const activeIndex = guidedStepIndex(activeStepId, steps)
  const progress = steps.length > 0 ? ((activeIndex + 1) / steps.length) * 100 : 0
  const canGoBack = activeIndex > 0
  const activeLabel = steps[activeIndex]?.label ?? ''

  const stepProgress = useMemo(
    () => stepOfLabel(Math.max(1, activeIndex + 1), steps.length),
    [activeIndex, stepOfLabel, steps.length],
  )

  return (
    <div className={cn('flex flex-col min-h-[420px]', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-border">
        <nav aria-label="Guided workflow">
          <ol className="flex flex-wrap items-center gap-2 sm:gap-3">
            {steps.map((step, index) => {
              const isActive = step.id === activeStepId
              const isComplete = index < activeIndex
              const canNav = canNavigateToGuidedStep(
                step.id,
                activeStepId,
                steps,
                maxReachableIndex,
              )
              return (
                <li key={step.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!canNav}
                    aria-current={isActive ? 'step' : undefined}
                    onClick={() => {
                      if (canNav) onStepChange(step.id)
                    }}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors min-h-9',
                      isActive
                        ? 'border-primary/50 bg-primary/10 text-foreground'
                        : isComplete
                          ? 'border-border bg-background text-muted-foreground hover:text-foreground'
                          : 'border-border/60 text-muted-foreground',
                      canNav ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
                    )}
                  >
                    {step.label}
                  </button>
                  {index < steps.length - 1 && (
                    <span className="hidden sm:inline text-muted-foreground" aria-hidden="true">
                      →
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
        {onSwitchToAdvanced && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground"
            onClick={onSwitchToAdvanced}
          >
            <List size={14} aria-hidden="true" />
            {switchAdvancedLabel}
          </Button>
        )}
      </div>

      <div className="py-3">
        <Progress value={progress} className="h-1.5" aria-hidden="true" />
      </div>

      <GuidedStepCoach
        title={coachTitle}
        body={coachBody}
        checks={coachChecks}
        blockedReason={!canContinue ? blockedReason : null}
        className="mb-4"
      />

      <div className="flex-1 space-y-4">{children}</div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 mt-6">
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            disabled={!canGoBack}
            onClick={onBack}
            className="min-h-11 w-fit"
          >
            <ArrowLeft size={16} className="mr-1.5" aria-hidden="true" />
            {backLabel}
          </Button>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {stepProgress}
            {activeLabel ? ` · ${activeLabel}` : ''}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1 max-w-sm">
          <Button
            type="button"
            disabled={!canContinue}
            onClick={onNext}
            className="min-h-11"
          >
            {nextLabel}
            {!isLastStep && <ArrowRight size={16} className="ml-1.5" aria-hidden="true" />}
          </Button>
          {!canContinue && blockedReason ? (
            <p className="text-[11px] text-muted-foreground text-right leading-snug" role="status">
              {blockedReason}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
