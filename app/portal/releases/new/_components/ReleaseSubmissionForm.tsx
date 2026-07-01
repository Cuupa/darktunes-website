'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import type { SubmissionReleaseType } from '@/lib/submissions/fieldTypes'
import type { Artist, SubmissionFormField, SubmissionReleaseTypeRule } from '@/types'

interface ReleaseSubmissionFormProps {
  artist: Artist | null
  formSchema: SubmissionFormField[]
  typeRules: SubmissionReleaseTypeRule[]
}

interface TrackRow {
  id: string
  values: Record<string, string>
}

function emptyTrackValues(trackFields: SubmissionFormField[]): Record<string, string> {
  const values: Record<string, string> = {}
  for (const f of trackFields) {
    values[f.fieldKey] = f.fieldType === 'boolean' ? 'false' : ''
  }
  return values
}

function buildTrackRows(count: number, trackFields: SubmissionFormField[], existing: TrackRow[]): TrackRow[] {
  const rows: TrackRow[] = []
  for (let i = 0; i < count; i += 1) {
    const prev = existing[i]
    rows.push({
      id: prev?.id ?? `track-${i + 1}`,
      values: prev?.values ?? emptyTrackValues(trackFields),
    })
  }
  return rows
}

export function ReleaseSubmissionForm({ artist, formSchema, typeRules }: ReleaseSubmissionFormProps) {
  const t = useTranslations('portal')
  const locale = useLocale()
  const router = useRouter()

  const releaseFields = useMemo(
    () => formSchema.filter((f) => f.fieldScope === 'release').sort((a, b) => a.displayOrder - b.displayOrder),
    [formSchema],
  )
  const allTrackFields = useMemo(
    () => formSchema.filter((f) => f.fieldScope === 'track').sort((a, b) => a.displayOrder - b.displayOrder),
    [formSchema],
  )

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = { type: 'single' }
    if (artist?.name) init.artist_name = artist.name
    if (artist?.genres?.[0]) init.genre = artist.genres[0]
    if (artist?.spotifyUrl) init.spotify_url = artist.spotifyUrl
    if (artist?.appleMusicUrl) init.apple_music_url = artist.appleMusicUrl
    if (artist?.youtubeUrl) init.youtube_url = artist.youtubeUrl
    if (artist?.name) init.title = artist.name
    for (const f of formSchema) {
      if (init[f.fieldKey] === undefined) {
        init[f.fieldKey] = f.fieldType === 'boolean' ? 'false' : ''
      }
    }
    return init
  })

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
    buildTrackRows(1, filterFieldsForType(allTrackFields, 'single', { type: 'single' }), []),
  )
  const [coverArtVerified, setCoverArtVerified] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const rule = getTypeRuleForRelease(typeRules, releaseType)
    const nextCount = rule?.trackCountMode === 'fixed_1' ? 1 : (rule?.minTracks ?? 2)
    setTrackCount(nextCount)
  }, [releaseType, typeRules])

  useEffect(() => {
    const count = userSpecifiedTracks ? trackCount : 1
    setTracks((prev) => buildTrackRows(count, visibleTrackFields, prev))
  }, [trackCount, userSpecifiedTracks, visibleTrackFields])

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
    if (trackCountError) {
      errors.track_count = trackCountError
    }

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

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!coverArtVerified) {
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error(t('releases_submit_error'))
        return
      }

      const standardBody: Record<string, unknown> = {
        coverArtVerified,
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
        const err = await res.json().catch(() => ({})) as { error?: string }
        toast.error(err.error ?? t('releases_submit_error'))
        return
      }

      toast.success(t('releases_submit_success'))
      router.push('/portal/releases/submissions')
      router.refresh()
    } catch {
      toast.error(t('releases_submit_error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('releases_submit_heading')}</h1>
      <p className="text-sm text-muted-foreground">{t('releases_submit_pending_notice')}</p>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{t('releases_submit_heading')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => void submit(e)}>
            {visibleReleaseFields.map((field) => (
              <div key={field.id}>
                {field.fieldKey === 'cover_art_url' ? (
                  <div className="space-y-2">
                    <SchemaDrivenField
                      field={field}
                      locale={locale}
                      value={values[field.fieldKey] ?? ''}
                      onChange={(v) => setFieldValue(field.fieldKey, v)}
                      error={fieldErrors[field.fieldKey]}
                    />
                    <CoverArtAnalyzer
                      url={values.cover_art_url ?? ''}
                      onVerified={handleCoverArtVerified}
                    />
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
            ))}

            {userSpecifiedTracks && visibleTrackFields.length > 0 && (
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

            {visibleTrackFields.length > 0 && (
              <div className="space-y-4 border-t border-border pt-4">
                <h2 className="text-lg font-semibold">{t('releases_submit_tracks_heading')}</h2>
                {tracks.map((track, index) => (
                  <div key={track.id} className="rounded-md border border-border p-4 space-y-3">
                    <p className="text-sm font-medium">{t('releases_submit_track_label', { n: index + 1 })}</p>
                    {visibleTrackFields.map((field) => (
                      <SchemaDrivenField
                        key={`${track.id}-${field.id}`}
                        field={field}
                        locale={locale}
                        value={track.values[field.fieldKey] ?? ''}
                        onChange={(v) => setTrackValue(track.id, field.fieldKey, v)}
                        idPrefix={track.id}
                        error={fieldErrors[`${track.id}:${field.fieldKey}`]}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting || !coverArtVerified}
              title={!coverArtVerified ? t('releases_submit_cover_check_required') : undefined}
            >
              {submitting ? t('releases_submit_saving') : t('releases_submit_save')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}