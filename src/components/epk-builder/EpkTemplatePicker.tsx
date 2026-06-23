'use client'

/**
 * src/components/epk-builder/EpkTemplatePicker.tsx
 *
 * Browse and apply admin-published EPK starter templates.
 */

import { useCallback, useEffect, useState } from 'react'
import { Layout } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { EpkTemplate } from '@/lib/api/epkTemplates'
import type { Dictionary } from '@/i18n/types'

interface EpkTemplatePickerProps {
  open: boolean
  onClose: () => void
  dict: Dictionary['portal']
  onApply: (template: EpkTemplate) => void
}

export function EpkTemplatePicker({ open, onClose, dict, onApply }: EpkTemplatePickerProps) {
  const [templates, setTemplates] = useState<EpkTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error(dict.epk_builder_export_auth_error)
        return
      }

      const res = await fetch('/api/portal/epk/templates', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('fetch failed')
      const data = (await res.json()) as { templates: EpkTemplate[] }
      setTemplates(data.templates)
    } catch {
      toast.error(dict.epk_templates_load_error)
    } finally {
      setLoading(false)
    }
  }, [dict.epk_builder_export_auth_error, dict.epk_templates_load_error])

  useEffect(() => {
    if (open) void fetchTemplates()
  }, [open, fetchTemplates])

  const handleApply = (template: EpkTemplate) => {
    onApply(template)
    setConfirmId(null)
    onClose()
    toast.success(dict.epk_templates_apply_success)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-xl lg:max-w-2xl p-0"
        aria-labelledby="epk-templates-title"
      >
        <DialogHeader className="p-6 pb-0">
          <DialogTitle id="epk-templates-title" className="flex items-center gap-2">
            <Layout size={20} aria-hidden="true" />
            {dict.epk_templates_title}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[70vh] p-6 space-y-4">
          <p className="text-sm text-muted-foreground">{dict.epk_templates_description}</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">{dict.epk_templates_loading}</p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{dict.epk_templates_empty}</p>
          ) : (
            <ul className="space-y-3">
              {templates.map((template) => (
                <li
                  key={template.id}
                  className="rounded-lg border border-border p-4 space-y-3"
                >
                  <div>
                    <p className="font-medium">{template.name}</p>
                    {template.description ? (
                      <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                    ) : null}
                  </div>
                  {confirmId === template.id ? (
                    <div className="flex flex-wrap gap-2">
                      <p className="w-full text-sm text-muted-foreground">
                        {dict.epk_templates_apply_confirm}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => handleApply(template)}
                      >
                        {dict.epk_templates_apply_confirm_yes}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => setConfirmId(null)}
                      >
                        {dict.epk_templates_apply_confirm_no}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => setConfirmId(template.id)}
                    >
                      {dict.epk_templates_apply}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}