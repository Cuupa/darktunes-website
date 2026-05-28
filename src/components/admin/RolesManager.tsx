'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import type { RolePermissions } from '@/types'

const ROLES = ['admin', 'editor', 'journalist', 'artist', 'user'] as const
type Role = typeof ROLES[number]

const PERMISSION_LABELS: Record<keyof RolePermissions, string> = {
  canViewAdminPanel: 'View Admin Panel',
  canPublishNews: 'Publish News',
  canEditNews: 'Edit News',
  canManageArtists: 'Manage Artists',
  canManageReleases: 'Manage Releases',
  canManageVideos: 'Manage Videos',
}

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Full access — cannot be restricted.',
  editor: 'Can manage content but not users or system settings.',
  journalist: 'Press portal user with limited write access.',
  artist: 'Artist portal user with their own content only.',
  user: 'Unassigned user with no special privileges.',
}

export function RolesManager() {
  const { settings, saveSettings, isLoading } = useSiteSettings()
  const [isSaving, setIsSaving] = useState(false)

  const permissions = useMemo<Record<Role, RolePermissions>>(() => {
    const stored = settings.rolePermissions ?? {}
    const defaults: RolePermissions = {
      canPublishNews: false,
      canEditNews: false,
      canManageArtists: false,
      canManageReleases: false,
      canManageVideos: false,
      canViewAdminPanel: false,
    }
    const adminPerms: RolePermissions = {
      canPublishNews: true,
      canEditNews: true,
      canManageArtists: true,
      canManageReleases: true,
      canManageVideos: true,
      canViewAdminPanel: true,
    }
    const editorDefaults: RolePermissions = {
      canPublishNews: true,
      canEditNews: true,
      canManageArtists: false,
      canManageReleases: true,
      canManageVideos: true,
      canViewAdminPanel: true,
    }
    return {
      admin: adminPerms,
      editor: { ...editorDefaults, ...(stored['editor'] ?? {}) },
      journalist: { ...defaults, ...(stored['journalist'] ?? {}) },
      artist: { ...defaults, ...(stored['artist'] ?? {}) },
      user: { ...defaults, ...(stored['user'] ?? {}) },
    }
  }, [settings.rolePermissions])

  const [local, setLocal] = useState<Record<Role, RolePermissions>>(() => permissions)

  // Sync from settings when they load
  useMemo(() => {
    setLocal(permissions)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.rolePermissions])

  const toggle = (role: Role, perm: keyof RolePermissions) => {
    if (role === 'admin') return // Admin is always full access
    setLocal((prev) => ({
      ...prev,
      [role]: { ...prev[role], [perm]: !prev[role][perm] },
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await saveSettings({ ...settings, rolePermissions: local })
      toast.success('Role permissions saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Configure which permissions each role has. Admin always has full access and cannot be
          restricted. Changes take effect after the next login.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ROLES.map((role) => {
          const perms = local[role]
          const isAdmin = role === 'admin'
          return (
            <Card key={role} className={isAdmin ? 'border-accent/50' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="capitalize text-base">{role}</CardTitle>
                  {isAdmin && (
                    <Badge variant="outline" className="text-accent border-accent/50 text-xs">
                      Full Access
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">{ROLE_DESCRIPTIONS[role]}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(Object.keys(PERMISSION_LABELS) as (keyof RolePermissions)[]).map((perm) => (
                  <div key={perm} className="flex items-center justify-between gap-4">
                    <Label htmlFor={`${role}-${perm}`} className="text-sm cursor-pointer">
                      {PERMISSION_LABELS[perm]}
                    </Label>
                    <Switch
                      id={`${role}-${perm}`}
                      checked={perms[perm]}
                      onCheckedChange={() => toggle(role, perm)}
                      disabled={isAdmin || isSaving}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={isSaving || isLoading} className="min-w-[140px]">
          {isSaving ? 'Saving…' : 'Save Permissions'}
        </Button>
      </div>
    </div>
  )
}
