/**
 * Public Fan Page URL helpers — no hardcoded domain strings in components.
 */

export function getPublicFanPagePath(slug: string): string {
  return `/@${slug}`
}

export function getPublicFanPageUrl(slug: string, siteUrl?: string): string {
  const base = (siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com').replace(
    /\/$/,
    '',
  )
  return `${base}${getPublicFanPagePath(slug)}`
}