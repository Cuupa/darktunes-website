import type { LandingPageDocumentV1 } from '@/lib/fan-page/schema/documentV1'
import { createSectionId } from '@/lib/fan-page/schema/documentV1'

export interface FanPageTemplateMeta {
  id: string
  name: string
  description: string
}

export const FAN_PAGE_TEMPLATE_META: FanPageTemplateMeta[] = [
  { id: 'release-hype', name: 'Release Hype', description: 'Pre-save, streaming links, countdown' },
  { id: 'tour-attack', name: 'Tour Attack', description: 'Tour dates and ticket CTAs' },
  { id: 'fan-magnet', name: 'Fan Magnet', description: 'Newsletter and community growth' },
  { id: 'merch-drop', name: 'Merch Drop', description: 'Shop-focused layout' },
  { id: 'dark-minimal', name: 'Dark Minimal', description: 'Underground aesthetic' },
  { id: 'bio-vibes', name: 'Bio & Vibes', description: 'Artist introduction' },
  { id: 'festival-warrior', name: 'Festival Warrior', description: 'Festival and booking focus' },
  { id: 'link-hub-pro', name: 'Link Hub Pro', description: 'All links in one place' },
  { id: 'blank', name: 'Blank', description: 'Start from scratch' },
]

function section(
  type: LandingPageDocumentV1['sections'][number]['type'],
  order: number,
  props: Record<string, unknown> = {},
): LandingPageDocumentV1['sections'][number] {
  return { id: createSectionId(), type, order, props, styles: { desktop: {} } }
}

function baseDoc(templateId: string, sections: LandingPageDocumentV1['sections']): LandingPageDocumentV1 {
  return {
    version: 1,
    templateId,
    theme: { paletteId: 'dark-minimal', crtScanlines: true },
    sections,
  }
}

const TEMPLATE_BUILDERS: Record<string, () => LandingPageDocumentV1> = {
  'release-hype': () =>
    baseDoc('release-hype', [
      section('hero', 0, { headline: '', subheadline: '', showCountdown: true }),
      section('music_player', 1),
      section('release_grid', 2, { limit: 4 }),
      section('cta_banner', 3, { label: 'Pre-Save', url: '' }),
      section('smart_links', 4),
    ]),
  'tour-attack': () =>
    baseDoc('tour-attack', [
      section('hero', 0, { headline: 'On Tour' }),
      section('tour_dates', 1),
      section('cta_banner', 2, { label: 'Tickets', url: '' }),
      section('music_player', 3),
    ]),
  'fan-magnet': () =>
    baseDoc('fan-magnet', [
      section('hero', 0),
      section('bio', 1),
      section('newsletter_signup', 2),
      section('music_player', 3),
    ]),
  'merch-drop': () =>
    baseDoc('merch-drop', [
      section('hero', 0, { headline: 'Merch Drop' }),
      section('merch_shelf', 1),
      section('cta_banner', 2, { label: 'Shop Now', url: '' }),
    ]),
  'dark-minimal': () =>
    baseDoc('dark-minimal', [
      section('hero', 0),
      section('music_player', 1),
      section('bio', 2),
      section('smart_links', 3),
    ]),
  'bio-vibes': () =>
    baseDoc('bio-vibes', [
      section('hero', 0),
      section('bio', 1),
      section('gallery', 2),
      section('video_grid', 3, { limit: 3 }),
    ]),
  'festival-warrior': () =>
    baseDoc('festival-warrior', [
      section('hero', 0, { headline: 'Live' }),
      section('tour_dates', 1),
      section('cta_banner', 2, { label: 'Booking', url: '' }),
      section('music_player', 3),
    ]),
  'link-hub-pro': () =>
    baseDoc('link-hub-pro', [
      section('hero', 0, { compact: true }),
      section('smart_links', 1),
      section('music_player', 2),
      section('release_grid', 3, { limit: 3 }),
    ]),
  blank: () => baseDoc('blank', [section('hero', 0)]),
}

export function createTemplateDocument(templateId: string): LandingPageDocumentV1 {
  const builder = TEMPLATE_BUILDERS[templateId] ?? TEMPLATE_BUILDERS.blank
  return builder()
}

export function getTemplateMeta(templateId: string): FanPageTemplateMeta {
  return FAN_PAGE_TEMPLATE_META.find((t) => t.id === templateId) ?? FAN_PAGE_TEMPLATE_META[8]
}