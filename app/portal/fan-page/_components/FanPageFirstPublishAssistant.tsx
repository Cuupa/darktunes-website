'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GuidedStepShell } from '@/components/guided/GuidedStepShell'
import type { GuidedStepDef } from '@/lib/guided/guidedSteps'
import { FAN_PAGE_TEMPLATE_META, createTemplateDocument } from '@/lib/fan-page/templates/starterTemplates'
import { hydrateFanPageDocument } from '@/lib/fan-page/templates/hydrateArtistData'
import {
  canHardPublish,
  validateFanPageForPublish,
} from '@/lib/fan-page/publishValidation'
import { useFanPageEditorStore } from '@/lib/fan-page/editor/FanPageEditorProvider'
import type { Artist } from '@/types'
import { cn } from '@/lib/utils'

const STEPS: readonly GuidedStepDef[] = [
  { id: 'template', label: 'Layout' },
  { id: 'checklist', label: 'Checks' },
  { id: 'publish', label: 'Publish' },
]

interface FanPageFirstPublishAssistantProps {
  artist: Artist
  canPublishDirect: boolean
  onPublish: (mode: 'submit_review' | 'publish_direct') => Promise<void>
  onPreview: () => Promise<void>
  onOpenAdvanced: () => void
  isPublishing: boolean
}

export function FanPageFirstPublishAssistant({
  artist,
  canPublishDirect,
  onPublish,
  onPreview,
  onOpenAdvanced,
  isPublishing,
}: FanPageFirstPublishAssistantProps) {
  const t = useTranslations('portal')
  const document = useFanPageEditorStore((s) => s.document)
  const setDocument = useFanPageEditorStore((s) => s.setDocument)
  const [stepId, setStepId] = useState('template')
  const [maxReachable, setMaxReachable] = useState(0)
  const [templatePicked, setTemplatePicked] = useState(Boolean(document.templateId))

  const warnings = useMemo(() => validateFanPageForPublish(document), [document])
  const hardOk = canHardPublish(warnings)
  const errors = warnings.filter((w) => w.severity === 'error')
  const soft = warnings.filter((w) => w.severity === 'warning')

  const stepComplete =
    stepId === 'template'
      ? templatePicked
      : stepId === 'checklist'
        ? true
        : hardOk

  const blockedReason =
    stepId === 'template' && !templatePicked
      ? t('fan_assistant_need_template')
      : stepId === 'publish' && !hardOk
        ? t('fan_assistant_need_publish_ready')
        : null

  const applyTemplate = (templateId: string) => {
    const base = createTemplateDocument(templateId)
    const hydrated = hydrateFanPageDocument(base, artist, null)
    setDocument(hydrated)
    setTemplatePicked(true)
    toast.success(t('fan_assistant_template_applied'))
  }

  const stepIndex = STEPS.findIndex((s) => s.id === stepId)

  const goNext = async () => {
    if (stepId === 'publish') {
      await onPublish(canPublishDirect ? 'publish_direct' : 'submit_review')
      return
    }
    const next = STEPS[stepIndex + 1]
    if (next) {
      setStepId(next.id)
      setMaxReachable((m) => Math.max(m, stepIndex + 1))
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <GuidedStepShell
        steps={STEPS.map((s) => ({
          ...s,
          label:
            s.id === 'template'
              ? t('fan_assistant_step_template')
              : s.id === 'checklist'
                ? t('fan_assistant_step_checklist')
                : t('fan_assistant_step_publish'),
        }))}
        activeStepId={stepId}
        onStepChange={setStepId}
        maxReachableIndex={maxReachable}
        coachTitle={
          stepId === 'template'
            ? t('fan_assistant_coach_template_title')
            : stepId === 'checklist'
              ? t('fan_assistant_coach_checklist_title')
              : t('fan_assistant_coach_publish_title')
        }
        coachBody={
          stepId === 'template'
            ? t('fan_assistant_coach_template_body')
            : stepId === 'checklist'
              ? t('fan_assistant_coach_checklist_body')
              : t('fan_assistant_coach_publish_body')
        }
        coachChecks={[
          { id: 'tpl', label: t('fan_assistant_check_template'), done: templatePicked },
          { id: 'sec', label: t('fan_assistant_check_sections'), done: hardOk },
        ]}
        blockedReason={blockedReason}
        canContinue={stepComplete && !isPublishing}
        onBack={() => {
          if (stepIndex > 0) setStepId(STEPS[stepIndex - 1]!.id)
        }}
        onNext={() => void goNext()}
        nextLabel={
          stepId === 'publish'
            ? canPublishDirect
              ? t('fanPage_publish_direct')
              : t('fanPage_publish_review')
            : t('guided_continue')
        }
        isLastStep={stepId === 'publish'}
        onSwitchToAdvanced={onOpenAdvanced}
        switchAdvancedLabel={t('guided_switch_advanced')}
        backLabel={t('guided_back')}
      >
        {stepId === 'template' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {FAN_PAGE_TEMPLATE_META.map((meta) => (
              <button
                key={meta.id}
                type="button"
                onClick={() => applyTemplate(meta.id)}
                className={cn(
                  'rounded-lg border p-4 text-left transition-colors min-h-11',
                  document.templateId === meta.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-muted/40',
                )}
              >
                <p className="text-sm font-semibold">{meta.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{meta.description}</p>
              </button>
            ))}
          </div>
        )}

        {stepId === 'checklist' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('fan_assistant_step_checklist')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {errors.length === 0 && soft.length === 0 ? (
                <p className="text-emerald-300">{t('fan_assistant_checks_ok')}</p>
              ) : null}
              {errors.map((w) => (
                <p key={w.code} className="text-destructive">
                  {w.message}
                </p>
              ))}
              {soft.map((w) => (
                <p key={w.code} className="text-amber-200">
                  {w.message}
                </p>
              ))}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => void onPreview()}>
                  {t('fanPage_preview')}
                </Button>
                <Button type="button" variant="secondary" onClick={onOpenAdvanced}>
                  {t('fan_assistant_edit_advanced')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {stepId === 'publish' && (
          <Card>
            <CardContent className="pt-6 space-y-3 text-sm">
              <p>{t('fan_assistant_publish_summary')}</p>
              {!hardOk && (
                <p className="text-destructive" role="alert">
                  {t('fan_assistant_need_publish_ready')}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </GuidedStepShell>
    </div>
  )
}
