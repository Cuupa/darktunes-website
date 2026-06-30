/**
 * Human-readable labels for Fan Page undo history entries.
 */

import type { LandingPageDocumentV1, FanPageBlockType } from '@/lib/fan-page/schema/documentV1'

const BLOCK_LABEL_KEYS: Record<FanPageBlockType, string> = {
  hero: 'fanPage_block_hero',
  bio: 'fanPage_block_bio',
  release_grid: 'fanPage_block_releases',
  music_player: 'fanPage_block_music',
  tour_dates: 'fanPage_block_tour',
  smart_links: 'fanPage_block_links',
  newsletter_signup: 'fanPage_block_newsletter',
  gallery: 'fanPage_block_gallery',
  video_grid: 'fanPage_block_videos',
  merch_shelf: 'fanPage_block_merch',
  cta_banner: 'fanPage_block_cta',
  spacer: 'fanPage_block_spacer',
}

export type FanPageHistoryLabelKey =
  | 'fanPage_history_added'
  | 'fanPage_history_removed'
  | 'fanPage_history_reordered'
  | 'fanPage_history_updated'
  | 'fanPage_history_theme'
  | 'fanPage_history_autolayout'
  | 'fanPage_history_initial'

export interface FanPageHistoryLabel {
  key: FanPageHistoryLabelKey
  blockKey?: string
}

function blockLabelKey(type: FanPageBlockType): string {
  return BLOCK_LABEL_KEYS[type]
}

export function describeDocumentChange(
  before: LandingPageDocumentV1,
  after: LandingPageDocumentV1,
): FanPageHistoryLabel {
  const beforeIds = new Set(before.sections.map((s) => s.id))
  const afterIds = new Set(after.sections.map((s) => s.id))

  const added = after.sections.filter((s) => !beforeIds.has(s.id))
  if (added.length === 1) {
    return { key: 'fanPage_history_added', blockKey: blockLabelKey(added[0].type) }
  }

  const removed = before.sections.filter((s) => !afterIds.has(s.id))
  if (removed.length === 1) {
    return { key: 'fanPage_history_removed', blockKey: blockLabelKey(removed[0].type) }
  }

  if (before.sections.length === after.sections.length) {
    const beforeOrder = [...before.sections].sort((a, b) => a.order - b.order).map((s) => s.id)
    const afterOrder = [...after.sections].sort((a, b) => a.order - b.order).map((s) => s.id)
    const reordered = beforeOrder.some((id, i) => id !== afterOrder[i])
    if (reordered) return { key: 'fanPage_history_reordered' }
  }

  if (before.theme.paletteId !== after.theme.paletteId) {
    return { key: 'fanPage_history_theme' }
  }

  if (
    JSON.stringify(before.theme.customColors) !== JSON.stringify(after.theme.customColors) ||
    before.theme.crtScanlines !== after.theme.crtScanlines
  ) {
    return { key: 'fanPage_history_theme' }
  }

  const changedSection = after.sections.find((section) => {
    const prev = before.sections.find((s) => s.id === section.id)
    if (!prev) return false
    return JSON.stringify(prev) !== JSON.stringify(section)
  })

  if (changedSection) {
    return { key: 'fanPage_history_updated', blockKey: blockLabelKey(changedSection.type) }
  }

  return { key: 'fanPage_history_initial' }
}