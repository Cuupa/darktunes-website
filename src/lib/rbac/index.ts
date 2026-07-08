export {
  normalizeRole,
  normalizeRoles,
  DEPRECATED_PRESS_ROLE,
  type ActiveUserRole,
} from './normalizeRole'
export type { Capability, EffectiveAccess, SystemCapability } from './types'
export {
  ROLE_HIERARCHY,
  ROLE_HIERARCHY_RANK,
  PERMISSION_KEY_TO_CAPABILITIES,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_BASE_CAPABILITIES,
  capabilitiesFromPermissionKey,
  capabilitiesFromRolePermissions,
  isSystemCapability,
} from './registry'
export { resolveEffectiveAccess, hasPermissionKey } from './resolveAccess'
export {
  hasCapability,
  hasAnyCapability,
  hasAllCapabilities,
  hasAdminPanelAccess,
  hasFullAdminAccess,
  hasPressDashboardAccess,
  hasSyncTriggerAccess,
} from './guards'
export {
  ROUTE_ACCESS_RULES,
  ADMIN_ONLY_PATH_PREFIXES,
  isAdminOnlyAdminPath,
  matchRouteRule,
  type RouteAccessRule,
} from './routeRegistry'
export { requirePageCapability } from './requireAdminPage'