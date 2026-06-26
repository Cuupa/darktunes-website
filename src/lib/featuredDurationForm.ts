import type { FeaturedDurationValue } from '@/components/admin/forms/FeaturedDurationFields'
import { resolveFeaturedUntilInput } from '@/lib/heroFeatured'

export function featuredDurationFromUntil(featuredUntil?: string | null): FeaturedDurationValue {
  if (!featuredUntil) {
    return {
      durationEnabled: false,
      durationMode: 'days',
      durationDays: 14,
      untilLocal: '',
    }
  }

  const date = new Date(featuredUntil)
  const local = Number.isNaN(date.getTime())
    ? ''
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

  return {
    durationEnabled: true,
    durationMode: 'datetime',
    durationDays: 14,
    untilLocal: local,
  }
}

export function featuredUntilFromDuration(
  featured: boolean,
  duration: FeaturedDurationValue,
): string | null {
  return resolveFeaturedUntilInput({
    featured,
    durationEnabled: duration.durationEnabled,
    durationMode: duration.durationMode,
    durationDays: duration.durationDays,
    untilLocal: duration.untilLocal,
  })
}