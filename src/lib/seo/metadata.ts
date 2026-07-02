import type { Metadata } from 'next'
import { SITE_SETTINGS_DEFAULTS } from '@/lib/api/siteSettings'
import { getCachedSiteSettings } from '@/lib/cache/publicQueries'
import { resolveBrandFromSettings, type BrandContext } from '@/lib/brand'
import {
  buildDefaultOgDescription,
  buildDefaultSeoDescription,
} from '@/lib/brand/tenantDefaults'

export async function getMetadataBrand(): Promise<BrandContext> {
  const settings =
    (await getCachedSiteSettings().catch(() => null)) ?? SITE_SETTINGS_DEFAULTS
  return resolveBrandFromSettings(settings)
}

/** "Page — Label Name" */
export function pageTitle(page: string, labelName: string): string {
  return `${page} — ${labelName}`
}

/** "Page | Label Name" */
export function pageTitlePipe(page: string, labelName: string): string {
  return `${page} | ${labelName}`
}

/** "Entity — Context | Label" */
export function entityTitle(
  entity: string,
  context: string,
  labelName: string,
): string {
  return `${entity} — ${context} | ${labelName}`
}

export function portalPageTitle(page: string, labelShortName: string): string {
  return pageTitlePipe(page, `${labelShortName} Portal`)
}

export function portalBuilderTitle(page: string, labelShortName: string): string {
  return pageTitlePipe(page, `${labelShortName} Artist Portal`)
}

export function rootMetadataFallbacks(brand: BrandContext): Pick<
  Metadata,
  'title' | 'description' | 'openGraph'
> {
  const title = brand.labelName
  const description = buildDefaultSeoDescription(brand.labelName)
  const ogDescription = buildDefaultOgDescription()

  return {
    title,
    description,
    openGraph: {
      title,
      description: ogDescription,
      type: 'website',
    },
  }
}