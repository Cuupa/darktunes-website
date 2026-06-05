'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { SubmissionFormField } from '@/types'

type FormType = 'release' | 'video'

const FIELD_TYPES = ['text', 'url', 'date', 'select', 'textarea', 'boolean'] as const

async function getToken(): Promise<string> {
  const session = await createBrowserSupabaseClient().auth.getSession()
  return session.data.session?.access_token ?? ''
}

export function SubmissionFormManager() {
  const [formType, setFormType] = useState<FormType>('release')
  const [fields, setFields] = useState<SubmissionFormField[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [newField, setNewField] = useState<Partial<SubmissionFormField>>({
    fieldType: 'text',
    isRequired: false,
    isVisible: true,
  })

  const fetchFields = useCallback(async (type: FormType) => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/submission-form-schema?type=' + type, {
        headers: { Authorization: 'Bearer ' + token },
      })
      if (res.ok) {
        const data = (await res.json()) as SubmissionFormField[]
        setFields(data)
      }
    } catch {
      toast.error('Failed to load form schema')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchFields(formType)
  }, [fetchFields, formType])

  const saveField = async (field: Partial<SubmissionFormField>) => {
    setSaving(field.id ?? 'new')
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/submission-form-schema', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...field, form_type: formType }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Field saved')
      setAddingNew(false)
      setNewField({ fieldType: 'text', isRequired: false, isVisible: true })
      await fetchFields(formType)
    } catch {
      toast.error('Failed to save field')
    } finally {
      setSaving(null)
    }
  }

  const deleteField = async (id: string) => {
    if (!confirm('Delete this field?')) return
    setSaving(id)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/submission-form-schema/' + id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Field deleted')
      await fetchFields(formType)
    } catch {
      toast.error('Failed to delete field')
    } finally {
      setSaving(null)
    }
  }

  const updateField = (field: SubmissionFormField, key: keyof SubmissionFormField, value: unknown) => {
    const updated = { ...field, [key]: value }
    void saveField(updated)
  }

  return (
    <div className="space-y-4">
      <Tabs value={formType} onValueChange={(v) => setFormType(v as FormType)}>
        <TabsList>
          <TabsTrigger value="release">Release Form</TabsTrigger>
          <TabsTrigger value="video">Video Form</TabsTrigger>
        </TabsList>
        <TabsContent value={formType} className="mt-4">
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-3">Key</th>
                      <th className="text-left py-2 pr-3">Label EN</th>
                      <th className="text-left py-2 pr-3">Label DE</th>
                      <th className="text-left py-2 pr-3">Type</th>
                      <th className="text-center py-2 pr-3">Required</th>
                      <th className="text-center py-2 pr-3">Visible</th>
                      <th className="text-left py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field) => (
                      <tr key={field.id} className="border-b border-border">
                        <td className="py-2 pr-3 font-mono text-xs">{field.fieldKey}</td>
                        <td className="py-2 pr-3">
                          <Input
                            className="h-7 text-xs"
                            defaultValue={field.fieldLabelEn}
                            onBlur={(e) => {
                              if (e.target.value !== field.fieldLabelEn) {
                                void updateField(field, 'fieldLabelEn', e.target.value)
                              }
                            }}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            className="h-7 text-xs"
                            defaultValue={field.fieldLabelDe}
                            onBlur={(e) => {
                              if (e.target.value !== field.fieldLabelDe) {
                                void updateField(field, 'fieldLabelDe', e.target.value)
                              }
                            }}
                          />
                        </td>
                        <td className="py-2 pr-3 text-xs">{field.fieldType}</td>
                        <td className="py-2 pr-3 text-center">
                          <input
                            type="checkbox"
                            checked={field.isRequired}
                            onChange={(e) => void updateField(field, 'isRequired', e.target.checked)}
                          />
                        </td>
                        <td className="py-2 pr-3 text-center">
                          <input
                            type="checkbox"
                            checked={field.isVisible}
                            onChange={(e) => void updateField(field, 'isVisible', e.target.checked)}
                          />
                        </td>
                        <td className="py-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={saving === field.id}
                            onClick={() => void deleteField(field.id)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {addingNew && (
                <div className="border border-border rounded-md p-4 space-y-3">
                  <p className="text-sm font-medium">New Field</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Key</Label>
                      <Input
                        className="h-7 text-xs"
                        value={newField.fieldKey ?? ''}
                        onChange={(e) => setNewField((p) => ({ ...p, fieldKey: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
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
                        {FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Label EN</Label>
                      <Input
                        className="h-7 text-xs"
                        value={newField.fieldLabelEn ?? ''}
                        onChange={(e) => setNewField((p) => ({ ...p, fieldLabelEn: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Label DE</Label>
                      <Input
                        className="h-7 text-xs"
                        value={newField.fieldLabelDe ?? ''}
                        onChange={(e) => setNewField((p) => ({ ...p, fieldLabelDe: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 items-center">
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={newField.isRequired ?? false}
                        onChange={(e) => setNewField((p) => ({ ...p, isRequired: e.target.checked }))}
                      />
                      Required
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={newField.isVisible ?? true}
                        onChange={(e) => setNewField((p) => ({ ...p, isVisible: e.target.checked }))}
                      />
                      Visible
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={saving === 'new'}
                      onClick={() => void saveField(newField)}
                    >
                      {saving === 'new' ? 'Saving…' : 'Save Field'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setAddingNew(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {!addingNew && (
                <Button variant="outline" size="sm" onClick={() => setAddingNew(true)}>
                  + Add Field
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
