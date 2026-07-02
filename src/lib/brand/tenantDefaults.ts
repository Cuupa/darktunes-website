/**
 * Tenant bootstrap values — the only code path that may read TENANT_* env vars.
 * Runtime brand text must come from site_settings via getBrandContext().
 */

export const NEUTRAL_LABEL_NAME = 'Music Label'
export const NEUTRAL_CONTACT_EMAIL = 'label@localhost'

export interface TenantBootstrap {
  labelName: string
  labelShortName: string
  contactEmail: string
}

export function readTenantBootstrap(): TenantBootstrap {
  const labelName = process.env.TENANT_LABEL_NAME?.trim() || NEUTRAL_LABEL_NAME
  const labelShortName = process.env.TENANT_LABEL_SHORT_NAME?.trim() || ''
  const contactEmail =
    process.env.TENANT_CONTACT_EMAIL?.trim() ||
    process.env.CONTACT_EMAIL?.trim() ||
    NEUTRAL_CONTACT_EMAIL

  return { labelName, labelShortName, contactEmail }
}

export function buildDefaultSeoDescription(labelName: string): string {
  return `Official website for ${labelName} — discover artists, releases, news, and videos.`
}

export function buildDefaultOgDescription(): string {
  return 'Music label — artists, releases, news, and videos.'
}