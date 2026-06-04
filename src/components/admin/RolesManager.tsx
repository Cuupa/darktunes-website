'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type DbRolePermissions = Database['public']['Tables']['role_permissions']['Row']
type PermissionKey = Exclude<keyof DbRolePermissions, 'role' | 'updated_at' | 'updated_by'>

const ROLES = ['admin', 'editor', 'journalist', 'artist', 'user'] as const
type Role = typeof ROLES[number]

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  can_view_admin_panel: 'View Admin Panel',
  can_publish_news: 'Publish News',
  can_edit_news: 'Edit News',
  can_manage_artists: 'Manage Artists',
  can_manage_releases: 'Manage Releases',
  can_manage_videos: 'Manage Videos',
}

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: 'Full access — cannot be restricted.',
  editor: 'Can manage content but not users or system settings.',
  journalist: 'Press portal user with limited write access.',
  artist: 'Artist portal user with their own content only.',
  user: 'Unassigned user with no special privileges.',
}

type PermissionsMap = Partial<Record<Role, DbRolePermissions>>

export function RolesManager() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [serverData, setServerData] = useState<PermissionsMap>({})
  const [local, setLocal] = useState<PermissionsMap>({})

  const loadPermissions = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setIsLoading(false)
        return
      }
      const res = await fetch('/api/admin/roles/permissions', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`Failed to load permissions: ${res.statusText}`)
      const rows = (await res.json()) as DbRolePermissions[]
      const map: PermissionsMap = {}
      for (const row of rows) {
        map[row.role as Role] = row
      }
      setServerData(map)
      setLocal(map)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load permissions')
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void loadPermissions()
  }, [loadPermissions])

  const toggle = (role: Role, perm: PermissionKey) => {
    if (role === 'admin') return // Admin is always full access
    setLocal((prev) => {
      const current = prev[role]
      if (!current) return prev
      return { ...prev, [role]: { ...current, [perm]: !current[perm] } }
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      // Save each non-admin role that has changed
      const rolesToSave = (ROLES as readonly Role[]).filter((role) => {
        if (role === 'admin') return false
        const localRow = local[role]
        const serverRow = serverData[role]
        if (!localRow || !serverRow) return false
        return (Object.keys(PERMISSION_LABELS) as PermissionKey[]).some(
          (perm) => localRow[perm] !== serverRow[perm],
        )
      })

      if (rolesToSave.length === 0) {
        toast.info('No changes to save')
        return
      }

      await Promise.all(
        rolesToSave.map(async (role) => {
          const localRow = local[role]
          if (!localRow) return
          const permissions: Partial<Record<PermissionKey, boolean>> = {}
          for (const perm of Object.keys(PERMISSION_LABELS) as PermissionKey[]) {
            permissions[perm] = localRow[perm]
          }
          const res = await fetch('/api/admin/roles/permissions', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ role, permissions }),
          })
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string }
            throw new Error(body.error ?? `Failed to save ${role} permissions`)
          }
          const updated = (await res.json()) as DbRolePermissions
          setServerData((prev) => ({ ...prev, [role]: updated }))
          setLocal((prev) => ({ ...prev, [role]: updated }))
        }),
      )

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
          restricted. Changes take effect immediately — no login required.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ROLES.map((role) => {
          const perms = local[role]
          const isAdmin = role === 'admin'
          const updatedAt = serverData[role]?.updated_at
          if (!perms) return null
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
                {updatedAt && !isAdmin && (
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    Last updated: {new Date(updatedAt).toLocaleString()}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {(Object.keys(PERMISSION_LABELS) as PermissionKey[]).map((perm) => (
                  <div key={perm} className="flex items-center justify-between gap-4">
                    <Label htmlFor={`${role}-${perm}`} className="text-sm cursor-pointer">
                      {PERMISSION_LABELS[perm]}
                    </Label>
                    <Switch
                      id={`${role}-${perm}`}
                      checked={perms[perm] as boolean}
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
