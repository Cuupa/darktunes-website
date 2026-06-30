import type { RolePermissionKey } from '@/lib/adminAuth'
import type { UserRole } from '@/types/users'
import type { Capability, SystemCapability } from './types'

/** Primary-role precedence for `sync_primary_role` — keep in sync with reset.sql. */
export const ROLE_HIERARCHY: readonly UserRole[] = [
  'admin',
  'editor',
  'journalist',
  'artist',
  'user',
] as const

export const ROLE_HIERARCHY_RANK: Record<UserRole, number> = {
  admin: 1,
  editor: 2,
  journalist: 3,
  artist: 4,
  user: 5,
  press: 3,
}

/** Maps `role_permissions` columns to capabilities. */
export const PERMISSION_KEY_TO_CAPABILITIES: Record<RolePermissionKey, SystemCapability[]> = {
  can_publish_news: ['cms.news.publish'],
  can_edit_news: ['cms.news.edit'],
  can_manage_artists: ['cms.artists.manage'],
  can_manage_releases: ['cms.releases.manage'],
  can_manage_videos: ['cms.videos.manage'],
  can_view_admin_panel: ['admin.panel.editor', 'admin.assets.view'],
}

/** Default boolean flags seeded in reset.sql — contract for validate-rbac. */
export const DEFAULT_ROLE_PERMISSIONS: Record<
  Exclude<UserRole, 'press'>,
  Record<RolePermissionKey, boolean>
> = {
  admin: {
    can_publish_news: true,
    can_edit_news: true,
    can_manage_artists: true,
    can_manage_releases: true,
    can_manage_videos: true,
    can_view_admin_panel: true,
  },
  editor: {
    can_publish_news: true,
    can_edit_news: true,
    can_manage_artists: false,
    can_manage_releases: true,
    can_manage_videos: true,
    can_view_admin_panel: true,
  },
  journalist: {
    can_publish_news: false,
    can_edit_news: false,
    can_manage_artists: false,
    can_manage_releases: false,
    can_manage_videos: false,
    can_view_admin_panel: false,
  },
  artist: {
    can_publish_news: false,
    can_edit_news: false,
    can_manage_artists: false,
    can_manage_releases: false,
    can_manage_videos: false,
    can_view_admin_panel: false,
  },
  user: {
    can_publish_news: false,
    can_edit_news: false,
    can_manage_artists: false,
    can_manage_releases: false,
    can_manage_videos: false,
    can_view_admin_panel: false,
  },
}

/** Capabilities granted by system role regardless of `role_permissions`. */
export const ROLE_BASE_CAPABILITIES: Partial<Record<UserRole, SystemCapability[]>> = {
  admin: [
    'admin.panel.full',
    'admin.panel.editor',
    'cms.news.publish',
    'cms.news.edit',
    'cms.artists.manage',
    'cms.releases.manage',
    'cms.videos.manage',
    'admin.assets.view',
    'press.dashboard',
    'portal.access',
    'sync.trigger',
  ],
  editor: ['sync.trigger'],
  journalist: ['press.dashboard'],
}

const ALL_SYSTEM_CAPABILITIES = new Set<SystemCapability>([
  'admin.panel.full',
  'admin.panel.editor',
  'cms.news.publish',
  'cms.news.edit',
  'cms.artists.manage',
  'cms.releases.manage',
  'cms.videos.manage',
  'admin.assets.view',
  'press.dashboard',
  'portal.access',
  'sync.trigger',
])

export function capabilitiesFromPermissionKey(permission: string): Capability[] {
  if (permission in PERMISSION_KEY_TO_CAPABILITIES) {
    return PERMISSION_KEY_TO_CAPABILITIES[permission as RolePermissionKey]
  }
  return [permission]
}

export function capabilitiesFromRolePermissions(
  flags: Partial<Record<RolePermissionKey, boolean>>,
): Set<Capability> {
  const caps = new Set<Capability>()
  for (const [key, enabled] of Object.entries(flags) as [RolePermissionKey, boolean][]) {
    if (!enabled) continue
    for (const cap of PERMISSION_KEY_TO_CAPABILITIES[key]) {
      caps.add(cap)
    }
    caps.add(key)
  }
  return caps
}

export function isSystemCapability(value: string): value is SystemCapability {
  return ALL_SYSTEM_CAPABILITIES.has(value as SystemCapability)
}