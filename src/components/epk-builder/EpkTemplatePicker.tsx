'use client'

/**
 * src/components/epk-builder/EpkTemplatePicker.tsx
 *
 * Browse and apply admin-published EPK starter templates.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Layout } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EpkCanvasPreview } from './EpkCanvasPreview'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { EpkTemplate } from '@/lib/api/epkTemplates'
import type { EpkBuiltinTemplate, EpkTemplateCategory } from '@/lib/epk/templates/starterTemplates'
import { applyPaletteToDocument } from '@/lib/epk/templates/applyPalette'
import { DEFAULT_EPK_PALETTE_ID, EPK_COLOR_PALETTES } from '@/lib/epk/templates/colorPalettes'
import { cn } from '@/lib/utils'

interface EpkTemplatePickerProps {
  open: boolean
  onClose: () => void
  onApply: (template: EpkTemplate) => void
}

type FilterCategory = 'all' | EpkTemplateCategory

function formatBadge(template: EpkBuiltinTemplate): string {
  const { meta } = template
  const orient = meta.orientation === 'landscape' ? '↔' : '↕'
  const pages = meta.pageCount === 1 ? '1 pg' : `${meta.pageCount} pg`
  const fmt = meta.pageFormat === 'a4' ? 'A4' : meta.pageFormat === 'letter' ? 'Letter' : 'Square'
  return `${fmt} · ${orient} · ${pages}`
}

export function EpkTemplatePicker({ open, onClose, onApply }: EpkTemplatePickerProps) {
  const t = useTranslations('portal')
  const [templates, setTemplates] = useState<EpkBuiltinTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [selectedPaletteId, setSelectedPaletteId] = useState(DEFAULT_EPK_PALETTE_ID)
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all')

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error(t('epk_builder_export_auth_error'))
        return
      }

      const res = await fetch('/api/portal/epk/templates', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('fetch failed')
      const data = (await res.json()) as { templates: EpkBuiltinTemplate[] }
      setTemplates(data.templates)
    } catch {
      toast.error(t('epk_templates_load_error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (open) void fetchTemplates()
  }, [open, fetchTemplates])

  const filteredTemplates = useMemo(() => {
    if (categoryFilter === 'all') return templates
    return templates.filter((tpl) => tpl.meta?.category === categoryFilter)
  }, [templates, categoryFilter])

  const handleApply = (template: EpkBuiltinTemplate) => {
    const document = applyPaletteToDocument(template.document, selectedPaletteId)
    onApply({ ...template, document })
    setConfirmId(null)
    onClose()
  }

  const categoryButtons: Array<{ id: FilterCategory; label: string }> = [
    { id: 'all', label: t('epk_templates_filter_all') },
    { id: 'one-page', label: t('epk_templates_filter_one_page') },
    { id: 'multi-page', label: t('epk_templates_filter_multi_page') },
    { id: 'social', label: t('epk_templates_filter_social') },
  ]

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-xl lg:max-w-3xl p-0"
        aria-labelledby="epk-templates-title"
      >
        <DialogHeader className="p-6 pb-0">
          <DialogTitle id="epk-templates-title" className="flex items-center gap-2">
            <Layout size={20} aria-hidden="true" />
            {t('epk_templates_title')}
          </DialogTitle>
          <DialogDescription>{t('epk_templates_description')}</DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">{t('epk_color_theme_label')}</p>
            <div className="flex flex-wrap gap-2">
              {EPK_COLOR_PALETTES.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors min-h-[44px]',
                    selectedPaletteId === palette.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-muted/50',
                  )}
                  onClick={() => setSelectedPaletteId(palette.id)}
                  aria-pressed={selectedPaletteId === palette.id}
                  aria-label={palette.name}
                >
                  <span className="flex gap-0.5" aria-hidden="true">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: palette.colors.background }} />
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: palette.colors.accent }} />
                  </span>
                  {palette.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {categoryButtons.map(({ id, label }) => (
              <Button
                key={id}
                type="button"
                variant={categoryFilter === id ? 'default' : 'outline'}
                size="sm"
                className="min-h-[36px]"
                onClick={() => setCategoryFilter(id)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[60vh] p-6 space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('epk_templates_loading')}</p>
          ) : filteredTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('epk_templates_empty')}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {filteredTemplates.map((template) => {
                const previewDoc = applyPaletteToDocument(template.document, selectedPaletteId)
                return (
                  <li
                    key={template.id}
                    className="rounded-lg border border-border p-4 space-y-3"
                  >
                    <EpkCanvasPreview
                      document={previewDoc}
                      scale={0.18}
                      className="mx-auto overflow-hidden rounded-md border border-border bg-muted/20"
                    />
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{template.name}</p>
                        {template.meta ? (
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {formatBadge(template)}
                          </span>
                        ) : null}
                      </div>
                      {template.description ? (
                        <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                      ) : null}
                    </div>
                    {confirmId === template.id ? (
                      <div className="flex flex-wrap gap-2">
                        <p className="w-full text-sm text-muted-foreground">
                          {t('epk_templates_apply_confirm')}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-[44px]"
                          onClick={() => handleApply(template)}
                        >
                          {t('epk_templates_apply_confirm_yes')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-[44px]"
                          onClick={() => setConfirmId(null)}
                        >
                          {t('epk_templates_apply_confirm_no')}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-[44px] w-full"
                        onClick={() => setConfirmId(template.id)}
                      >
                        {t('epk_templates_apply')}
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}