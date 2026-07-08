import type { Capability, EffectiveAccess, SystemCapability } from './types'
import { hasPermissionKey } from './resolveAccess'

export function hasCapability(access: EffectiveAccess, capability: Capability): boolean {
  if (access.isAdmin) return true
  return access.capabilities.has(capability)
}

export function hasAnyCapability(access: EffectiveAccess, capabilities: Capability[]): boolean {
  if (access.isAdmin) return true
  return capabilities.some((cap) => access.capabilities.has(cap))
}

export function hasAllCapabilities(access: EffectiveAccess, capabilities: Capability[]): boolean {
  if (access.isAdmin) return true
  return capabilities.every((cap) => access.capabilities.has(cap))
}

export function hasAdminPanelAccess(access: EffectiveAccess): boolean {
  return hasAnyCapability(access, ['admin.panel.full', 'admin.panel.editor'])
}

export function hasFullAdminAccess(access: EffectiveAccess): boolean {
  return hasCapability(access, 'admin.panel.full')
}

export function hasPressDashboardAccess(access: EffectiveAccess): boolean {
  return hasAnyCapability(access, ['press.dashboard', 'admin.panel.full'])
}

export function hasSyncTriggerAccess(access: EffectiveAccess): boolean {
  return hasCapability(access, 'sync.trigger')
}

export type { SystemCapability }