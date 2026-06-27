'use client'

import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEpkEditorStore } from '@/lib/epk/editor/EpkEditorProvider'
import { EpkGradientPicker } from './EpkGradientPicker'
import { DEFAULT_GRADIENT_ANGLE, EPK_GRADIENT_PRESETS } from '@/lib/epk/gradients'
import type { EpkPageBackground } from '@/lib/epk/schema/documentV2'

export function EpkPageBackgroundPanel() {
  const t = useTranslations('portal')
  const pages = useEpkEditorStore((s) => s.document.pages)
  const activePageId = useEpkEditorStore((s) => s.activePageId)
  const updatePageBackground = useEpkEditorStore((s) => s.updatePageBackground)

  const page = pages.find((p) => p.id === activePageId) ?? pages[0]
  if (!page) return null

  const setBackground = (background: EpkPageBackground) => {
    updatePageBackground(page.id, background)
  }

  const bgType = page.background.type

  return (
    <div className="rounded-lg border border-border bg-card" data-lenis-prevent>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{t('epk_page_background_title')}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{page.name ?? t('epk_pages_title')}</p>
      </div>
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          <Label htmlFor="epk-page-bg-type">{t('epk_page_background_type')}</Label>
          <Select
            value={bgType}
            onValueChange={(value: EpkPageBackground['type']) => {
              if (value === 'color') {
                setBackground({ type: 'color', color: page.background.color ?? '#101010' })
              } else if (value === 'gradient') {
                const preset = EPK_GRADIENT_PRESETS[0]?.gradient
                setBackground({
                  type: 'gradient',
                  gradientStops: preset?.stops ?? [
                    { offset: 0, color: '#101010' },
                    { offset: 1, color: '#493687' },
                  ],
                  gradientAngle: preset?.angle ?? DEFAULT_GRADIENT_ANGLE,
                })
              } else {
                setBackground({ type: 'image', src: page.background.src, opacity: page.background.opacity ?? 1 })
              }
            }}
          >
            <SelectTrigger id="epk-page-bg-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="color">{t('epk_page_background_solid')}</SelectItem>
              <SelectItem value="gradient">{t('epk_page_background_gradient')}</SelectItem>
              <SelectItem value="image">{t('epk_page_background_image')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {bgType === 'color' ? (
          <div className="space-y-2">
            <Label htmlFor="epk-page-bg-color">{t('epk_editor_fill_color')}</Label>
            <Input
              id="epk-page-bg-color"
              type="text"
              value={page.background.color ?? '#101010'}
              onChange={(e) => setBackground({ type: 'color', color: e.target.value })}
            />
          </div>
        ) : null}

        {bgType === 'gradient' && page.background.gradientStops ? (
          <EpkGradientPicker
            compact
            gradient={{
              angle: page.background.gradientAngle ?? DEFAULT_GRADIENT_ANGLE,
              stops: page.background.gradientStops,
            }}
            onChange={(gradient) =>
              setBackground({
                type: 'gradient',
                gradientStops: gradient.stops,
                gradientAngle: gradient.angle,
              })
            }
          />
        ) : null}

        {bgType === 'image' ? (
          <div className="space-y-2">
            <Label htmlFor="epk-page-bg-image">{t('epk_editor_image_source')}</Label>
            <Input
              id="epk-page-bg-image"
              type="url"
              placeholder="https://"
              value={page.background.src ?? ''}
              onChange={(e) =>
                setBackground({
                  type: 'image',
                  src: e.target.value || undefined,
                  opacity: page.background.opacity ?? 1,
                })
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}