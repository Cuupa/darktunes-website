import { zonedLocalToUtcIso } from '@/lib/datetime/zonedDateTime'
import { resolveOperatorTimezone } from '@/lib/operator/defaultTimezone'
import type { SiteSettings } from '@/types'

type PublishedAtInput = {
  publishedAt: string
  publishedAtTimezone: string
  status: 'draft' | 'published' | 'scheduled' | 'archived'
}

export function buildPublishedAtFields(
  data: PublishedAtInput,
  settings?: Pick<SiteSettings, 'impressumAddress' | 'impressumVatId'> | null,
): { published_at: string; published_at_timezone: string | null } {
  const operatorTimezone = resolveOperatorTimezone(settings)
  const conversionTimezone = data.publishedAtTimezone || operatorTimezone
  const storedTimezone = data.status === 'scheduled' ? conversionTimezone : null

  return {
    published_at: data.publishedAt
      ? zonedLocalToUtcIso(data.publishedAt, conversionTimezone)
      : new Date().toISOString(),
    published_at_timezone: storedTimezone,
  }
}