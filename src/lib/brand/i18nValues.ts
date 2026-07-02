import type { BrandContext } from '@/lib/brand'

export type BrandI18nValues = {
  labelName: string
  labelShortName: string
  siteUrl: string
  siteHost: string
}

export function brandI18nValues(brand: BrandContext): BrandI18nValues {
  const siteUrl = brand.siteUrl.trim()
  const siteHost = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

  return {
    labelName: brand.labelName,
    labelShortName: brand.labelShortName,
    siteUrl,
    siteHost: siteHost || 'localhost',
  }
}