'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SchemaDrivenField } from '@/components/submissions/SchemaDrivenField'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { SubmissionFormField } from '@/types'

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
}

export function VideoSubmissionForm({ formSchema }: VideoSubmissionFormProps) {
  const t = useTranslations('portal')
  const locale = useLocale()
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>({
    youtube_category: '10',
  })
  const [submitting, setSubmitting] = useState(false)

  const visibleFields = useMemo(
    () => [...formSchema].filter((f) => f.isVisible).sort((a, b) => a.displayOrder - b.displayOrder),
    [formSchema],
  )

  const setFieldValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
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

      const res = await fetch('/api/portal/submit-video', {
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('video_submit_heading')}</h1>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{t('video_submit_heading')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => void submit(e)}>
            {visibleFields.map((field) => (
              <SchemaDrivenField
                key={field.id}
                field={field}
                locale={locale}
                value={values[field.fieldKey] ?? (field.fieldKey === 'youtube_category' ? '10' : '')}
                onChange={(v) => setFieldValue(field.fieldKey, v)}
              />
            ))}

            <Button type="submit" disabled={submitting || visibleFields.length === 0}>
              {submitting ? t('video_submit_saving') : t('video_submit_save')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}