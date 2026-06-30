import type { Database } from '@/types/database'
import type { RolePermissionKey } from '@/lib/adminAuth'

export type EditorDashboardTab =
  | 'artists'
  | 'releases'
  | 'news'
  | 'videos'
  | 'assets'
  | 'release-submissions'
  | 'video-submissions'
  | 'fan-page-reviews'
  | 'events'
  | 'genres'
  | 'promo-log'

type RolePermissionsRow = Database['public']['Tables']['role_permissions']['Row']

type PermissionCheck = (permissions: RolePermissionsRow) => boolean

/** Tabs gated by role_permissions for editors. Tabs not listed are always visible. */
export const EDITOR_TAB_PERMISSION_CHECKS: Partial<Record<EditorDashboardTab, PermissionCheck>> = {
  artists: (p) => p.can_manage_artists,
  releases: (p) => p.can_manage_releases,
  news: (p) => p.can_publish_news || p.can_edit_news,
  videos: (p) => p.can_manage_videos,
  assets: (p) => p.can_view_admin_panel,
}

export function editorCanAccessTab(
  tab: EditorDashboardTab,
  permissions: RolePermissionsRow | null,
): boolean {
  const check = EDITOR_TAB_PERMISSION_CHECKS[tab]
  if (!check) return true
  if (!permissions) return false
  return check(permissions)
}

export function permissionKeyForTab(tab: EditorDashboardTab): RolePermissionKey | null {
  switch (tab) {
    case 'artists':
      return 'can_manage_artists'
    case 'releases':
      return 'can_manage_releases'
    case 'news':
      return 'can_publish_news'
    case 'videos':
      return 'can_manage_videos'
    case 'assets':
      return 'can_view_admin_panel'
    default:
      return null
  }
}