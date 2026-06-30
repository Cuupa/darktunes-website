import type { RolePermissionKey } from '@/lib/adminAuth'
import type { ActiveUserRole } from './normalizeRole'

/** Machine-readable access rights used by guards and the route registry. */
export type SystemCapability =
  | 'admin.panel.full'
  | 'admin.panel.editor'
  | 'cms.news.publish'
  | 'cms.news.edit'
  | 'cms.artists.manage'
  | 'cms.releases.manage'
  | 'cms.videos.manage'
  | 'admin.assets.view'
  | 'press.dashboard'
  | 'portal.access'
  | 'sync.trigger'

export type Capability = SystemCapability | string

export interface EffectiveAccess {
  primaryRole: ActiveUserRole | null
  allRoles: ActiveUserRole[]
  /** Granted permission keys (`can_*` system keys + custom definition names). */
  permissions: Set<string>
  capabilities: Set<Capability>
  customRoleNames: string[]
  isAdmin: boolean
}

export type { RolePermissionKey }