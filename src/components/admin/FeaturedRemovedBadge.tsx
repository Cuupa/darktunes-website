import { Badge } from '@/components/ui/badge'
import type { FeaturedRemovedReason } from '@/lib/heroFeatured'

type Props = {
  reason?: FeaturedRemovedReason | null
}

export function FeaturedRemovedBadge({ reason }: Props) {
  if (!reason) return null

  const label = reason === 'expired' ? 'Hero expired' : 'Hero full'
  const title =
    reason === 'expired'
      ? 'Automatically removed from the hero because the feature duration ended.'
      : 'Automatically removed from the hero because 10 newer featured items exist.'

  return (
    <Badge variant="outline" className="text-xs text-muted-foreground" title={title}>
      {label}
    </Badge>
  )
}