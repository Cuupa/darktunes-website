'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { SchemaDrivenField } from '@/components/submissions/SchemaDrivenField'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { buildReleaseWizardSteps, humanizeGroupKey, type WizardStep } from '@/lib/submissions/wizardSteps'
import { validateFieldValue } from '@/lib/submissions/fieldValidation'
import {
  SubmissionWizardShell,
  defaultStepLabel,
} from '@/components/portal/SubmissionWizardShell'
import type { Artist, SubmissionFormField } from '@/types'

const STANDARD_FIELD_TO_BODY_KEY: Record<string, string> = {
  title: 'title',
  download_url: 'downloadUrl',
  thumbnail_url: 'thumbnailUrl',
  youtube_title: 'youtubeTitle',
  youtube_description: 'youtubeDescription',
  youtube_tags: 'youtubeTags',
  youtube_category: 'youtubeCategory',
  target_publish_date: 'targetPublishDate',
  description: 'description',
  notes: 'notes',
}

interface VideoSubmissionFormProps {
  formSchema: SubmissionFormField[]
  artist: Artist | null
}

export function VideoSubmissionForm({ formSchema, artist }: VideoSubmissionFormProps) {
  const t = useTranslations('portal')
  const locale = useLocale()
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>({
    youtube_category: '10',
  })
  const [submitting, setSubmitting] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [maxReachableIndex, setMaxReachableIndex] = useState(0)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const visibleFields = useMemo(
    () => [...formSchema].filter((f) => f.isVisible).sort((a, b) => a.displayOrder - b.displayOrder),
    [formSchema],
  )

  // Reuse release wizard builder: no tracks → groups + review
  const wizardSteps = useMemo(
    () => buildReleaseWizardSteps(visibleFields, []),
    [visibleFields],
  )

  const activeStep: WizardStep | undefined = wizardSteps[activeIndex]

  const setFieldValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const resolveStepTitle = (step: WizardStep): string => {
    if (step.kind === 'group' && step.groupKey && step.titleKey === 'submission_wizard_step_custom') {
      return t('submission_wizard_step_custom', { group: humanizeGroupKey(step.groupKey) })
    }
    return t(step.titleKey as Parameters<typeof t>[0])
  }

  const resolveStepDescription = (step: WizardStep): string => {
    if (step.kind === 'group' && step.groupKey && step.descriptionKey === 'submission_wizard_step_custom_desc') {
      return t('submission_wizard_step_custom_desc', { group: humanizeGroupKey(step.groupKey) })
    }
    return t(step.descriptionKey as Parameters<typeof t>[0])
  }

  const validateCurrentStep = useCallback((): boolean => {
    if (!activeStep || activeStep.kind === 'review') return true
    const errors: Record<string, string> = {}
    for (const field of activeStep.fields) {
      const raw = values[field.fieldKey] ?? ''
      if (field.isRequired && !raw.trim() && field.fieldType !== 'boolean') {
        errors[field.fieldKey] = t('releases_submit_required')
      } else if (raw.trim()) {
        const err = validateFieldValue(field.fieldType, raw)
        if (err) errors[field.fieldKey] = err
      }
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [activeStep, values, t])

  const goNext = () => {
    if (!validateCurrentStep()) {
      toast.error(t('releases_submit_validation_error'))
      return
    }
    const next = Math.min(activeIndex + 1, wizardSteps.length - 1)
    setActiveIndex(next)
    setMaxReachableIndex((m) => Math.max(m, next))
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        toast.error(t('video_submit_error'))
        return
      }

      const standardBody: Record<string, unknown> = {}
      const formData: Record<string, string> = {}

      for (const field of visibleFields) {
        const raw = values[field.fieldKey] ?? ''
        const bodyKey = STANDARD_FIELD_TO_BODY_KEY[field.fieldKey]
        if (bodyKey !== undefined) {
          if (field.fieldKey === 'youtube_tags') {
            standardBody[bodyKey] = raw.split(',').map((tag) => tag.trim()).filter(Boolean)
          } else if (field.fieldType === 'boolean') {
            standardBody[bodyKey] = raw === 'true'
          } else {
            standardBody[bodyKey] = raw.trim() || null
          }
        } else if (raw.trim()) {
          formData[field.fieldKey] = raw.trim()
        }
      }

      const url = artist?.id
        ? `/api/portal/submit-video?artistId=${encodeURIComponent(artist.id)}`
        : '/api/portal/submit-video'

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...standardBody,
          formData: Object.keys(formData).length > 0 ? formData : null,
        }),
      })

      if (!res.ok) {
        toast.error(t('video_submit_error'))
        return
      }

      toast.success(t('video_submit_success'))
      router.push('/portal/releases/videos')
      router.refresh()
    } catch {
      toast.error(t('video_submit_error'))
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (activeIndex >= wizardSteps.length) {
      setActiveIndex(Math.max(0, wizardSteps.length - 1))
    }
  }, [wizardSteps.length, activeIndex])

  if (!activeStep) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('video_submit_heading')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('submission_wizard_intro')}</p>
      </div>

      <SubmissionWizardShell
        steps={wizardSteps}
        activeIndex={activeIndex}
        onStepChange={setActiveIndex}
        maxReachableIndex={maxReachableIndex}
        stepTitle={resolveStepTitle(activeStep)}
        stepDescription={resolveStepDescription(activeStep)}
        onBack={() => setActiveIndex((i) => Math.max(0, i - 1))}
        onNext={activeStep.kind === 'review' ? () => void submit() : goNext}
        nextLabel={
          activeStep.kind === 'review'
            ? submitting
              ? t('video_submit_saving')
              : t('video_submit_save')
            : t('submission_wizard_next')
        }
        backLabel={t('submission_wizard_back')}
        nextDisabled={activeStep.kind === 'review' ? submitting : false}
        getStepLabel={(step: WizardStep) =>
          defaultStepLabel(step, (key: string, vals?: Record<string, string>) =>
            t(key as Parameters<typeof t>[0], vals),
          )
        }
      >
        {(activeStep.kind === 'type' || activeStep.kind === 'group') && (
          <div className="space-y-4">
            {activeStep.fields.map((field) => (
              <SchemaDrivenField
                key={field.id}
                field={field}
                locale={locale}
                value={values[field.fieldKey] ?? ''}
                onChange={(v) => setFieldValue(field.fieldKey, v)}
                error={fieldErrors[field.fieldKey]}
              />
            ))}
          </div>
        )}
        {activeStep.kind === 'review' && (
          <div className="space-y-2 rounded-md border border-border p-4">
            <h3 className="text-sm font-semibold">{t('submission_wizard_review_summary')}</h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {visibleFields.map((field) => {
                const raw = values[field.fieldKey] ?? ''
                if (!raw.trim()) return null
                return (
                  <div key={field.id}>
                    <dt className="text-xs text-muted-foreground">
                      {field.fieldLabels[locale] ?? field.fieldLabels.en ?? field.fieldKey}
                    </dt>
                    <dd className="font-medium break-all">{raw}</dd>
                  </div>
                )
              })}
            </dl>
            <p className="text-sm text-muted-foreground pt-2">{t('submission_wizard_review_ready')}</p>
          </div>
        )}
      </SubmissionWizardShell>
    </div>
  )
}
