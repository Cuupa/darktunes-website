import type { Dictionary } from '@/i18n/types'
import type { HomepageSection } from '@/types'

export type SectionId = HomepageSection | 'home' | 'artists' | 'about' | 'contact' | 'shop'
export type SectionRouteType = 'anchor' | 'internal' | 'external'

export interface SectionConfig {
  id: SectionId
  labelKey: keyof Dictionary['navigation']
  href: string
  routeType: SectionRouteType
}

export const DEFAULT_SECTION_ORDER: HomepageSection[] = [
  'releases',
  'spotify',
  'videos',
  'concerts',
  'news',
  'newsletter',
]

export const SECTION_CONFIG: SectionConfig[] = [
  { id: 'home', labelKey: 'home', href: '#hero', routeType: 'anchor' },
  { id: 'releases', labelKey: 'releases', href: '#releases', routeType: 'anchor' },
  { id: 'spotify', labelKey: 'spotify', href: '#spotify-player', routeType: 'anchor' },
  { id: 'videos', labelKey: 'videos', href: '#videos', routeType: 'anchor' },
  { id: 'concerts', labelKey: 'tour', href: '#concerts', routeType: 'anchor' },
  { id: 'news', labelKey: 'news', href: '#news', routeType: 'anchor' },
  { id: 'newsletter', labelKey: 'newsletter', href: '#newsletter', routeType: 'anchor' },
  { id: 'artists', labelKey: 'artists', href: '/artists', routeType: 'internal' },
  { id: 'about', labelKey: 'about', href: '/about', routeType: 'internal' },
  { id: 'contact', labelKey: 'contact', href: '/contact', routeType: 'internal' },
  { id: 'shop', labelKey: 'shop', href: 'https://darkmerch.com/', routeType: 'external' },
]

const SECTION_CONFIG_BY_ID = new Map<SectionId, SectionConfig>(
  SECTION_CONFIG.map((section) => [section.id, section]),
)

export function buildNavItems(
  sectionOrder: HomepageSection[] = DEFAULT_SECTION_ORDER,
  options?: { showAbout?: boolean; aboutLabel?: string },
): SectionConfig[] {
  const orderedSectionIds = Array.from(
    new Set(
      sectionOrder.filter((section): section is HomepageSection => DEFAULT_SECTION_ORDER.includes(section)),
    ),
  )

  const aboutConfig = SECTION_CONFIG_BY_ID.get('about')
  const aboutItem = (options?.showAbout ?? false) && aboutConfig
    ? { ...aboutConfig, ...(options?.aboutLabel ? { labelKey: aboutConfig.labelKey } : {}) }
    : undefined

  return [
    SECTION_CONFIG_BY_ID.get('home'),
    ...orderedSectionIds.map((section) => SECTION_CONFIG_BY_ID.get(section)),
    SECTION_CONFIG_BY_ID.get('artists'),
    aboutItem,
    SECTION_CONFIG_BY_ID.get('contact'),
    SECTION_CONFIG_BY_ID.get('shop'),
  ].filter((section): section is SectionConfig => Boolean(section))
}
