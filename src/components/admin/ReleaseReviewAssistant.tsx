'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GuidedStepShell } from '@/components/guided/GuidedStepShell'
import type { GuidedStepDef } from '@/lib/guided/guidedSteps'
import type { ReleaseSubmission, SubmissionStatus } from '@/types'
import Link from 'next/link'

const STEPS: readonly GuidedStepDef[] = [
  { id: 'queue', label: 'Queue' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'decision', label: 'Decision' },
  { id: 'draft', label: 'Draft' },
]

const CHECK_KEYS = [
  'cover',
  'audio',
  'tracks',
  'date',
  'meta',
] as const

interface ReleaseReviewAssistantProps {
  submissions: ReleaseSubmission[]
  onPatchStatus: (
    id: string,
    status: SubmissionStatus,
    reply?: string,
  ) => Promise<ReleaseSubmission>
  onCreateDraft: (sub: ReleaseSubmission) => Promise<{ releaseId: string; created: boolean }>
  onOpenAdvanced: () => void
  onSelectSubmission?: (sub: ReleaseSubmission) => void
}

export function ReleaseReviewAssistant({
  submissions,
  onPatchStatus,
  onCreateDraft,
  onOpenAdvanced,
  onSelectSubmission,
}: ReleaseReviewAssistantProps) {
  const t = useTranslations('admin')
  const queue = useMemo(
    () => submissions.filter((s) => s.status === 'received'),
    [submissions],
  )
  const [stepId, setStepId] = useState('queue')
  const [maxReachable, setMaxReachable] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(queue[0]?.id ?? null)
  const selected = submissions.find((s) => s.id === selectedId) ?? null
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [decision, setDecision] = useState<SubmissionStatus>('accepted')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [draftReleaseId, setDraftReleaseId] = useState<string | null>(null)

  const stepIndex = STEPS.findIndex((s) => s.id === stepId)
  const rejectNeedsReply = decision === 'rejected' && !reply.trim()

  const stepComplete =
    stepId === 'queue'
      ? Boolean(selected)
      : stepId === 'checklist'
        ? true
        : stepId === 'decision'
          ? !rejectNeedsReply
          : true

  const blockedReason =
    stepId === 'queue' && !selected
      ? t('review_assistant_need_item')
      : stepId === 'decision' && rejectNeedsReply
        ? t('review_assistant_need_reply')
        : null

  const goNext = async () => {
    if (stepId === 'decision' && selected) {
      setBusy(true)
      try {
        await onPatchStatus(selected.id, decision, reply)
        toast.success(t('review_assistant_decision_saved'))
        setStepId('draft')
        setMaxReachable(3)
      } catch {
        toast.error(t('review_assistant_decision_failed'))
      } finally {
        setBusy(false)
      }
      return
    }
    if (stepId === 'draft') {
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
            s.id === 'queue'
              ? t('review_assistant_step_queue')
              : s.id === 'checklist'
                ? t('review_assistant_step_checklist')
                : s.id === 'decision'
                  ? t('review_assistant_step_decision')
                  : t('review_assistant_step_draft'),
        }))}
        activeStepId={stepId}
        onStepChange={setStepId}
        maxReachableIndex={maxReachable}
        coachTitle={t('review_assistant_coach_title')}
        coachBody={t('review_assistant_coach_body')}
        coachChecks={[
          {
            id: 'q',
            label: t('review_assistant_check_selected'),
            done: Boolean(selected),
          },
          {
            id: 'd',
            label: t('review_assistant_check_decision'),
            done: stepId === 'draft' || stepId === 'done',
          },
        ]}
        blockedReason={blockedReason}
        canContinue={stepComplete && !busy}
        onBack={() => {
          if (stepIndex > 0) setStepId(STEPS[stepIndex - 1]!.id)
        }}
        onNext={() => void goNext()}
        nextLabel={
          stepId === 'decision'
            ? t('review_assistant_save_decision')
            : stepId === 'draft'
              ? t('guided_switch_advanced')
              : t('guided_continue')
        }
        isLastStep={stepId === 'draft'}
        onSwitchToAdvanced={onOpenAdvanced}
        switchAdvancedLabel={t('guided_switch_advanced')}
        backLabel={t('guided_back')}
      >
        {stepId === 'queue' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('review_assistant_queue_count', { count: queue.length })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {queue.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('review_assistant_queue_empty')}</p>
              ) : (
                queue.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    className={`w-full rounded-md border p-3 text-left text-sm min-h-11 ${
                      selectedId === sub.id ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                    onClick={() => {
                      setSelectedId(sub.id)
                      setChecks({})
                      setDraftReleaseId(sub.releaseId ?? null)
                      onSelectSubmission?.(sub)
                    }}
                  >
                    <span className="font-medium">{sub.title}</span>
                    <span className="text-muted-foreground"> · {sub.artistName ?? sub.artistId}</span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {stepId === 'checklist' && selected && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{selected.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {selected.type ?? '—'} · {selected.releaseDate ?? '—'}
              </p>
              {CHECK_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`chk-${key}`}
                    checked={Boolean(checks[key])}
                    onCheckedChange={(c) =>
                      setChecks((prev) => ({ ...prev, [key]: c === true }))
                    }
                  />
                  <Label htmlFor={`chk-${key}`}>{t(`review_assistant_check_${key}`)}</Label>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{t('review_assistant_checklist_hint')}</p>
            </CardContent>
          </Card>
        )}

        {stepId === 'decision' && selected && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>{t('review_assistant_decision_label')}</Label>
                <Select
                  value={decision}
                  onValueChange={(v) => setDecision(v as SubmissionStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accepted">{t('review_assistant_accept')}</SelectItem>
                    <SelectItem value="reviewed">{t('review_assistant_reviewed')}</SelectItem>
                    <SelectItem value="rejected">{t('review_assistant_reject')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reply">{t('review_assistant_reply')}</Label>
                <Textarea
                  id="reply"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {stepId === 'draft' && selected && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm">{t('review_assistant_draft_body')}</p>
              {draftReleaseId || selected.releaseId ? (
                <Button asChild>
                  <Link href="/admin/releases">
                    {t('review_assistant_open_releases')}
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      try {
                        const result = await onCreateDraft(selected)
                        setDraftReleaseId(result.releaseId)
                        toast.success(t('review_assistant_draft_created'))
                      } catch {
                        toast.error(t('review_assistant_draft_failed'))
                      } finally {
                        setBusy(false)
                      }
                    })()
                  }}
                >
                  {t('review_assistant_create_draft')}
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onOpenAdvanced}>
                {t('guided_switch_advanced')}
              </Button>
            </CardContent>
          </Card>
        )}
      </GuidedStepShell>
    </div>
  )
}
