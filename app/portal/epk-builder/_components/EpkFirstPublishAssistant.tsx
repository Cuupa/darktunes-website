'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GuidedStepShell } from '@/components/guided/GuidedStepShell'
import type { GuidedStepDef } from '@/lib/guided/guidedSteps'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useEpkEditorStore } from '@/lib/epk/editor/EpkEditorProvider'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { cn } from '@/lib/utils'

const STEPS: readonly GuidedStepDef[] = [
  { id: 'template', label: 'Template' },
  { id: 'export', label: 'Share' },
  { id: 'done', label: 'Done' },
]

type EpkTemplateListItem = {
  id: string
  name: string
  description?: string
  document: EpkDocumentV2
}

interface EpkFirstPublishAssistantProps {
  artistId: string
  onApplyTemplate: (document: EpkDocumentV2) => void
  onExportPdf: () => Promise<void>
  onOpenAdvanced: () => void
  exporting: boolean
}

export function EpkFirstPublishAssistant({
  artistId,
  onApplyTemplate,
  onExportPdf,
  onOpenAdvanced,
  exporting,
}: EpkFirstPublishAssistantProps) {
  const t = useTranslations('portal')
  const document = useEpkEditorStore((s) => s.document)
  const [stepId, setStepId] = useState('template')
  const [maxReachable, setMaxReachable] = useState(0)
  const [templates, setTemplates] = useState<EpkTemplateListItem[]>([])
  const [picked, setPicked] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [exported, setExported] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch('/api/portal/epk/templates', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const data = (await res.json()) as { templates?: EpkTemplateListItem[] }
        if (!cancelled) setTemplates(data.templates ?? [])
      } finally {
        if (!cancelled) setLoadingTemplates(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const pageCount = document.pages?.length ?? 0
  const hasContent = pageCount > 0

  const stepComplete =
    stepId === 'template'
      ? picked || hasContent
      : stepId === 'export'
        ? exported || Boolean(shareUrl) || true // allow skip to advanced
        : true

  const stepIndex = STEPS.findIndex((s) => s.id === stepId)

  const createShare = async () => {
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error(t('profile_error'))
      const res = await fetch('/api/portal/epk/share', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ artist_id: artistId, label: 'Press kit' }),
      })
      const json = (await res.json().catch(() => null)) as {
        error?: string
        link?: { token?: string; id?: string; path?: string; url?: string }
      } | null
      if (!res.ok) throw new Error(json?.error ?? t('epk_share_error'))
      const link = json?.link
      const url =
        link?.url ??
        (link?.token ? `/epk/share/${link.token}` : null) ??
        link?.path ??
        null
      setShareUrl(url)
      toast.success(t('epk_assistant_share_created'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('epk_share_error'))
    }
  }

  const goNext = async () => {
    if (stepId === 'done') {
      onOpenAdvanced()
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
              ? t('epk_assistant_step_template')
              : s.id === 'export'
                ? t('epk_assistant_step_export')
                : t('epk_assistant_step_done'),
        }))}
        activeStepId={stepId}
        onStepChange={setStepId}
        maxReachableIndex={maxReachable}
        coachTitle={
          stepId === 'template'
            ? t('epk_assistant_coach_template_title')
            : stepId === 'export'
              ? t('epk_assistant_coach_export_title')
              : t('epk_assistant_coach_done_title')
        }
        coachBody={
          stepId === 'template'
            ? t('epk_assistant_coach_template_body')
            : stepId === 'export'
              ? t('epk_assistant_coach_export_body')
              : t('epk_assistant_coach_done_body')
        }
        coachChecks={[
          { id: 'tpl', label: t('epk_assistant_check_template'), done: picked || hasContent },
          {
            id: 'out',
            label: t('epk_assistant_check_output'),
            done: exported || Boolean(shareUrl),
          },
        ]}
        canContinue={stepComplete && !exporting}
        onBack={() => {
          if (stepIndex > 0) setStepId(STEPS[stepIndex - 1]!.id)
        }}
        onNext={() => void goNext()}
        nextLabel={stepId === 'done' ? t('epk_assistant_open_editor') : t('guided_continue')}
        isLastStep={stepId === 'done'}
        onSwitchToAdvanced={onOpenAdvanced}
        switchAdvancedLabel={t('guided_switch_advanced')}
        backLabel={t('guided_back')}
      >
        {stepId === 'template' && (
          <div className="space-y-3">
            {loadingTemplates && (
              <p className="text-sm text-muted-foreground">{t('profile_saving')}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className={cn(
                    'rounded-lg border p-4 text-left min-h-11',
                    'border-border hover:bg-muted/40',
                  )}
                  onClick={() => {
                    onApplyTemplate(tpl.document)
                    setPicked(true)
                    toast.success(t('epk_assistant_template_applied'))
                  }}
                >
                  <p className="text-sm font-semibold">{tpl.name}</p>
                  {tpl.description ? (
                    <p className="text-xs text-muted-foreground mt-1">{tpl.description}</p>
                  ) : null}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPicked(true)
                toast.message(t('epk_assistant_keep_current'))
              }}
            >
              {t('epk_assistant_keep_current')}
            </Button>
          </div>
        )}

        {stepId === 'export' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('epk_assistant_step_export')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={exporting}
                onClick={() => {
                  void onExportPdf().then(() => setExported(true))
                }}
              >
                {t('epk_assistant_download_pdf')}
              </Button>
              <Button type="button" variant="outline" onClick={() => void createShare()}>
                {t('epk_assistant_create_share')}
              </Button>
              {shareUrl ? (
                <p className="text-xs text-muted-foreground w-full break-all">{shareUrl}</p>
              ) : null}
            </CardContent>
          </Card>
        )}

        {stepId === 'done' && (
          <Card>
            <CardContent className="pt-6 space-y-3 text-sm">
              <p>{t('epk_assistant_done_body')}</p>
              <Button type="button" onClick={onOpenAdvanced}>
                {t('epk_assistant_open_editor')}
              </Button>
            </CardContent>
          </Card>
        )}
      </GuidedStepShell>
    </div>
  )
}
