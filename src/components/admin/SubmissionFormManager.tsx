'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { toast } from 'sonner'
import { routing } from '@/i18n/routing'
import { fieldToApiPayload } from '@/lib/api/submissionFormSchema'
import { fieldKeyFromLabel, uniqueFieldKey } from '@/lib/submissions/fieldKey'
import { MUSIC_FIELD_PRESETS } from '@/lib/submissions/musicFieldPresets'
import { SUBMISSION_FIELD_TYPES } from '@/lib/submissions/fieldTypes'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { SubmissionFormField } from '@/types'

type FormType = 'release' | 'video'

const EMPTY_LABELS = Object.fromEntries(routing.locales.map((l) => [l, '']))

async function parseApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string; message?: string }
    return data.error ?? data.message ?? `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

export function SubmissionFormManager() {
  const t = useTranslations('adminSubmissions')
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const [formType, setFormType] = useState<FormType>('release')
  const [fields, setFields] = useState<SubmissionFormField[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [labelLocale, setLabelLocale] = useState(routing.defaultLocale)
  const [newField, setNewField] = useState<Partial<SubmissionFormField>>({
    fieldType: 'text',
    fieldScope: 'release',
    fieldLabels: { ...EMPTY_LABELS },
    isRequired: false,
    isVisible: true,
  })

  const existingKeys = useMemo(() => new Set(fields.map((f) => f.fieldKey)), [fields])

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
      toast.error(err instanceof Error ? err.message : t('load_error'))
    } finally {
      setLoading(false)
    }
  }, [getToken, t])

  useEffect(() => {
    void fetchFields(formType)
  }, [fetchFields, formType])

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
      toast.success(t('field_saved'))
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
      toast.error(err instanceof Error ? err.message : t('save_error'))
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
      toast.success(t('field_deleted'))
      await fetchFields(formType)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('delete_error'))
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

  return (
    <div className="space-y-4">
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('field_delete_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('field_delete_confirm_body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('field_delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs value={formType} onValueChange={(v) => setFormType(v as FormType)}>
        <TabsList>
          <TabsTrigger value="release">{t('submission_form_release_tab')}</TabsTrigger>
          <TabsTrigger value="video">{t('submission_form_video_tab')}</TabsTrigger>
        </TabsList>
        <TabsContent value={formType} className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Label className="text-xs text-muted-foreground">{t('label_locale')}:</Label>
            {routing.locales.map((loc) => (
              <Button
                key={loc}
                type="button"
                size="sm"
                variant={labelLocale === loc ? 'default' : 'outline'}
                className="h-7 text-xs uppercase"
                onClick={() => setLabelLocale(loc)}
              >
                {loc}
              </Button>
            ))}
          </div>

          {loading ? (
            <p className="text-muted-foreground">{t('loading')}</p>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto overscroll-contain" data-lenis-prevent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-3">{t('field_key')}</th>
                      <th className="text-left py-2 pr-3">{t('field_label')}</th>
                      <th className="text-left py-2 pr-3">{t('field_type')}</th>
                      <th className="text-left py-2 pr-3">{t('field_scope')}</th>
                      <th className="text-center py-2 pr-3">{t('field_required')}</th>
                      <th className="text-center py-2 pr-3">{t('field_visible')}</th>
                      <th className="text-left py-2">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...fields].sort((a, b) => a.displayOrder - b.displayOrder).map((field) => (
                      <tr key={field.id} className="border-b border-border">
                        <td className="py-2 pr-3 font-mono text-xs">{field.fieldKey}</td>
                        <td className="py-2 pr-3">
                          <Input
                            className="h-7 text-xs"
                            defaultValue={field.fieldLabels[labelLocale] ?? ''}
                            onBlur={(e) => {
                              const next = e.target.value
                              if (next === (field.fieldLabels[labelLocale] ?? '')) return
                              updateField(field, {
                                fieldLabels: { ...field.fieldLabels, [labelLocale]: next },
                              })
                            }}
                          />
                        </td>
                        <td className="py-2 pr-3 text-xs">{field.fieldType}</td>
                        <td className="py-2 pr-3 text-xs">{field.fieldScope}</td>
                        <td className="py-2 pr-3 text-center">
                          <input
                            type="checkbox"
                            checked={field.isRequired}
                            onChange={(e) => updateField(field, { isRequired: e.target.checked })}
                            aria-label={t('field_required')}
                          />
                        </td>
                        <td className="py-2 pr-3 text-center">
                          <input
                            type="checkbox"
                            checked={field.isVisible}
                            onChange={(e) => updateField(field, { isVisible: e.target.checked })}
                            aria-label={t('field_visible')}
                          />
                        </td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => moveField(field, -1)} aria-label={t('move_up')}>↑</Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => moveField(field, 1)} aria-label={t('move_down')}>↓</Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={saving === field.id}
                              onClick={() => setDeleteTarget(field.id)}
                            >
                              {t('field_delete')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {addingNew && (
                <div className="border border-border rounded-md p-4 space-y-3">
                  <p className="text-sm font-medium">{t('field_new')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('field_key')}</Label>
                      <Input className="h-7 text-xs font-mono" readOnly value={newField.fieldKey ?? autoKeyForNew()} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('field_type')}</Label>
                      <select
                        className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
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
                        <Label className="text-xs">{t('field_scope')}</Label>
                        <select
                          className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
                          value={newField.fieldScope ?? 'release'}
                          onChange={(e) =>
                            setNewField((p) => ({
                              ...p,
                              fieldScope: e.target.value as SubmissionFormField['fieldScope'],
                            }))
                          }
                        >
                          <option value="release">{t('scope_release')}</option>
                          <option value="track">{t('scope_track')}</option>
                        </select>
                      </div>
                    )}
                    {routing.locales.map((loc) => (
                      <div key={loc} className="space-y-1">
                        <Label className="text-xs">{t('field_label')} ({loc.toUpperCase()})</Label>
                        <Input
                          className="h-7 text-xs"
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
                  <div className="flex gap-3 items-center flex-wrap">
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={newField.isRequired ?? false}
                        onChange={(e) => setNewField((p) => ({ ...p, isRequired: e.target.checked }))}
                      />
                      {t('field_required')}
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={newField.isVisible ?? true}
                        onChange={(e) => setNewField((p) => ({ ...p, isVisible: e.target.checked }))}
                      />
                      {t('field_visible')}
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={saving === 'new'}
                      onClick={() => {
                        const labels = newField.fieldLabels ?? EMPTY_LABELS
                        const key = newField.fieldKey ?? autoKeyForNew()
                        if (!key || !primaryLabel(labels)) {
                          toast.error(t('label_required'))
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
                      {saving === 'new' ? t('saving') : t('field_save')}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddingNew(false)}>
                      {t('cancel')}
                    </Button>
                  </div>
                </div>
              )}

              {!addingNew && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAddingNew(true)}>
                    {t('field_add')}
                  </Button>
                  {formType === 'release' && (
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) addPreset(e.target.value)
                        e.target.value = ''
                      }}
                      aria-label={t('field_add_preset')}
                    >
                      <option value="">{t('field_add_preset')}</option>
                      {MUSIC_FIELD_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.fieldLabels.en ?? p.id} ({p.fieldScope})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}