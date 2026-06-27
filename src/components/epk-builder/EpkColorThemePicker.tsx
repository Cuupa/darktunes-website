'use client'

/**
 * src/components/epk-builder/EpkColorThemePicker.tsx
 *
 * Swatch picker for built-in EPK color palettes.
 */

import { useTranslations } from 'next-intl'
import { Palette } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEpkEditorStore, useEpkEditorStoreApi } from '@/lib/epk/editor/EpkEditorProvider'
import { applyPaletteToDocument, getDocumentPaletteId } from '@/lib/epk/templates/applyPalette'
import { EPK_COLOR_PALETTES } from '@/lib/epk/templates/colorPalettes'
import { cn } from '@/lib/utils'

interface EpkColorThemePickerProps {
  className?: string
}

export function EpkColorThemePicker({ className }: EpkColorThemePickerProps) {
  const t = useTranslations('portal')
  const store = useEpkEditorStoreApi()
  const applyDocument = useEpkEditorStore((s) => s.applyDocument)
  const document = useEpkEditorStore((s) => s.document)
  const activeId = getDocumentPaletteId(document)

  const handleSelect = (paletteId: string) => {
    const next = applyPaletteToDocument(document, paletteId)
    applyDocument(next)
    store.temporal.getState().clear()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('min-h-[44px] gap-1.5', className)}
          aria-label={t('epk_color_theme_label')}
        >
          <Palette size={16} aria-hidden="true" />
          <span className="hidden sm:inline">{t('epk_color_theme_label')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{t('epk_color_theme_label')}</DropdownMenuLabel>
        {EPK_COLOR_PALETTES.map((palette) => (
          <DropdownMenuItem
            key={palette.id}
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => handleSelect(palette.id)}
          >
            <span className="flex gap-0.5 shrink-0" aria-hidden="true">
              {(['background', 'accent', 'text'] as const).map((slot) => (
                <span
                  key={slot}
                  className="w-4 h-4 rounded-sm border border-border"
                  style={{ backgroundColor: palette.colors[slot] }}
                />
              ))}
            </span>
            <span className={palette.id === activeId ? 'font-semibold' : undefined}>
              {palette.name}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}