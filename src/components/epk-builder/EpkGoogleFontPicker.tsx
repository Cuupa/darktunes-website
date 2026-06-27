'use client'

import { useTranslations } from 'next-intl'
import { EPK_GOOGLE_FONTS } from '@/lib/epk/googleFonts'
import { useEpkEditorStore } from '@/lib/epk/editor/EpkEditorProvider'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function EpkGoogleFontPicker() {
  const t = useTranslations('portal')
  const addDocumentFont = useEpkEditorStore((s) => s.addDocumentFont)
  const documentFonts = useEpkEditorStore((s) => s.document.fonts)

  const added = new Set(documentFonts.map((f) => f.family))

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{t('epk_google_fonts_title')}</p>
      <Select
        value=""
        onValueChange={(family) => {
          if (!family || added.has(family)) return
          const spec = EPK_GOOGLE_FONTS.find((f) => f.family === family)
          if (!spec) return
          addDocumentFont({
            id: `google-${spec.id}`,
            family: spec.family,
          })
        }}
      >
        <SelectTrigger className="min-h-[44px]">
          <SelectValue placeholder={t('epk_google_fonts_add')} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{t('epk_google_fonts_sans')}</SelectLabel>
            {EPK_GOOGLE_FONTS.filter((f) => f.category === 'sans').map((font) => (
              <SelectItem key={font.id} value={font.family} disabled={added.has(font.family)}>
                {font.family}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>{t('epk_google_fonts_serif')}</SelectLabel>
            {EPK_GOOGLE_FONTS.filter((f) => f.category === 'serif').map((font) => (
              <SelectItem key={font.id} value={font.family} disabled={added.has(font.family)}>
                {font.family}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>{t('epk_google_fonts_display')}</SelectLabel>
            {EPK_GOOGLE_FONTS.filter((f) => f.category === 'display').map((font) => (
              <SelectItem key={font.id} value={font.family} disabled={added.has(font.family)}>
                {font.family}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}