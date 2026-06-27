import type { PortalFeatureFlag } from '@/types'

export const PORTAL_FEATURE_FLAG_GROUP_ORDER = ['artist', 'journalist'] as const

export type PortalFeatureFlagGroup = (typeof PORTAL_FEATURE_FLAG_GROUP_ORDER)[number]

export function isPortalFeatureFlagGroup(role: string): role is PortalFeatureFlagGroup {
  return (PORTAL_FEATURE_FLAG_GROUP_ORDER as readonly string[]).includes(role)
}

export function groupPortalFeatureFlags(
  flags: PortalFeatureFlag[],
): Array<{ role: PortalFeatureFlagGroup; flags: PortalFeatureFlag[] }> {
  const buckets = new Map<PortalFeatureFlagGroup, PortalFeatureFlag[]>()
  for (const role of PORTAL_FEATURE_FLAG_GROUP_ORDER) {
    buckets.set(role, [])
  }

  for (const flag of flags) {
    if (!isPortalFeatureFlagGroup(flag.targetRole)) continue
    buckets.get(flag.targetRole)?.push(flag)
  }

  return PORTAL_FEATURE_FLAG_GROUP_ORDER.map((role) => ({
    role,
    flags: buckets.get(role) ?? [],
  })).filter((group) => group.flags.length > 0)
}

/** next-intl message key under admin.features for a portal_feature_flags row id. */
export function portalFeatureFlagDescriptionKey(flagId: string): string {
  const dot = flagId.indexOf('.')
  if (dot === -1) return `flagDescriptions.${flagId}`
  const namespace = flagId.slice(0, dot)
  const remainder = flagId.slice(dot + 1)
  return `flagDescriptions.${namespace}.${remainder}`
}