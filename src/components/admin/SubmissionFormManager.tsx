'use client'

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AdminListShell } from '@/components/admin/AdminListShell'
import { SubmissionFieldToggles } from '@/components/admin/submission-form/SubmissionFieldToggles'
import { toast } from 'sonner'
import { routing } from '@/i18n/routing'
import { fieldToApiPayload } from '@/lib/api/submissionFormSchema'
import { fieldKeyFromLabel, uniqueFieldKey } from '@/lib/submissions/fieldKey'
import { MUSIC_FIELD_PRESETS } from '@/lib/submissions/musicFieldPresets'
import {
  SUBMISSION_FIELD_TYPES,
  SUBMISSION_RELEASE_TYPES,
  type SubmissionReleaseType,
} from '@/lib/submissions/fieldTypes'
import { mergeTypeRules } from '@/lib/submissions/fieldTypeRules'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { SubmissionFormField, SubmissionReleaseTypeRule } from '@/types'

type FormType = 'release' | 'video'

const COPY = {
  releaseTab: 'Release Form',
  videoTab: 'Video Form',
  fieldsSubTab: 'Form Fields',
  trackRulesSubTab: 'Track Limits',
  fieldRulesSubTab: 'Per-Type Rules',
  fieldsHint: 'Define which fields artists see when submitting a release or video. Click badges to toggle visibility and required status.',
  trackRulesHint: 'Set minimum and maximum track counts per release type. Singles are always fixed at 1 track.',
  fieldRulesHint: 'Override visibility and required status per release type. Unset values fall back to the global settings in Form Fields.',
  fieldRulesScrollHint: 'Swipe to see all release types',
  labelLanguage: 'Label language',
  fieldKey: 'Field key',
  fieldLabel: 'Label',
  fieldType: 'Type',
  fieldScope: 'Scope',
  scopeRelease: 'Release',
  scopeTrack: 'Track',
  status: 'Status',
  order: 'Order',
  actions: 'Actions',
  releaseType: 'Release type',
  trackCountMode: 'Track count mode',
  minTracks: 'Min tracks',
  maxTracks: 'Max tracks',
  trackCountFixed: 'Fixed at 1 track',
  trackCountUser: 'Artist enters track count',
  fieldAdd: 'Add Field',
  fieldAddPreset: 'Add music preset…',
  fieldNew: 'New Field',
  fieldSave: 'Save',
  fieldDelete: 'Delete',
  fieldSaved: 'Field saved',
  fieldDeleted: 'Field deleted',
  fieldDeleteConfirmTitle: 'Delete Field',
  fieldDeleteConfirmBody: 'Are you sure you want to delete this field? This action cannot be undone.',
  loadError: 'Failed to load form schema',
  saveError: 'Failed to save field',
  deleteError: 'Failed to delete field',
  labelRequired: 'Enter at least one label',
  loading: 'Loading…',
  saving: 'Saving…',
  cancel: 'Cancel',
  moveUp: 'Move up',
  moveDown: 'Move down',
  typeRulesSaved: 'Track rules saved',
  typeRulesLoadError: 'Failed to load track rules',
  typeRulesSaveError: 'Failed to save track rules',
} as const

const EMPTY_LABELS = Object.fromEntries(routing.locales.map((l) => [l, '']))

async function parseApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; message?: string }
    return data.error ?? data.message ?? `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

function SubmissionFormTableScroll({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-x-auto overscroll-contain touch-pan-x touch-pan-y [-webkit-overflow-scrolling:touch]',
        className,
      )}
      data-lenis-prevent
    >
      {children}
    </div>
  )
}

interface SubmissionFormManagerProps {
  variant?: 'page' | 'embedded'
}

export function SubmissionFormManager({ variant = 'page' }: SubmissionFormManagerProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const [formType, setFormType] = useState<FormType>('release')
  const [fields, setFields] = useState<SubmissionFormField[]>([])
  const [typeRules, setTypeRules] = useState<SubmissionReleaseTypeRule[]>([])
  const [releaseSubTab, setReleaseSubTab] = useState<'fields' | 'track_rules' | 'field_rules'>('fields')
  const [loading, setLoading] = useState(true)
  const [loadingTypeRules, setLoadingTypeRules] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [labelLocale, setLabelLocale] = useState('en')
  const [newField, setNewField] = useState<Partial<SubmissionFormField>>({
    fieldType: 'text',
    fieldScope: 'release',
    fieldLabels: { ...EMPTY_LABELS },
    isRequired: false,
    isVisible: true,
  })

  const existingKeys = useMemo(() => new Set(fields.map((f) => f.fieldKey)), [fields])
  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => a.displayOrder - b.displayOrder),
    [fields],
  )

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')
    return session.access_token
  }, [supabase])

  const fetchFields = useCallback(async (type: FormType) => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/submission-form-schema?type=' + type, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(await parseApiError(res))
      const data = (await res.json()) as SubmissionFormField[]
      setFields(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : COPY.loadError)
    } finally {
      setLoading(false)
    }
  }, [getToken])

  const fetchTypeRules = useCallback(async () => {
    setLoadingTypeRules(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/submission-release-type-rules', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(await parseApiError(res))
      const data = (await res.json()) as SubmissionReleaseTypeRule[]
      setTypeRules(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : COPY.typeRulesLoadError)
    } finally {
      setLoadingTypeRules(false)
    }
  }, [getToken])

  useEffect(() => {
    void fetchFields(formType)
    if (formType === 'release') void fetchTypeRules()
  }, [fetchFields, fetchTypeRules, formType])

  const saveTypeRule = async (rule: SubmissionReleaseTypeRule) => {
    setSaving(rule.id)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/submission-release-type-rules', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: rule.id,
          release_type: rule.releaseType,
          track_count_mode: rule.trackCountMode,
          min_tracks: rule.minTracks,
          max_tracks: rule.maxTracks,
          display_order: rule.displayOrder,
        }),
      })
      if (!res.ok) throw new Error(await parseApiError(res))
      toast.success(COPY.typeRulesSaved)
      await fetchTypeRules()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : COPY.typeRulesSaveError)
    } finally {
      setSaving(null)
    }
  }

  const updateFieldTypeRule = (
    field: SubmissionFormField,
    releaseType: SubmissionReleaseType,
    patch: { visible?: boolean; required?: boolean },
  ) => {
    const nextRules = mergeTypeRules(field.typeRules, releaseType, patch)
    void saveField({ ...field, typeRules: nextRules })
  }

  const saveField = async (field: Partial<SubmissionFormField>) => {
    setSaving(field.id ?? 'new')
    try {
      const token = await getToken()
      const payload = fieldToApiPayload(field, formType)
      const res = await fetch('/api/admin/submission-form-schema', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await parseApiError(res))
      toast.success(COPY.fieldSaved)
      setAddingNew(false)
      setNewField({
        fieldType: 'text',
        fieldScope: 'release',
        fieldLabels: { ...EMPTY_LABELS },
        isRequired: false,
        isVisible: true,
      })
      await fetchFields(formType)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : COPY.saveError)
    } finally {
      setSaving(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const id = deleteTarget
    setDeleteTarget(null)
    setSaving(id)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/submission-form-schema/' + id, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(await parseApiError(res))
      toast.success(COPY.fieldDeleted)
      await fetchFields(formType)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : COPY.deleteError)
    } finally {
      setSaving(null)
    }
  }

  const updateField = (field: SubmissionFormField, patch: Partial<SubmissionFormField>) => {
    void saveField({ ...field, ...patch })
  }

  const moveField = (field: SubmissionFormField, direction: -1 | 1) => {
    const sorted = [...fields].sort((a, b) => a.displayOrder - b.displayOrder)
    const idx = sorted.findIndex((f) => f.id === field.id)
    const swap = sorted[idx + direction]
    if (!swap) return
    void saveField({ ...field, displayOrder: swap.displayOrder })
    void saveField({ ...swap, displayOrder: field.displayOrder })
  }

  const addPreset = (presetId: string) => {
    const preset = MUSIC_FIELD_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    const key = uniqueFieldKey(preset.fieldKey, existingKeys)
    setNewField({
      fieldKey: key,
      fieldLabels: preset.fieldLabels,
      fieldType: preset.fieldType,
      fieldScope: preset.fieldScope,
      fieldGroup: preset.fieldGroup,
      placeholders: preset.placeholders ?? null,
      isRequired: preset.isRequired ?? false,
      isVisible: true,
      displayOrder: (fields.length + 1) * 10,
    })
    setAddingNew(true)
  }

  const primaryLabel = (labels: Record<string, string>) =>
    labels.en || labels[routing.defaultLocale] || Object.values(labels).find(Boolean) || ''

  const autoKeyForNew = () => {
    const label = primaryLabel(newField.fieldLabels ?? {})
    if (!label) return ''
    return uniqueFieldKey(fieldKeyFromLabel(label), existingKeys)
  }

  const activeHint =
    formType === 'release' && releaseSubTab === 'track_rules'
      ? COPY.trackRulesHint
      : formType === 'release' && releaseSubTab === 'field_rules'
        ? COPY.fieldRulesHint
        : COPY.fieldsHint

  const showFieldsPanel = formType !== 'release' || releaseSubTab === 'fields'
  const showTrackRulesPanel = formType === 'release' && releaseSubTab === 'track_rules'
  const showFieldRulesPanel = formType === 'release' && releaseSubTab === 'field_rules'

  const localeToolbar = showFieldsPanel && !loading ? (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{COPY.labelLanguage}:</span>
      {routing.locales.map((loc) => (
        <Button
          key={loc}
          type="button"
          size="sm"
          variant={labelLocale === loc ? 'default' : 'outline'}
          className="h-8 min-h-[44px] text-xs uppercase"
          onClick={() => setLabelLocale(loc)}
        >
          {loc}
        </Button>
      ))}
    </div>
  ) : null

  const addFieldToolbar = showFieldsPanel && !addingNew && !loading ? (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => setAddingNew(true)}>
        {COPY.fieldAdd}
      </Button>
      {formType === 'release' && (
        <select
          className="h-9 min-h-[44px] rounded-md border border-input bg-background px-2 text-sm"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) addPreset(e.target.value)
            e.target.value = ''
          }}
          aria-label={COPY.fieldAddPreset}
        >
          <option value="">{COPY.fieldAddPreset}</option>
          {MUSIC_FIELD_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fieldLabels.en ?? p.id} ({p.fieldScope})
            </option>
          ))}
        </select>
      )}
    </div>
  ) : null

  const renderFieldsTable = () => {
    if (loading) return <p className="text-muted-foreground p-4">{COPY.loading}</p>

    return (
      <div className="space-y-4 p-4">
        <SubmissionFormTableScroll>
          <Table className="min-w-max w-full">
            <TableHeader className="sticky top-0 z-10 border-b border-border bg-card">
              <TableRow className="bg-card hover:bg-card">
                <TableHead className="bg-card">{COPY.fieldLabel}</TableHead>
                <TableHead className="bg-card">{COPY.fieldType}</TableHead>
                {formType === 'release' && <TableHead className="bg-card">{COPY.fieldScope}</TableHead>}
                <TableHead className="bg-card">{COPY.status}</TableHead>
                <TableHead className="bg-card">{COPY.order}</TableHead>
                <TableHead className="bg-card">{COPY.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFields.map((field) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <div className="space-y-1 min-w-[10rem]">
                      <Input
                        className="h-8 text-sm"
                        defaultValue={field.fieldLabels[labelLocale] ?? ''}
                        onBlur={(e) => {
                          const next = e.target.value
                          if (next === (field.fieldLabels[labelLocale] ?? '')) return
                          updateField(field, {
                            fieldLabels: { ...field.fieldLabels, [labelLocale]: next },
                          })
                        }}
                        aria-label={`${COPY.fieldLabel} ${field.fieldKey}`}
                      />
                      <p className="font-mono text-[10px] text-muted-foreground">{field.fieldKey}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{field.fieldType}</Badge>
                  </TableCell>
                  {formType === 'release' && (
                    <TableCell>
                      <Badge variant="secondary">
                        {field.fieldScope === 'track' ? COPY.scopeTrack : COPY.scopeRelease}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell>
                    <SubmissionFieldToggles
                      visible={field.isVisible}
                      required={field.isRequired}
                      onVisibleChange={(visible) => updateField(field, { isVisible: visible, ...(!visible ? { isRequired: false } : {}) })}
                      onRequiredChange={(required) => updateField(field, { isRequired: required })}
                      fieldKey={field.fieldKey}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-8 min-h-[44px] min-w-[44px] px-2" onClick={() => moveField(field, -1)} aria-label={COPY.moveUp}>↑</Button>
                      <Button variant="outline" size="sm" className="h-8 min-h-[44px] min-w-[44px] px-2" onClick={() => moveField(field, 1)} aria-label={COPY.moveDown}>↓</Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 min-h-[44px]"
                      disabled={saving === field.id}
                      onClick={() => setDeleteTarget(field.id)}
                    >
                      {COPY.fieldDelete}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SubmissionFormTableScroll>

        {addingNew && (
          <div className="border border-border rounded-md p-4 space-y-4">
            <p className="text-sm font-medium">{COPY.fieldNew}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{COPY.fieldKey}</Label>
                <Input className="h-8 text-xs font-mono" readOnly value={newField.fieldKey ?? autoKeyForNew()} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{COPY.fieldType}</Label>
                <select
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  value={newField.fieldType ?? 'text'}
                  onChange={(e) =>
                    setNewField((p) => ({
                      ...p,
                      fieldType: e.target.value as SubmissionFormField['fieldType'],
                    }))
                  }
                >
                  {SUBMISSION_FIELD_TYPES.map((ft) => (
                    <option key={ft} value={ft}>{ft}</option>
                  ))}
                </select>
              </div>
              {formType === 'release' && (
                <div className="space-y-1">
                  <Label className="text-xs">{COPY.fieldScope}</Label>
                  <select
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    value={newField.fieldScope ?? 'release'}
                    onChange={(e) =>
                      setNewField((p) => ({
                        ...p,
                        fieldScope: e.target.value as SubmissionFormField['fieldScope'],
                      }))
                    }
                  >
                    <option value="release">{COPY.scopeRelease}</option>
                    <option value="track">{COPY.scopeTrack}</option>
                  </select>
                </div>
              )}
              {routing.locales.map((loc) => (
                <div key={loc} className="space-y-1">
                  <Label className="text-xs">{COPY.fieldLabel} ({loc.toUpperCase()})</Label>
                  <Input
                    className="h-8 text-xs"
                    value={newField.fieldLabels?.[loc] ?? ''}
                    onChange={(e) =>
                      setNewField((p) => ({
                        ...p,
                        fieldLabels: { ...(p.fieldLabels ?? EMPTY_LABELS), [loc]: e.target.value },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            <SubmissionFieldToggles
              visible={newField.isVisible ?? true}
              required={newField.isRequired ?? false}
              onVisibleChange={(visible) =>
                setNewField((p) => ({ ...p, isVisible: visible, ...(!visible ? { isRequired: false } : {}) }))
              }
              onRequiredChange={(required) => setNewField((p) => ({ ...p, isRequired: required }))}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="min-h-[44px]"
                disabled={saving === 'new'}
                onClick={() => {
                  const labels = newField.fieldLabels ?? EMPTY_LABELS
                  const key = newField.fieldKey ?? autoKeyForNew()
                  if (!key || !primaryLabel(labels)) {
                    toast.error(COPY.labelRequired)
                    return
                  }
                  void saveField({
                    ...newField,
                    fieldKey: key,
                    fieldLabels: labels,
                    displayOrder: newField.displayOrder ?? (fields.length + 1) * 10,
                  })
                }}
              >
                {saving === 'new' ? COPY.saving : COPY.fieldSave}
              </Button>
              <Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => setAddingNew(false)}>
                {COPY.cancel}
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderTrackRulesTable = () => {
    if (loadingTypeRules) return <p className="text-muted-foreground p-4">{COPY.loading}</p>

    return (
      <div className="p-4">
        <SubmissionFormTableScroll>
          <Table className="min-w-max w-full">
            <TableHeader className="sticky top-0 z-10 border-b border-border bg-card">
              <TableRow className="bg-card hover:bg-card">
                <TableHead className="bg-card">{COPY.releaseType}</TableHead>
                <TableHead className="bg-card">{COPY.trackCountMode}</TableHead>
                <TableHead className="bg-card">{COPY.minTracks}</TableHead>
                <TableHead className="bg-card">{COPY.maxTracks}</TableHead>
                <TableHead className="bg-card">{COPY.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {typeRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-mono text-xs capitalize">{rule.releaseType}</TableCell>
                  <TableCell className="text-xs">{rule.trackCountMode}</TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-xs w-20"
                      type="number"
                      min={1}
                      defaultValue={rule.minTracks}
                      disabled={rule.trackCountMode === 'fixed_1'}
                      onBlur={(e) => {
                        const minTracks = Number(e.target.value)
                        if (Number.isNaN(minTracks) || minTracks === rule.minTracks) return
                        void saveTypeRule({ ...rule, minTracks })
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-xs w-20"
                      type="number"
                      min={rule.minTracks}
                      defaultValue={rule.maxTracks}
                      disabled={rule.trackCountMode === 'fixed_1'}
                      onBlur={(e) => {
                        const maxTracks = Number(e.target.value)
                        if (Number.isNaN(maxTracks) || maxTracks === rule.maxTracks) return
                        void saveTypeRule({ ...rule, maxTracks })
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {rule.trackCountMode === 'fixed_1' ? COPY.trackCountFixed : COPY.trackCountUser}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SubmissionFormTableScroll>
      </div>
    )
  }

  const renderFieldRulesTable = () => {
    if (loading) return <p className="text-muted-foreground p-4">{COPY.loading}</p>

    return (
      <div className="space-y-2 p-4">
        <p className="text-xs text-muted-foreground md:hidden">{COPY.fieldRulesScrollHint}</p>
        <SubmissionFormTableScroll>
          <Table className="min-w-max w-full">
            <TableHeader className="sticky top-0 z-10 border-b border-border bg-card">
              <TableRow className="bg-card hover:bg-card">
                <TableHead className="sticky left-0 z-20 bg-card min-w-[10rem]">{COPY.fieldLabel}</TableHead>
                <TableHead className="bg-card">{COPY.fieldScope}</TableHead>
                {SUBMISSION_RELEASE_TYPES.map((rt) => (
                  <TableHead key={rt} className="bg-card text-center capitalize min-w-[9rem]">{rt}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFields.map((field) => (
                <TableRow key={field.id}>
                  <TableCell className="sticky left-0 z-10 bg-card">
                    <div className="min-w-[10rem]">
                      <p className="text-sm">{primaryLabel(field.fieldLabels)}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{field.fieldKey}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{field.fieldScope}</Badge>
                  </TableCell>
                  {SUBMISSION_RELEASE_TYPES.map((rt) => {
                    const rule = field.typeRules?.[rt]
                    const visible = rule?.visible ?? field.isVisible
                    const required = rule?.required ?? field.isRequired
                    return (
                      <TableCell key={rt}>
                        <SubmissionFieldToggles
                          visible={visible}
                          required={required}
                          onVisibleChange={(v) => updateFieldTypeRule(field, rt, { visible: v })}
                          onRequiredChange={(r) => updateFieldTypeRule(field, rt, { required: r })}
                          fieldKey={field.fieldKey}
                          releaseType={rt}
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SubmissionFormTableScroll>
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', variant === 'embedded' && 'min-h-[min(60dvh,32rem)]')}>
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{COPY.fieldDeleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{COPY.fieldDeleteConfirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{COPY.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {COPY.fieldDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs value={formType} onValueChange={(v) => setFormType(v as FormType)} className="flex min-h-0 flex-1 flex-col">
        <AdminListShell
          tableContainerClassName={variant === 'embedded' ? 'min-h-[min(50dvh,28rem)]' : undefined}
          header={
            <div className="space-y-3">
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="release" className="min-h-[44px]">{COPY.releaseTab}</TabsTrigger>
                <TabsTrigger value="video" className="min-h-[44px]">{COPY.videoTab}</TabsTrigger>
              </TabsList>

              <TabsContent value="release" className="mt-0 space-y-3">
                <Tabs value={releaseSubTab} onValueChange={(v) => setReleaseSubTab(v as typeof releaseSubTab)}>
                  <TabsList className="flex flex-wrap h-auto gap-1">
                    <TabsTrigger value="fields" className="min-h-[44px]">{COPY.fieldsSubTab}</TabsTrigger>
                    <TabsTrigger value="track_rules" className="min-h-[44px]">{COPY.trackRulesSubTab}</TabsTrigger>
                    <TabsTrigger value="field_rules" className="min-h-[44px]">{COPY.fieldRulesSubTab}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </TabsContent>

              <p className="text-sm text-muted-foreground">{activeHint}</p>

              <div className="flex flex-wrap items-center gap-3">
                {localeToolbar}
                {addFieldToolbar}
              </div>
            </div>
          }
        >
          <TabsContent value="release" className="mt-0 h-full">
            {showFieldsPanel && renderFieldsTable()}
            {showTrackRulesPanel && renderTrackRulesTable()}
            {showFieldRulesPanel && renderFieldRulesTable()}
          </TabsContent>
          <TabsContent value="video" className="mt-0 h-full">
            {renderFieldsTable()}
          </TabsContent>
        </AdminListShell>
      </Tabs>
    </div>
  )
}