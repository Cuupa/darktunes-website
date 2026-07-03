'use client'

/**
 * src/components/messaging/MessageRulesManager.tsx
 *
 * Dialog for managing inbox automation rules.
 * Each rule has: name, condition (field/operator/value), action (type/target).
 */

import { useCallback, useState } from 'react'
import { Plus, Trash, ToggleLeft, ToggleRight, Warning } from '@phosphor-icons/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { MessageFolder, MessageRule } from '@/types'

interface MessageRulesManagerProps {
  rules: MessageRule[]
  folders: MessageFolder[]
  onCreate: (rule: Omit<MessageRule, 'id' | 'createdAt'>) => Promise<void>
  onToggle: (id: string, active: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const CONDITION_FIELDS: Array<{ value: MessageRule['conditionField']; label: string }> = [
  { value: 'subject',      label: 'Subject' },
  { value: 'body',         label: 'Body' },
  { value: 'artist_id',   label: 'Artist ID' },
  { value: 'sender_email', label: 'Sender Email' },
]

const CONDITION_OPS: Array<{ value: MessageRule['conditionOperator']; label: string }> = [
  { value: 'contains',    label: 'contains' },
  { value: 'equals',      label: 'equals' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with',   label: 'ends with' },
]

const ACTION_TYPES: Array<{ value: MessageRule['actionType']; label: string }> = [
  { value: 'move_to_folder', label: 'Move to folder' },
  { value: 'mark_read',      label: 'Mark as read' },
  { value: 'star',           label: 'Star message' },
  { value: 'delete',         label: 'Delete message' },
]

const EMPTY_RULE: Omit<MessageRule, 'id' | 'createdAt'> = {
  name: '',
  conditionField: 'subject',
  conditionOperator: 'contains',
  conditionValue: '',
  actionType: 'move_to_folder',
  actionTarget: '',
  active: true,
}

export function MessageRulesManager({
  rules,
  folders,
  onCreate,
  onToggle,
  onDelete,
}: MessageRulesManagerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Omit<MessageRule, 'id' | 'createdAt'>>(EMPTY_RULE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = useCallback(async () => {
    if (!draft.name.trim()) { setError('Rule name is required.'); return }
    if (!draft.conditionValue.trim()) { setError('Condition value is required.'); return }
    if (draft.actionType === 'move_to_folder' && !draft.actionTarget) {
      setError('Please select a target folder.'); return
    }
    setSaving(true)
    setError('')
    try {
      await onCreate(draft)
      setDraft(EMPTY_RULE)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create rule')
    } finally {
      setSaving(false)
    }
  }, [draft, onCreate])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ToggleRight size={16} aria-hidden="true" />
          Rules
        </Button>
      </DialogTrigger>
      <DialogContent data-lenis-prevent className="max-w-2xl max-h-[80vh] overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
        <DialogHeader>
          <DialogTitle>Inbox Rules</DialogTitle>
        </DialogHeader>

        {/* Existing rules */}
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No rules yet. Create one below.</p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2.5 text-sm"
              >
                <Switch
                  checked={rule.active}
                  onCheckedChange={(v) => void onToggle(rule.id, v)}
                  aria-label={`Toggle rule "${rule.name}"`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    If <span className="text-foreground">{rule.conditionField}</span>{' '}
                    <span className="text-foreground">{rule.conditionOperator}</span>{' '}
                    &ldquo;<span className="text-foreground">{rule.conditionValue}</span>&rdquo;
                    → <span className="text-foreground">{rule.actionType.replace(/_/g, ' ')}</span>
                    {rule.actionTarget ? ` "${folders.find((f) => f.id === rule.actionTarget)?.name ?? rule.actionTarget}"` : ''}
                  </p>
                </div>
                {!rule.active && (
                  <ToggleLeft size={14} className="text-muted-foreground shrink-0" aria-hidden="true" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => void onDelete(rule.id)}
                  title={`Delete rule "${rule.name}"`}
                >
                  <Trash size={14} aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* New rule form */}
        <div className="mt-4 space-y-3 rounded-lg border border-dashed border-border p-4">
          <p className="text-sm font-semibold">New Rule</p>

          <div className="space-y-1">
            <Label htmlFor="rule-name" className="text-xs">Rule name</Label>
            <Input
              id="rule-name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Move promo to folder"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Field</Label>
              <select
                value={draft.conditionField}
                onChange={(e) => setDraft((d) => ({ ...d, conditionField: e.target.value as MessageRule['conditionField'] }))}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CONDITION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Operator</Label>
              <select
                value={draft.conditionOperator}
                onChange={(e) => setDraft((d) => ({ ...d, conditionOperator: e.target.value as MessageRule['conditionOperator'] }))}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CONDITION_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Value</Label>
              <Input
                value={draft.conditionValue}
                onChange={(e) => setDraft((d) => ({ ...d, conditionValue: e.target.value }))}
                placeholder="e.g. promo"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Action</Label>
              <select
                value={draft.actionType}
                onChange={(e) => setDraft((d) => ({ ...d, actionType: e.target.value as MessageRule['actionType'], actionTarget: '' }))}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            {draft.actionType === 'move_to_folder' && (
              <div className="space-y-1">
                <Label className="text-xs">Target folder</Label>
                <select
                  value={draft.actionTarget ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, actionTarget: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— select folder —</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-yellow-400">
              <Warning size={14} aria-hidden="true" /> {error}
            </p>
          )}

          <Button onClick={() => void handleCreate()} disabled={saving} size="sm" className="gap-1.5">
            <Plus size={14} aria-hidden="true" />
            {saving ? 'Creating…' : 'Create Rule'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
