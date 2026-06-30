/**
 * Rule-based mobile auto-layout for Fan Page sections (no AI).
 */

import type { LandingPageDocumentV1, FanPageSection } from '@/lib/fan-page/schema/documentV1'

export function autoLayoutForMobile(document: LandingPageDocumentV1): LandingPageDocumentV1 {
  return {
    ...document,
    sections: document.sections.map((section) => ({
      ...section,
      styles: {
        ...section.styles,
        mobile: {
          ...section.styles.desktop,
          ...section.styles.mobile,
          paddingY: section.styles.mobile?.paddingY ?? 'md',
        },
      },
    })),
  }
}

export function reorderSections(sections: FanPageSection[], activeId: string, overId: string): FanPageSection[] {
  const sorted = [...sections].sort((a, b) => a.order - b.order)
  const fromIndex = sorted.findIndex((s) => s.id === activeId)
  const toIndex = sorted.findIndex((s) => s.id === overId)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return sections

  const next = [...sorted]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next.map((section, index) => ({ ...section, order: index }))
}