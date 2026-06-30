import type { LandingPageDocumentV1 } from '@/lib/fan-page/schema/documentV1'
import { checkContrast } from '@/lib/fan-page/a11y/contrastCheck'
import { getPaletteById } from '@/lib/fan-page/templates/palettes'

export interface PublishWarning {
  code: string
  message: string
  severity: 'warning' | 'error'
}

export function validateFanPageForPublish(document: LandingPageDocumentV1): PublishWarning[] {
  const warnings: PublishWarning[] = []

  if (document.sections.length < 2) {
    warnings.push({
      code: 'min_sections',
      message: 'Add at least two sections before publishing.',
      severity: 'error',
    })
  }

  const hero = document.sections.find((s) => s.type === 'hero')
  const heroImage = hero?.props.image as { src?: string } | undefined
  if (!heroImage?.src) {
    warnings.push({
      code: 'hero_image',
      message: 'Hero section has no image — fans may see an empty header.',
      severity: 'warning',
    })
  }

  const hasMusic = document.sections.some((s) =>
    ['music_player', 'release_grid'].includes(s.type),
  )
  if (!hasMusic) {
    warnings.push({
      code: 'no_music',
      message: 'No music block — consider adding a player or release grid.',
      severity: 'warning',
    })
  }

  const palette = getPaletteById(document.theme.paletteId)
  const text = document.theme.customColors?.primary ?? palette.text
  const bg = document.theme.customColors?.background ?? palette.background
  const contrast = checkContrast(text, bg)
  if (contrast && contrast.level === 'fail') {
    warnings.push({
      code: 'contrast_fail',
      message: 'Text/background contrast may be hard to read on mobile.',
      severity: 'warning',
    })
  }

  return warnings
}

export function canHardPublish(warnings: PublishWarning[]): boolean {
  return !warnings.some((w) => w.severity === 'error')
}