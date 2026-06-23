'use client'

/**
 * src/components/admin/EpkTemplatesManager.tsx
 *
 * Admin CRUD for EPK brand guideline / starter templates.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { EpkTemplate } from '@/lib/api/epkTemplates'
import { getPageDimensions } from '@/lib/epk/schema/pageDimensions'
import { safeParseEpkDocumentV2 } from '@/lib/epk/schema/documentV2'

function createBlankTemplateDocument() {
  const dims = getPageDimensions('a4', 'portrait')
  return {
    version: 2 as const,
    pageFormat: 'a4' as const,
    orientation: 'portrait' as const,
    pages: [
      {
        id: crypto.randomUUID(),
        name: 'Cover',
        width: dims.width,
        height: dims.height,
        background: { type: 'color' as const, color: '#101010' },
      },
    ],
    elements: [],
    fonts: [],
    metadata: {},
  }
}

export function EpkTemplatesManager() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [templates, setTemplates] = useState<EpkTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    isPublished: false,
    documentJson: JSON.stringify(createBlankTemplateDocument(), null, 2),
  })

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/epk-templates', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Failed to load templates')
      const payload = (await res.json()) as { templates: EpkTemplate[] }
      setTemplates(payload.templates)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    let documentJson: unknown
    try {
      documentJson = JSON.parse(form.documentJson)
    } catch {
      toast.error('Invalid document JSON')
      return
    }
    const parsed = safeParseEpkDocumentV2(documentJson)
    if (!parsed.success) {
      toast.error('Invalid document JSON')
      return
    }

    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/epk-templates', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          is_published: form.isPublished,
          document: parsed.data,
        }),
      })
      if (!res.ok) throw new Error('Create failed')

      setForm({
        name: '',
        description: '',
        isPublished: false,
        documentJson: JSON.stringify(createBlankTemplateDocument(), null, 2),
      })
      toast.success('EPK template created')
      await loadTemplates()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  const togglePublished = async (template: EpkTemplate) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/epk-templates', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: template.id,
          is_published: !template.isPublished,
        }),
      })
      if (!res.ok) throw new Error('Update failed')
      await loadTemplates()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const res = await fetch(`/api/admin/epk-templates?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Delete failed')
      toast.success('Template deleted')
      await loadTemplates()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading EPK templates…</p>
  }

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card/70">
        <CardHeader>
          <CardTitle>Create EPK template</CardTitle>
          <CardDescription>
            Brand guideline starter layouts artists can apply in the EPK Builder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="epk-template-name">Name</Label>
                <Input
                  id="epk-template-name"
                  value={form.name}
                  onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="epk-template-description">Description</Label>
                <Input
                  id="epk-template-description"
                  value={form.description}
                  onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="epk-template-published"
                checked={form.isPublished}
                onCheckedChange={(checked) =>
                  setForm((v) => ({ ...v, isPublished: checked === true }))
                }
              />
              <Label htmlFor="epk-template-published">Published (visible to artists)</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="epk-template-document">Document JSON (v2)</Label>
              <Textarea
                id="epk-template-document"
                value={form.documentJson}
                onChange={(e) => setForm((v) => ({ ...v, documentJson: e.target.value }))}
                className="min-h-[200px] font-mono text-xs"
                required
              />
            </div>
            <Button type="submit" className="min-h-[44px]" disabled={saving}>
              {saving ? 'Saving…' : 'Create template'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {templates.map((template) => (
          <Card key={template.id} className="border-border bg-card/70">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{template.name}</p>
                {template.description ? (
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                ) : null}
                <p className="text-xs text-muted-foreground mt-1">
                  {template.isPublished ? 'Published' : 'Draft'} · {template.document.pages.length} page(s)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  onClick={() => void togglePublished(template)}
                >
                  {template.isPublished ? 'Unpublish' : 'Publish'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] min-w-[44px]"
                  aria-label={`Delete ${template.name}`}
                  onClick={() => void handleDelete(template.id)}
                >
                  <Trash size={16} aria-hidden="true" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && (
          <p className="text-sm text-muted-foreground">No EPK templates yet.</p>
        )}
      </div>
    </div>
  )
}