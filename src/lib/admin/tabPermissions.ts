import { editorCanAccessTab, type EditorDashboardTab } from '@/lib/editor/editorTabPermissions'
import type { Database } from '@/types/database'

type RolePermissionsRow = Database['public']['Tables']['role_permissions']['Row']

export type TabValue =
  | 'artists' | 'releases' | 'news' | 'videos' | 'assets'
  | 'accreditations' | 'press' | 'statements'
  | 'release-submissions' | 'video-submissions' | 'fan-page-reviews' | 'submission-form'
  | 'events' | 'genres' | 'maintenance' | 'promo-log' | 'roles'

interface TabCoreDef {
  value: TabValue
  adminOnly: boolean
}

const TAB_CORE_DEFS: TabCoreDef[] = [
  { value: 'artists',             adminOnly: false },
  { value: 'releases',            adminOnly: false },
  { value: 'news',                adminOnly: false },
  { value: 'videos',              adminOnly: false },
  { value: 'events',              adminOnly: false },
  { value: 'genres',              adminOnly: false },
  { value: 'assets',              adminOnly: true  },
  { value: 'accreditations',      adminOnly: true  },
  { value: 'press',               adminOnly: true  },
  { value: 'statements',          adminOnly: true  },
  { value: 'release-submissions', adminOnly: false },
  { value: 'video-submissions',   adminOnly: false },
  { value: 'fan-page-reviews',    adminOnly: false },
  { value: 'promo-log',           adminOnly: false },
  { value: 'submission-form',     adminOnly: true  },
  { value: 'roles',               adminOnly: true  },
  { value: 'maintenance',         adminOnly: true  },
]

export const ALL_TAB_VALUES: readonly TabValue[] = TAB_CORE_DEFS.map((t) => t.value)

export function isValidTab(value: string | null): value is TabValue {
  return ALL_TAB_VALUES.includes(value as TabValue)
}

export interface CanSeeTabOptions {
  isAdmin: boolean
  isEditor: boolean
  contentOnly: boolean
  permissions: RolePermissionsRow | null
}

export function canSeeTab(tab: TabValue, options: CanSeeTabOptions): boolean {
  const def = TAB_CORE_DEFS.find((t) => t.value === tab)
  if (!def) return false
  if (options.isAdmin) return true
  if (def.adminOnly) return false
  if (options.isEditor) {
    return editorCanAccessTab(tab as EditorDashboardTab, options.permissions)
  }
  if (options.contentOnly) return !def.adminOnly
  return false
}
