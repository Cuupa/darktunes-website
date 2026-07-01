'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { horizontalScrollClass } from '@/components/ui/scroll-panel'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Plus,
  Pencil,
  Trash,
  ArrowLeft,
  ArrowRight,
  MagnifyingGlass,
  ShieldCheck,
  Key,
  ClockCounterClockwise,
} from '@phosphor-icons/react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import { useTranslations } from 'next-intl'
import { getErrorMessage } from '@/lib/clientErrors'
import type { ApiErrorResponse } from '@/lib/errors'

type DbRolePermissions = Database['public']['Tables']['role_permissions']['Row']
type PermissionKey = Exclude<keyof DbRolePermissions, 'role' | 'updated_at' | 'updated_by'>
type CustomRole = Database['public']['Tables']['custom_roles']['Row'] & { permissions: string[] }
type CustomPermDef = Database['public']['Tables']['custom_permission_definitions']['Row']
type RbacAuditEntry = Database['public']['Tables']['rbac_audit_log']['Row']

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
  artist: 'Artist portal access is now membership-based (artist_members table). This role is legacy.',
  user: 'Unassigned user with no special privileges.',
}

type PermissionsMap = Partial<Record<Role, DbRolePermissions>>

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'medium' })
}

async function getAuthHeader(supabase: ReturnType<typeof createBrowserSupabaseClient>) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Please sign in to continue.')
  return { Authorization: 'Bearer ' + session.access_token }
}

// ---------------------------------------------------------------------------
// System Roles tab
// ---------------------------------------------------------------------------

function SystemRolesTab() {
  const tErrors = useTranslations('errors')
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving]   = useState(false)
  const [serverData, setServerData] = useState<PermissionsMap>({})
  const [local, setLocal]           = useState<PermissionsMap>({})

  const loadPermissions = useCallback(async () => {
    setIsLoading(true)
    try {
      const headers = await getAuthHeader(supabase)
      const res = await fetch('/api/admin/roles/permissions', { headers })
      if (!res.ok) { const body = (await res.json()) as ApiErrorResponse; throw new Error(getErrorMessage(body, tErrors)) }
      const rows = (await res.json()) as DbRolePermissions[]
      const map: PermissionsMap = {}
      for (const row of rows) map[row.role as Role] = row
      setServerData(map)
      setLocal(map)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors('SERVER_ERROR'))
    } finally {
      setIsLoading(false)
    }
  }, [supabase, tErrors])

  useEffect(() => { void loadPermissions() }, [loadPermissions])

  const toggle = (role: Role, perm: PermissionKey) => {
    if (role === 'admin') return
    setLocal((prev) => {
      const current = prev[role]
      if (!current) return prev
      return { ...prev, [role]: { ...current, [perm]: !current[perm] } }
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const headers = { ...(await getAuthHeader(supabase)), 'Content-Type': 'application/json' }
      const rolesToSave = (ROLES as readonly Role[]).filter((role) => {
        if (role === 'admin') return false
        const localRow = local[role]; const serverRow = serverData[role]
        if (!localRow || !serverRow) return false
        return (Object.keys(PERMISSION_LABELS) as PermissionKey[]).some(
          (perm) => localRow[perm] !== serverRow[perm],
        )
      })

      if (rolesToSave.length === 0) { toast.info('No changes to save'); return }

      await Promise.all(
        rolesToSave.map(async (role) => {
          const localRow = local[role]; if (!localRow) return
          const permissions: Partial<Record<PermissionKey, boolean>> = {}
          for (const perm of Object.keys(PERMISSION_LABELS) as PermissionKey[]) {
            permissions[perm] = localRow[perm]
          }
          const res = await fetch('/api/admin/roles/permissions', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ role, permissions }),
          })
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as ApiErrorResponse
            throw new Error(getErrorMessage(body, tErrors))
          }
          const updated = (await res.json()) as DbRolePermissions
          setServerData((prev) => ({ ...prev, [role]: updated }))
          setLocal((prev) => ({ ...prev, [role]: updated }))
        }),
      )
      toast.success('Role permissions saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors('SERVER_ERROR'))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading…</p>

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Configure permissions for built-in roles. Admin always has full access and cannot be
        restricted. Changes take effect immediately.
      </p>
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
                  {isAdmin && <Badge variant="outline" className="text-accent border-accent/50 text-xs">Full Access</Badge>}
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

// ---------------------------------------------------------------------------
// Custom Roles tab
// ---------------------------------------------------------------------------

interface RoleFormState {
  name: string
  label: string
  description: string
  permissions: string[]
}

function CustomRolesTab() {
  const tErrors = useTranslations('errors')
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [roles, setRoles]             = useState<CustomRole[]>([])
  const [permDefs, setPermDefs]       = useState<CustomPermDef[]>([])
  const [isLoading, setIsLoading]     = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomRole | null>(null)
  const [isSaving, setIsSaving]       = useState(false)
  const [form, setForm]               = useState<RoleFormState>({ name: '', label: '', description: '', permissions: [] })

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const headers = await getAuthHeader(supabase)
      const [rolesRes, permsRes] = await Promise.all([
        fetch('/api/admin/roles/custom', { headers }),
        fetch('/api/admin/roles/permissions-def', { headers }),
      ])
      if (!rolesRes.ok) { const body = (await rolesRes.json()) as ApiErrorResponse; throw new Error(getErrorMessage(body, tErrors)) }
      if (!permsRes.ok) { const body = (await permsRes.json()) as ApiErrorResponse; throw new Error(getErrorMessage(body, tErrors)) }
      setRoles((await rolesRes.json()) as CustomRole[])
      setPermDefs((await permsRes.json()) as CustomPermDef[])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors('SERVER_ERROR'))
    } finally {
      setIsLoading(false)
    }
  }, [supabase, tErrors])

  useEffect(() => { void loadData() }, [loadData])

  const openCreate = () => {
    setEditingRole(null)
    setForm({ name: '', label: '', description: '', permissions: [] })
    setShowForm(true)
  }

  const openEdit = (role: CustomRole) => {
    setEditingRole(role)
    setForm({ name: role.name, label: role.label, description: role.description ?? '', permissions: role.permissions })
    setShowForm(true)
  }

  const togglePerm = (perm: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }))
  }

  const handleSave = async () => {
    if (!form.label.trim()) { toast.error(tErrors('VALIDATION_ERROR')); return }
    if (!editingRole && !form.name.trim()) { toast.error(tErrors('VALIDATION_ERROR')); return }
    setIsSaving(true)
    try {
      const headers = { ...(await getAuthHeader(supabase)), 'Content-Type': 'application/json' }
      if (editingRole) {
        const res = await fetch(`/api/admin/roles/custom/${editingRole.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ label: form.label, description: form.description || null, permissions: form.permissions }),
        })
        if (!res.ok) throw new Error(getErrorMessage((await res.json().catch(() => ({}))) as ApiErrorResponse, tErrors))
      } else {
        const res = await fetch('/api/admin/roles/custom', {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: form.name, label: form.label, description: form.description || undefined, permissions: form.permissions }),
        })
        if (!res.ok) throw new Error(getErrorMessage((await res.json().catch(() => ({}))) as ApiErrorResponse, tErrors))
      }
      toast.success(editingRole ? 'Role updated' : 'Role created')
      setShowForm(false)
      void loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors('SERVER_ERROR'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const headers = await getAuthHeader(supabase)
      const res = await fetch(`/api/admin/roles/custom/${deleteTarget.id}`, { method: 'DELETE', headers })
      if (!res.ok) throw new Error(getErrorMessage((await res.json().catch(() => ({}))) as ApiErrorResponse, tErrors))
      toast.success('Role deleted')
      setDeleteTarget(null)
      void loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors('SERVER_ERROR'))
    }
  }

  // All available permission names (system + custom)
  const allPermissions = [
    ...Object.entries(PERMISSION_LABELS).map(([k, v]) => ({ name: k, label: v, isSystem: true })),
    ...permDefs.map((d) => ({ name: d.name, label: d.label, isSystem: false })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define additional roles beyond the 5 built-in system roles. Assign any combination of permissions.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} className="mr-1.5" aria-hidden="true" />
          New Role
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : roles.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No custom roles yet. Create one to get started.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{role.label}</CardTitle>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{role.name}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(role)} aria-label={`Edit ${role.label}`}>
                      <Pencil size={13} aria-hidden="true" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(role)} aria-label={`Delete ${role.label}`}>
                      <Trash size={13} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                {role.description && <CardDescription className="text-xs mt-1">{role.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                {role.permissions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No permissions assigned</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((p) => {
                      const pdef = allPermissions.find((ap) => ap.name === p)
                      return (
                        <Badge key={p} variant="secondary" className="text-xs">
                          {pdef?.label ?? p}
                        </Badge>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!isSaving) setShowForm(open) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRole ? `Edit role: ${editingRole.label}` : 'Create custom role'}</DialogTitle>
            <DialogDescription>
              {editingRole
                ? 'Update the display name, description, or permissions for this role.'
                : 'Define a new role with a unique machine name and assign permissions.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editingRole && (
              <div className="space-y-1.5">
                <Label htmlFor="cr-name" className="text-sm">
                  Machine name <span className="text-muted-foreground font-normal">(lowercase, underscores)</span>
                </Label>
                <Input
                  id="cr-name"
                  placeholder="e.g. moderator"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="cr-label" className="text-sm">Display name</Label>
              <Input id="cr-label" placeholder="e.g. Moderator" value={form.label} onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr-desc" className="text-sm">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea id="cr-desc" rows={2} placeholder="What can this role do?" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Permissions</Label>
              {allPermissions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No permissions defined. Create some in the Permissions tab.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto overscroll-contain pr-1" data-lenis-prevent>
                  {allPermissions.map(({ name, label, isSystem }) => (
                    <div key={name} className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-sm">{label}</span>
                        {isSystem && <Badge variant="outline" className="ml-1.5 text-[10px] py-0">system</Badge>}
                      </div>
                      <Switch
                        checked={form.permissions.includes(name)}
                        onCheckedChange={() => togglePerm(name)}
                        disabled={isSaving}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'Saving…' : editingRole ? 'Save changes' : 'Create role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role &quot;{deleteTarget?.label}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the role and remove it from all users it was assigned to. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => void handleDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom Permissions tab
// ---------------------------------------------------------------------------

function CustomPermissionsTab() {
  const tErrors = useTranslations('errors')
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [defs, setDefs]             = useState<CustomPermDef[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [editingDef, setEditingDef] = useState<CustomPermDef | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomPermDef | null>(null)
  const [isSaving, setIsSaving]     = useState(false)
  const [form, setForm]             = useState({ name: '', label: '', description: '' })

  const loadDefs = useCallback(async () => {
    setIsLoading(true)
    try {
      const headers = await getAuthHeader(supabase)
      const res = await fetch('/api/admin/roles/permissions-def', { headers })
      if (!res.ok) { const body = (await res.json()) as ApiErrorResponse; throw new Error(getErrorMessage(body, tErrors)) }
      setDefs((await res.json()) as CustomPermDef[])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors('SERVER_ERROR'))
    } finally {
      setIsLoading(false)
    }
  }, [supabase, tErrors])

  useEffect(() => { void loadDefs() }, [loadDefs])

  const openCreate = () => {
    setEditingDef(null)
    setForm({ name: '', label: '', description: '' })
    setShowForm(true)
  }

  const openEdit = (def: CustomPermDef) => {
    setEditingDef(def)
    setForm({ name: def.name, label: def.label, description: def.description ?? '' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.label.trim()) { toast.error(tErrors('VALIDATION_ERROR')); return }
    if (!editingDef && !form.name.trim()) { toast.error('Name is required'); return }
    setIsSaving(true)
    try {
      const headers = { ...(await getAuthHeader(supabase)), 'Content-Type': 'application/json' }
      if (editingDef) {
        const res = await fetch(`/api/admin/roles/permissions-def/${editingDef.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ label: form.label, description: form.description || null }),
        })
        if (!res.ok) throw new Error(getErrorMessage((await res.json().catch(() => ({}))) as ApiErrorResponse, tErrors))
      } else {
        const res = await fetch('/api/admin/roles/permissions-def', {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: form.name, label: form.label, description: form.description || undefined }),
        })
        if (!res.ok) throw new Error(getErrorMessage((await res.json().catch(() => ({}))) as ApiErrorResponse, tErrors))
      }
      toast.success(editingDef ? 'Permission updated' : 'Permission created')
      setShowForm(false)
      void loadDefs()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors('SERVER_ERROR'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const headers = await getAuthHeader(supabase)
      const res = await fetch(`/api/admin/roles/permissions-def/${deleteTarget.id}`, { method: 'DELETE', headers })
      if (!res.ok) throw new Error(getErrorMessage((await res.json().catch(() => ({}))) as ApiErrorResponse, tErrors))
      toast.success('Permission definition deleted')
      setDeleteTarget(null)
      void loadDefs()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors('SERVER_ERROR'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define reusable permission keys that can be assigned to custom roles.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} className="mr-1.5" aria-hidden="true" />
          New Permission
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : defs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No custom permissions yet.</p>
      ) : (
        <div className={horizontalScrollClass} data-lenis-prevent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {defs.map((def) => (
                <TableRow key={def.id}>
                  <TableCell className="font-mono text-xs">{def.name}</TableCell>
                  <TableCell className="text-sm">{def.label}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{def.description ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(def.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(def)} aria-label={`Edit ${def.label}`}>
                        <Pencil size={12} aria-hidden="true" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(def)} aria-label={`Delete ${def.label}`}>
                        <Trash size={12} aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!isSaving) setShowForm(open) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDef ? `Edit: ${editingDef.label}` : 'New permission definition'}</DialogTitle>
            <DialogDescription>
              Permission definitions provide reusable keys that can be assigned to custom roles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editingDef && (
              <div className="space-y-1.5">
                <Label htmlFor="pd-name" className="text-sm">Machine name</Label>
                <Input
                  id="pd-name"
                  placeholder="e.g. can_view_analytics"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pd-label" className="text-sm">Display label</Label>
              <Input id="pd-label" placeholder="e.g. View Analytics" value={form.label} onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pd-desc" className="text-sm">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea id="pd-desc" rows={2} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'Saving…' : editingDef ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.label}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the permission definition and will unassign it from any custom roles that use it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => void handleDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RBAC Audit Log tab
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  permission_change:           'Permission change',
  custom_role_created:         'Custom role created',
  custom_role_updated:         'Custom role updated',
  custom_role_deleted:         'Custom role deleted',
  custom_permission_created:   'Custom permission created',
  custom_permission_updated:   'Custom permission updated',
  custom_permission_deleted:   'Custom permission deleted',
}

function RbacAuditTab() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const tErrors = useTranslations('errors')
  const [entries, setEntries] = useState<RbacAuditEntry[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await getAuthHeader(supabase)
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      const res = await fetch(`/api/admin/rbac-audit?${params.toString()}`, { headers })
      if (!res.ok) throw new Error('Failed to load audit log')
      const body = (await res.json()) as { data: RbacAuditEntry[]; total: number }
      setEntries(body.data)
      setTotal(body.total)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErrors('SERVER_ERROR'))
    } finally {
      setLoading(false)
    }
  }, [supabase, page, tErrors])

  useEffect(() => { setPage(0) }, [search])
  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return entries
    return entries.filter(
      (e) =>
        e.action.includes(q) ||
        e.target_type.includes(q) ||
        (e.target_id ?? '').includes(q),
    )
  }, [entries, search])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="relative">
        <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Search action, target…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {total} entr{total === 1 ? 'y' : 'ies'}
          {totalPages > 1 && ` · Page ${page + 1} of ${totalPages}`}
        </p>
        <div className="flex gap-2">
          <Button size="icon" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
            <ArrowLeft size={14} />
          </Button>
          <Button size="icon" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
            <ArrowRight size={14} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No RBAC audit entries found.</p>
      ) : (
        <div className={horizontalScrollClass} data-lenis-prevent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => {
                const hasChanges = !!(entry.old_value || entry.new_value)
                const isExpanded = expanded === entry.id
                return (
                  <>
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(entry.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{entry.target_type}</TableCell>
                      <TableCell className="text-xs font-mono">{entry.target_id ?? '—'}</TableCell>
                      <TableCell>
                        {hasChanges ? (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            onClick={() => setExpanded(isExpanded ? null : entry.id)}
                          >
                            {isExpanded ? 'Hide' : 'Show'}
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && hasChanges && (
                      <TableRow key={`${entry.id}-detail`}>
                        <TableCell colSpan={5} className="bg-muted/30 pb-3 pt-0">
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            {entry.old_value && (
                              <div>
                                <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Before</p>
                                <pre className="text-xs font-mono bg-muted/50 rounded px-2 py-1.5 break-all whitespace-pre-wrap">
                                  {JSON.stringify(entry.old_value, null, 2)}
                                </pre>
                              </div>
                            )}
                            {entry.new_value && (
                              <div>
                                <p className="text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">After</p>
                                <pre className="text-xs font-mono bg-muted/50 rounded px-2 py-1.5 break-all whitespace-pre-wrap">
                                  {JSON.stringify(entry.new_value, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export function RolesManager() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Manage system role permissions, create custom roles and permissions, and review the RBAC audit trail.
      </p>
      <Tabs defaultValue="system">
        <TabsList>
          <TabsTrigger value="system" className="gap-1.5">
            <ShieldCheck size={14} aria-hidden="true" />
            System Roles
          </TabsTrigger>
          <TabsTrigger value="custom" className="gap-1.5">
            <ShieldCheck size={14} aria-hidden="true" />
            Custom Roles
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-1.5">
            <Key size={14} aria-hidden="true" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <ClockCounterClockwise size={14} aria-hidden="true" />
            Audit Log
          </TabsTrigger>
        </TabsList>
        <TabsContent value="system" className="mt-4">
          <SystemRolesTab />
        </TabsContent>
        <TabsContent value="custom" className="mt-4">
          <CustomRolesTab />
        </TabsContent>
        <TabsContent value="permissions" className="mt-4">
          <CustomPermissionsTab />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <RbacAuditTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
