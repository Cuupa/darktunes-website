'use client'

/**
 * src/components/epk-builder/EpkPropertiesPanel.tsx
 */

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEpkEditorStore } from '@/lib/epk/editor/EpkEditorProvider'

export function EpkPropertiesPanel() {
  const t = useTranslations('portal')
  const document = useEpkEditorStore((s) => s.document)
  const selectedIds = useEpkEditorStore((s) => s.selectedIds)
  const updateElement = useEpkEditorStore((s) => s.updateElement)

  const element = document.elements.find((el) => el.id === selectedIds[0])

  if (!element) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">{t('epk_editor_no_selection')}</p>
      </div>
    )
  }

  const patchStyle = (key: string, value: string | number) => {
    updateElement(element.id, {
      style: { ...element.style, [key]: value },
    })
  }

  return (
    <div className="rounded-lg border border-border bg-card" data-lenis-prevent>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{t('epk_editor_properties_title')}</h2>
        <p className="text-xs text-muted-foreground mt-0.5 capitalize">{element.type}</p>
      </div>
      <div className="space-y-4 p-4 max-h-[min(360px,50vh)] overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="epk-prop-x">X</Label>
            <Input
              id="epk-prop-x"
              type="number"
              value={Math.round(element.x)}
              onChange={(e) => updateElement(element.id, { x: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="epk-prop-y">Y</Label>
            <Input
              id="epk-prop-y"
              type="number"
              value={Math.round(element.y)}
              onChange={(e) => updateElement(element.id, { y: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="epk-prop-w">{t('epk_editor_width')}</Label>
            <Input
              id="epk-prop-w"
              type="number"
              min={8}
              value={Math.round(element.width)}
              onChange={(e) => updateElement(element.id, { width: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="epk-prop-h">{t('epk_editor_height')}</Label>
            <Input
              id="epk-prop-h"
              type="number"
              min={8}
              value={Math.round(element.height)}
              onChange={(e) => updateElement(element.id, { height: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="epk-prop-rotation">{t('epk_editor_rotation')}</Label>
          <Input
            id="epk-prop-rotation"
            type="number"
            value={Math.round(element.rotation)}
            onChange={(e) => updateElement(element.id, { rotation: Number(e.target.value) })}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('epk_editor_opacity')}</Label>
          <Slider
            value={[Math.round((element.style.opacity ?? 1) * 100)]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => patchStyle('opacity', v / 100)}
            aria-label={t('epk_editor_opacity')}
          />
        </div>

        {element.type === 'text' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="epk-prop-content">{t('epk_editor_text_content')}</Label>
              <Textarea
                id="epk-prop-content"
                value={element.content ?? ''}
                rows={4}
                onChange={(e) => updateElement(element.id, { content: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="epk-prop-font-family">{t('epk_editor_font_family')}</Label>
              <Select
                value={element.style.fontFamily ?? 'Helvetica, Arial, sans-serif'}
                onValueChange={(v) => patchStyle('fontFamily', v)}
              >
                <SelectTrigger id="epk-prop-font-family">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Helvetica, Arial, sans-serif">
                    {t('epk_editor_font_default')}
                  </SelectItem>
                  {document.fonts.map((font) => (
                    <SelectItem key={font.id} value={font.family}>
                      {font.family}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="epk-prop-font-size">{t('epk_editor_font_size')}</Label>
              <Input
                id="epk-prop-font-size"
                type="number"
                min={8}
                value={element.style.fontSize ?? 14}
                onChange={(e) => patchStyle('fontSize', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="epk-prop-text-align">{t('epk_editor_text_align')}</Label>
              <Select
                value={element.style.textAlign ?? 'left'}
                onValueChange={(v) => patchStyle('textAlign', v)}
              >
                <SelectTrigger id="epk-prop-text-align">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">{t('epk_editor_align_left')}</SelectItem>
                  <SelectItem value="center">{t('epk_editor_align_center')}</SelectItem>
                  <SelectItem value="right">{t('epk_editor_align_right')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="epk-prop-text-color">{t('epk_editor_fill_color')}</Label>
              <Input
                id="epk-prop-text-color"
                type="text"
                value={element.style.fill ?? '#ffffff'}
                onChange={(e) => patchStyle('fill', e.target.value)}
              />
            </div>
          </>
        )}

        {element.type === 'shape' && (
          <div className="space-y-2">
            <Label htmlFor="epk-prop-fill">{t('epk_editor_fill_color')}</Label>
            <Input
              id="epk-prop-fill"
              type="text"
              value={element.style.fill ?? '#493687'}
              onChange={(e) => patchStyle('fill', e.target.value)}
            />
          </div>
        )}

        {(element.type === 'image' || element.type === 'logo') && element.src && (
          <div className="space-y-2">
            <Label htmlFor="epk-prop-image-src">{t('epk_editor_image_source')}</Label>
            <Input
              id="epk-prop-image-src"
              type="url"
              readOnly
              value={element.src}
              className="text-xs"
            />
          </div>
        )}
      </div>
    </div>
  )
}