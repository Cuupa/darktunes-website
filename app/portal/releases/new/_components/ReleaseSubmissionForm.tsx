'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { CoverArtAnalyzer } from '@/components/portal/CoverArtAnalyzer'
import { SchemaDrivenField } from '@/components/submissions/SchemaDrivenField'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { validateFieldValue } from '@/lib/submissions/fieldValidation'
import {
  filterFieldsForType,
  getTypeRuleForRelease,
  validateTrackCount,
} from '@/lib/submissions/fieldTypeRules'
import { RELEASE_STANDARD_FIELD_TO_BODY_KEY } from '@/lib/submissions/releaseFieldMapping'
import { filterArtistTrackFields } from '@/lib/submissions/trackFieldMapping'
import {
  applyFieldToAllTracks,
  buildReleaseWizardSteps,
  copyTrackValues,
  countCompleteTracks,
  humanizeGroupKey,
  isTrackRowComplete,
  prefillTrackFromRelease,
  validateStepFields,
  type WizardStep,
} from '@/lib/submissions/wizardSteps'
import { getFieldLabel } from '@/lib/submissions/fieldLabels'
import { useLocalKV } from '@/hooks/useLocalKV'
import type { SubmissionReleaseType } from '@/lib/submissions/fieldTypes'
import type { Artist, SubmissionFormField, SubmissionReleaseTypeRule } from '@/types'
import {
  SubmissionWizardShell,
  defaultStepLabel,
} from './SubmissionWizardShell'

interface ReleaseSubmissionFormProps {
  artist: Artist | null
  formSchema: SubmissionFormField[]
  typeRules: SubmissionReleaseTypeRule[]
}

interface TrackRow {
  id: string
  values: Record<string, string>
}

interface DraftState {
  values: Record<string, string>
  tracks: TrackRow[]
  trackCount: number
  stepId: string
  coverArtVerified: boolean
}

function emptyTrackValues(trackFields: SubmissionFormField[]): Record<string, string> {
  const values: Record<string, string> = {}
  for (const f of trackFields) {
    values[f.fieldKey] = f.fieldType === 'boolean' ? 'false' : ''
  }
  return values
}

function buildTrackRows(
  count: number,
  trackFields: SubmissionFormField[],
  existing: TrackRow[],
  releaseValues: Record<string, string>,
): TrackRow[] {
  const rows: TrackRow[] = []
  for (let i = 0; i < count; i += 1) {
    const prev = existing[i]
    const base = prev?.values ?? emptyTrackValues(trackFields)
    const filled = prev ? base : prefillTrackFromRelease(base, releaseValues, trackFields)
    // Ensure all current track field keys exist
    for (const f of trackFields) {
      if (filled[f.fieldKey] === undefined) {
        filled[f.fieldKey] = f.fieldType === 'boolean' ? 'false' : ''
      }
    }
    rows.push({
      id: prev?.id ?? `track-${i + 1}`,
      values: filled,
    })
  }
  return rows
}

function buildInitialValues(
  formSchema: SubmissionFormField[],
  artist: Artist | null,
): Record<string, string> {
  const init: Record<string, string> = { type: 'single' }
  if (artist?.name) init.artist_name = artist.name
  if (artist?.genres?.[0]) init.genre = artist.genres[0]
  if (artist?.spotifyUrl) init.spotify_url = artist.spotifyUrl
  if (artist?.appleMusicUrl) init.apple_music_url = artist.appleMusicUrl
  if (artist?.youtubeUrl) init.youtube_url = artist.youtubeUrl
  for (const f of formSchema) {
    if (init[f.fieldKey] === undefined) {
      init[f.fieldKey] = f.fieldType === 'boolean' ? 'false' : ''
    }
  }
  return init
}

const COPYABLE_TRACK_KEYS = [
  'composer',
  'author',
  'track_genre',
  'track_language',
  'gema_track',
  'explicit',
  'live',
  'cover_version',
  'instrumental',
]

export function ReleaseSubmissionForm({ artist, formSchema, typeRules }: ReleaseSubmissionFormProps) {
  const t = useTranslations('portal')
  const locale = useLocale()
  const router = useRouter()
  const draftKey = `release-submission-draft:${artist?.id ?? 'anon'}`
  const [draft, setDraft, clearDraft, draftLoaded] = useLocalKV<DraftState>(draftKey)
  const restoredRef = useRef(false)
  const headingFocusRef = useRef(false)
  const prevReleaseTypeRef = useRef<SubmissionReleaseType | null>(null)
  // Suppress draft persist until initial restore decision is done
  const allowPersistRef = useRef(false)

  const releaseFields = useMemo(
    () => formSchema.filter((f) => f.fieldScope === 'release').sort((a, b) => a.displayOrder - b.displayOrder),
    [formSchema],
  )
  const allTrackFields = useMemo(
    () => formSchema.filter((f) => f.fieldScope === 'track').sort((a, b) => a.displayOrder - b.displayOrder),
    [formSchema],
  )

  const [values, setValues] = useState<Record<string, string>>(() =>
    buildInitialValues(formSchema, artist),
  )
  const valuesRef = useRef(values)
  valuesRef.current = values

  const releaseType = (values.type || 'single') as SubmissionReleaseType
  const activeTypeRule = getTypeRuleForRelease(typeRules, releaseType)
  const userSpecifiedTracks = activeTypeRule?.trackCountMode === 'user_specified'

  const [trackCount, setTrackCount] = useState(activeTypeRule?.minTracks ?? 1)
  const visibleReleaseFields = useMemo(
    () => filterFieldsForType(releaseFields, releaseType, values),
    [releaseFields, releaseType, values],
  )
  const visibleTrackFields = useMemo(
    () => filterArtistTrackFields(filterFieldsForType(allTrackFields, releaseType, values)),
    [allTrackFields, releaseType, values],
  )

  const [tracks, setTracks] = useState<TrackRow[]>(() =>
    buildTrackRows(
      1,
      filterFieldsForType(allTrackFields, 'single', { type: 'single' }),
      [],
      {},
    ),
  )
  const [coverArtVerified, setCoverArtVerified] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [maxReachableIndex, setMaxReachableIndex] = useState(0)
  const [showDraftBanner, setShowDraftBanner] = useState(false)

  const wizardSteps = useMemo(
    () => buildReleaseWizardSteps(visibleReleaseFields, visibleTrackFields),
    [visibleReleaseFields, visibleTrackFields],
  )

  // Restore draft once IndexedDB loads (never trust coverArtVerified — re-check)
  useEffect(() => {
    if (!draftLoaded || restoredRef.current) return
    restoredRef.current = true
    if (draft?.values && Object.keys(draft.values).length > 0) {
      const restoredType = (draft.values.type || 'single') as SubmissionReleaseType
      prevReleaseTypeRef.current = restoredType
      setValues((prev) => ({ ...prev, ...draft.values }))
      if (draft.tracks?.length) setTracks(draft.tracks)
      if (typeof draft.trackCount === 'number') setTrackCount(draft.trackCount)
      // Force re-verification after restore (stale draft flag is not trustworthy)
      setCoverArtVerified(false)
      setShowDraftBanner(true)
    } else {
      prevReleaseTypeRef.current = 'single'
    }
    allowPersistRef.current = true
  }, [draftLoaded, draft])

  // Restore step after steps rebuild from restored type
  useEffect(() => {
    if (!draft?.stepId || !showDraftBanner) return
    const idx = wizardSteps.findIndex((s) => s.id === draft.stepId)
    if (idx >= 0) {
      setActiveIndex(idx)
      setMaxReachableIndex((m) => Math.max(m, idx))
    }
  }, [wizardSteps, draft?.stepId, showDraftBanner])

  // Persist draft (after restore decision)
  useEffect(() => {
    if (!draftLoaded || !artist?.id || !allowPersistRef.current) return
    const handle = setTimeout(() => {
      setDraft({
        values,
        tracks,
        trackCount,
        stepId: wizardSteps[activeIndex]?.id ?? 'type',
        coverArtVerified,
      })
    }, 400)
    return () => clearTimeout(handle)
  }, [
    values,
    tracks,
    trackCount,
    activeIndex,
    coverArtVerified,
    wizardSteps,
    draftLoaded,
    artist?.id,
    setDraft,
  ])

  // Only reset track count when the release *type* actually changes (not on draft restore)
  useEffect(() => {
    const prev = prevReleaseTypeRef.current
    if (prev === null) {
      prevReleaseTypeRef.current = releaseType
      return
    }
    if (prev === releaseType) return
    prevReleaseTypeRef.current = releaseType
    const rule = getTypeRuleForRelease(typeRules, releaseType)
    const nextCount = rule?.trackCountMode === 'fixed_1' ? 1 : (rule?.minTracks ?? 2)
    setTrackCount(nextCount)
  }, [releaseType, typeRules])

  // Resize track rows when count / track fields change — do not depend on all release values
  useEffect(() => {
    const count = userSpecifiedTracks ? trackCount : 1
    setTracks((prev) => buildTrackRows(count, visibleTrackFields, prev, valuesRef.current))
  }, [trackCount, userSpecifiedTracks, visibleTrackFields])

  // Keep active index in range when steps change (e.g. type switch)
  useEffect(() => {
    if (activeIndex >= wizardSteps.length) {
      setActiveIndex(Math.max(0, wizardSteps.length - 1))
    }
    setMaxReachableIndex((m) => {
      const maxStep = Math.max(wizardSteps.length - 1, 0)
      return m > maxStep ? maxStep : m
    })
  }, [wizardSteps.length, activeIndex])

  useEffect(() => {
    if (!headingFocusRef.current) {
      headingFocusRef.current = true
      return
    }
    document.getElementById('submission-step-heading')?.focus()
  }, [activeIndex])

  const activeStep: WizardStep | undefined = wizardSteps[activeIndex]

  const setFieldValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    if (key === 'cover_art_url') setCoverArtVerified(false)
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const handleCoverArtVerified = useCallback((verified: boolean) => {
    setCoverArtVerified(verified)
  }, [])

  const setTrackValue = (trackId: string, key: string, value: string) => {
    setTracks((prev) =>
      prev.map((tr) => (tr.id === trackId ? { ...tr, values: { ...tr.values, [key]: value } } : tr)),
    )
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[`${trackId}:${key}`]
      return next
    })
  }

  const coverField = useMemo(
    () => visibleReleaseFields.find((f) => f.fieldKey === 'cover_art_url') ?? null,
    [visibleReleaseFields],
  )
  const coverNeedsVerification = Boolean(
    coverField &&
      (coverField.isRequired || (values.cover_art_url ?? '').trim().length > 0),
  )

  const validateCurrentStep = (): boolean => {
    if (!activeStep) return true
    const errors: Record<string, string> = {}

    if (activeStep.kind === 'type' || activeStep.kind === 'group') {
      Object.assign(
        errors,
        validateStepFields(
          activeStep.fields,
          values,
          validateFieldValue,
          t('releases_submit_required'),
        ),
      )
      if (activeStep.kind === 'type' && userSpecifiedTracks) {
        const trackCountError = validateTrackCount(activeTypeRule, trackCount, tracks.length)
        if (trackCountError) errors.track_count = trackCountError
      }
      // Cover verification when the cover field is on this step and needs check
      if (activeStep.fields.some((f) => f.fieldKey === 'cover_art_url') && coverNeedsVerification) {
        if (!coverArtVerified) {
          errors.cover_art_url = t('releases_submit_cover_check_required')
        }
      }
    }

    if (activeStep.kind === 'tracks') {
      const trackCountError = validateTrackCount(
        activeTypeRule,
        userSpecifiedTracks ? trackCount : 1,
        tracks.length,
      )
      if (trackCountError) errors.track_count = trackCountError
      for (const track of tracks) {
        for (const field of visibleTrackFields) {
          const raw = track.values[field.fieldKey] ?? ''
          const errKey = `${track.id}:${field.fieldKey}`
          if (field.isRequired && !raw.trim() && field.fieldType !== 'boolean') {
            errors[errKey] = t('releases_submit_required')
          } else if (raw.trim()) {
            const err = validateFieldValue(field.fieldType, raw)
            if (err) errors[errKey] = err
          }
        }
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateBeforeSubmit = (): boolean => {
    const errors: Record<string, string> = {}

    for (const field of visibleReleaseFields) {
      const raw = values[field.fieldKey] ?? ''
      if (field.isRequired && !raw.trim() && field.fieldType !== 'boolean') {
        errors[field.fieldKey] = t('releases_submit_required')
      } else if (raw.trim()) {
        const err = validateFieldValue(field.fieldType, raw)
        if (err) errors[field.fieldKey] = err
      }
    }

    const trackCountError = validateTrackCount(activeTypeRule, userSpecifiedTracks ? trackCount : 1, tracks.length)
    if (trackCountError) errors.track_count = trackCountError

    for (const track of tracks) {
      for (const field of visibleTrackFields) {
        const raw = track.values[field.fieldKey] ?? ''
        const errKey = `${track.id}:${field.fieldKey}`
        if (field.isRequired && !raw.trim() && field.fieldType !== 'boolean') {
          errors[errKey] = t('releases_submit_required')
        } else if (raw.trim()) {
          const err = validateFieldValue(field.fieldType, raw)
          if (err) errors[errKey] = err
        }
      }
    }

    if (coverNeedsVerification && !coverArtVerified) {
      errors.cover_art_url = t('releases_submit_cover_check_required')
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const goNext = () => {
    if (!validateCurrentStep()) {
      toast.error(t('releases_submit_validation_error'))
      return
    }
    const next = Math.min(activeIndex + 1, wizardSteps.length - 1)
    setActiveIndex(next)
    setMaxReachableIndex((m) => Math.max(m, next))
  }

  const goBack = () => {
    setActiveIndex((i) => Math.max(0, i - 1))
  }

  const submit = async () => {
    if (coverNeedsVerification && !coverArtVerified) {
      toast.error(t('releases_submit_cover_check_required'))
      return
    }
    if (!validateBeforeSubmit()) {
      toast.error(t('releases_submit_validation_error'))
      return
    }

    setSubmitting(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        toast.error(t('releases_submit_error'))
        return
      }

      const standardBody: Record<string, unknown> = {
        coverArtVerified: true,
      }
      const formData: Record<string, unknown> = {}

      for (const field of visibleReleaseFields) {
        const raw = values[field.fieldKey] ?? ''
        const bodyKey = RELEASE_STANDARD_FIELD_TO_BODY_KEY[field.fieldKey]
        if (bodyKey !== undefined) {
          if (field.fieldType === 'boolean') {
            standardBody[bodyKey] = raw === 'true'
          } else {
            standardBody[bodyKey] = raw.trim() || null
          }
        } else if (raw.trim()) {
          formData[field.fieldKey] = field.fieldType === 'boolean' ? raw === 'true' : raw.trim()
        }
      }

      const trackPayload = tracks.map((track, index) => ({
        trackNumber: index + 1,
        values: track.values,
      }))

      const res = await fetch('/api/portal/submit-release', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...standardBody,
          formData: Object.keys(formData).length > 0 ? formData : null,
          tracks: trackPayload,
          trackCount: userSpecifiedTracks ? trackCount : 1,
        }),
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(err.error ?? t('releases_submit_error'))
        return
      }

      clearDraft()
      toast.success(t('releases_submit_success'))
      router.push('/portal/releases/submissions')
      router.refresh()
    } catch {
      toast.error(t('releases_submit_error'))
    } finally {
      setSubmitting(false)
    }
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

  const renderReleaseFields = (fields: SubmissionFormField[]) =>
    fields.map((field) => (
      <div key={field.id}>
        {field.fieldKey === 'cover_art_url' ? (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {field.fieldLabels[locale] ?? field.fieldLabels.en ?? field.fieldKey}
              {field.isRequired && (
                <span className="text-destructive ml-1" aria-hidden="true">
                  *
                </span>
              )}
            </Label>
            <CoverArtAnalyzer
              url={values.cover_art_url ?? ''}
              onVerified={handleCoverArtVerified}
              onUrlChange={(v) => setFieldValue('cover_art_url', v)}
            />
            {fieldErrors[field.fieldKey] && (
              <p className="text-sm text-destructive" role="alert">
                {fieldErrors[field.fieldKey]}
              </p>
            )}
          </div>
        ) : (
          <SchemaDrivenField
            field={field}
            locale={locale}
            value={values[field.fieldKey] ?? ''}
            onChange={(v) => setFieldValue(field.fieldKey, v)}
            error={fieldErrors[field.fieldKey]}
          />
        )}
      </div>
    ))

  const tracksComplete = countCompleteTracks(tracks, visibleTrackFields)

  const reviewIssues = useMemo(() => {
    const issues: Array<{ label: string; stepId: string }> = []
    for (const field of visibleReleaseFields) {
      const raw = values[field.fieldKey] ?? ''
      if (field.isRequired && field.fieldType !== 'boolean' && !raw.trim()) {
        const step =
          wizardSteps.find(
            (s) =>
              (s.kind === 'type' || s.kind === 'group') &&
              s.fields.some((f) => f.fieldKey === field.fieldKey),
          ) ?? wizardSteps.find((s) => s.kind === 'review')
        issues.push({
          label: getFieldLabel(field, locale),
          stepId: step?.id ?? 'review',
        })
      }
    }
    if (coverNeedsVerification && !coverArtVerified) {
      const dist = wizardSteps.find((s) => s.fields.some((f) => f.fieldKey === 'cover_art_url'))
      issues.push({
        label: t('releases_submit_cover_check_heading'),
        stepId: dist?.id ?? 'review',
      })
    }
    if (visibleTrackFields.some((f) => f.isRequired)) {
      const incomplete = tracks.length - tracksComplete
      if (incomplete > 0) {
        issues.push({
          label: t('submission_wizard_review_tracks_incomplete', {
            n: String(incomplete),
          }),
          stepId: 'tracks',
        })
      }
    }
    return issues
  }, [
    visibleReleaseFields,
    values,
    coverArtVerified,
    coverNeedsVerification,
    visibleTrackFields,
    tracks,
    tracksComplete,
    wizardSteps,
    locale,
    t,
  ])

  const discardDraft = () => {
    clearDraft()
    setShowDraftBanner(false)
    const initial = buildInitialValues(formSchema, artist)
    setValues(initial)
    prevReleaseTypeRef.current = (initial.type || 'single') as SubmissionReleaseType
    setTracks(
      buildTrackRows(1, filterFieldsForType(allTrackFields, 'single', { type: 'single' }), [], {}),
    )
    setTrackCount(1)
    setCoverArtVerified(false)
    setActiveIndex(0)
    setMaxReachableIndex(0)
    allowPersistRef.current = true
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('releases_submit_heading')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('releases_submit_pending_notice')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('submission_wizard_intro')}</p>
      </div>

      {showDraftBanner && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm"
          role="status"
        >
          <span>{t('submission_wizard_draft_restored')}</span>
          <Button type="button" variant="outline" size="sm" onClick={discardDraft}>
            {t('submission_wizard_draft_discard')}
          </Button>
        </div>
      )}

      {activeStep && (
        <SubmissionWizardShell
          steps={wizardSteps}
          activeIndex={activeIndex}
          onStepChange={setActiveIndex}
          maxReachableIndex={maxReachableIndex}
          stepTitle={resolveStepTitle(activeStep)}
          stepDescription={resolveStepDescription(activeStep)}
          onBack={goBack}
          onNext={activeStep.kind === 'review' ? () => void submit() : goNext}
          nextLabel={
            activeStep.kind === 'review'
              ? submitting
                ? t('releases_submit_saving')
                : t('releases_submit_save')
              : t('submission_wizard_next')
          }
          backLabel={t('submission_wizard_back')}
          nextDisabled={
            activeStep.kind === 'review'
              ? submitting || reviewIssues.length > 0 || (coverNeedsVerification && !coverArtVerified)
              : false
          }
          hideNext={false}
          getStepLabel={(step) => defaultStepLabel(step, (key, vals) => t(key as Parameters<typeof t>[0], vals))}
          footerExtra={
            activeStep.kind === 'review' && coverNeedsVerification ? (
              <span className="text-xs text-muted-foreground">
                {coverArtVerified
                  ? t('releases_submit_cover_check_ok')
                  : t('releases_submit_cover_check_required')}
              </span>
            ) : null
          }
        >
          {(activeStep.kind === 'type' || activeStep.kind === 'group') && (
            <div className="space-y-4">
              {renderReleaseFields(activeStep.fields)}
              {activeStep.kind === 'type' && userSpecifiedTracks && (
                <div className="space-y-2 border-t border-border pt-4">
                  <Label htmlFor="track-count">{t('releases_submit_track_count')}</Label>
                  <Input
                    id="track-count"
                    type="number"
                    min={activeTypeRule?.minTracks ?? 2}
                    max={activeTypeRule?.maxTracks ?? 99}
                    value={trackCount}
                    onChange={(e) => {
                      const next = Number(e.target.value)
                      if (!Number.isNaN(next)) setTrackCount(next)
                      setFieldErrors((prev) => {
                        const copy = { ...prev }
                        delete copy.track_count
                        return copy
                      })
                    }}
                    aria-invalid={!!fieldErrors.track_count}
                    aria-describedby={fieldErrors.track_count ? 'track-count-error' : undefined}
                  />
                  {fieldErrors.track_count && (
                    <p id="track-count-error" className="text-sm text-destructive" role="alert">
                      {fieldErrors.track_count}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t('releases_submit_track_count_hint', {
                      min: activeTypeRule?.minTracks ?? 2,
                      max: activeTypeRule?.maxTracks ?? 99,
                    })}
                  </p>
                </div>
              )}
              {activeStep.kind === 'type' && activeTypeRule && (
                <p className="text-xs text-muted-foreground rounded-md bg-muted/40 px-3 py-2">
                  {userSpecifiedTracks
                    ? t('submission_wizard_type_hint_multi', {
                        min: String(activeTypeRule.minTracks),
                        max: String(activeTypeRule.maxTracks),
                      })
                    : t('submission_wizard_type_hint_single')}
                </p>
              )}
            </div>
          )}

          {activeStep.kind === 'tracks' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {t('submission_wizard_tracks_progress', {
                    done: String(tracksComplete),
                    total: String(tracks.length),
                  })}
                </p>
                <Badge variant="secondary">
                  {tracksComplete}/{tracks.length}
                </Badge>
              </div>

              <Accordion type="multiple" defaultValue={tracks[0] ? [tracks[0].id] : []} className="space-y-2">
                {tracks.map((track, index) => {
                  const complete = isTrackRowComplete(track.values, visibleTrackFields)
                  return (
                    <AccordionItem
                      key={track.id}
                      value={track.id}
                      className="rounded-md border border-border px-3"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {t('releases_submit_track_label', { n: index + 1 })}
                          {track.values.song_title ? (
                            <span className="font-normal text-muted-foreground truncate max-w-[12rem]">
                              — {track.values.song_title}
                            </span>
                          ) : null}
                          <Badge variant={complete ? 'default' : 'outline'} className="text-[10px]">
                            {complete
                              ? t('submission_wizard_track_complete')
                              : t('submission_wizard_track_incomplete')}
                          </Badge>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pb-4">
                        {index > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const prev = tracks[index - 1]
                              if (!prev) return
                              setTracks((rows) =>
                                rows.map((tr) =>
                                  tr.id === track.id
                                    ? {
                                        ...tr,
                                        values: copyTrackValues(
                                          prev.values,
                                          tr.values,
                                          COPYABLE_TRACK_KEYS.filter((k) =>
                                            visibleTrackFields.some((f) => f.fieldKey === k),
                                          ),
                                        ),
                                      }
                                    : tr,
                                ),
                              )
                              toast.success(t('submission_wizard_copy_prev_done'))
                            }}
                          >
                            {t('submission_wizard_copy_prev')}
                          </Button>
                        )}
                        {visibleTrackFields.map((field) => (
                          <div key={`${track.id}-${field.id}`} className="space-y-1">
                            <SchemaDrivenField
                              field={field}
                              locale={locale}
                              value={track.values[field.fieldKey] ?? ''}
                              onChange={(v) => setTrackValue(track.id, field.fieldKey, v)}
                              idPrefix={track.id}
                              error={fieldErrors[`${track.id}:${field.fieldKey}`]}
                            />
                            <button
                              type="button"
                              className="text-xs text-primary hover:underline"
                              onClick={() => {
                                setTracks((rows) =>
                                  applyFieldToAllTracks(
                                    rows,
                                    field.fieldKey,
                                    track.values[field.fieldKey] ?? (field.fieldType === 'boolean' ? 'false' : ''),
                                  ),
                                )
                                toast.success(t('submission_wizard_apply_all_done'))
                              }}
                            >
                              {t('submission_wizard_apply_all')}
                            </button>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            </div>
          )}

          {activeStep.kind === 'review' && (
            <div className="space-y-4">
              <div className="rounded-md border border-border p-4 space-y-2">
                <h3 className="text-sm font-semibold">{t('submission_wizard_review_summary')}</h3>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  {visibleReleaseFields.map((field) => {
                    const raw = values[field.fieldKey] ?? ''
                    if (!raw.trim() && field.fieldType !== 'boolean') return null
                    return (
                      <div key={field.id}>
                        <dt className="text-muted-foreground text-xs">
                          {getFieldLabel(field, locale)}
                        </dt>
                        <dd className="font-medium break-all">
                          {field.fieldType === 'boolean'
                            ? raw === 'true'
                              ? t('submission_wizard_yes')
                              : t('submission_wizard_no')
                            : raw}
                        </dd>
                      </div>
                    )
                  })}
                  {visibleTrackFields.length > 0 && (
                    <div>
                      <dt className="text-muted-foreground text-xs">{t('releases_submit_tracks_heading')}</dt>
                      <dd className="font-medium">
                        {t('submission_wizard_tracks_progress', {
                          done: String(tracksComplete),
                          total: String(tracks.length),
                        })}
                      </dd>
                    </div>
                  )}
                  {coverField && (
                    <div>
                      <dt className="text-muted-foreground text-xs">
                        {t('releases_submit_cover_check_heading')}
                      </dt>
                      <dd className="font-medium">
                        {coverArtVerified
                          ? t('submission_wizard_review_cover_ok')
                          : t('submission_wizard_review_cover_missing')}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {reviewIssues.length > 0 ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 space-y-2" role="alert">
                  <p className="text-sm font-medium text-destructive">
                    {t('submission_wizard_review_issues')}
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {reviewIssues.map((issue) => (
                      <li key={`${issue.stepId}-${issue.label}`}>
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => {
                            const idx = wizardSteps.findIndex((s) => s.id === issue.stepId)
                            if (idx >= 0) setActiveIndex(idx)
                          }}
                        >
                          {issue.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('submission_wizard_review_ready')}</p>
              )}
            </div>
          )}
        </SubmissionWizardShell>
      )}
    </div>
  )
}
