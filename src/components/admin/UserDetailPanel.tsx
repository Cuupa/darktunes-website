'use client'

/**
 * src/components/admin/UserDetailPanel.tsx
 *
 * Admin User Detail view — accessible at /admin/users/:id
 *
 * Features:
 *  - Header with email, created/last-login dates
 *  - Multi-role management (add / remove individual roles)
 *  - All linked artist memberships (add / remove / change member_role)
 *  - Ban / Unban with reason
 *  - Delete account (danger zone)
 *  - Role-change + ban audit history timeline
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  LinkSimple,
  LinkBreak,
  Prohibit,
  CheckCircle,
  Trash,
  Plus,
  X,
  ClockCounterClockwise,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { RoleChangeHistory } from '@/components/admin/RoleChangeHistory'
import type { UserWithProfile, UserRole } from '@/types/users'
import type { Artist } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_ROLES: UserRole[] = ['admin', 'editor', 'journalist', 'artist', 'user']

const ROLE_COLOURS: Record<UserRole, string> = {
  admin: 'bg-violet-700 text-violet-100',
  artist: 'bg-emerald-700 text-emerald-100',
  editor: 'bg-blue-700 text-blue-100',
  journalist: 'bg-amber-700 text-amber-100',
  press: 'bg-cyan-700 text-cyan-100',
  user: '',
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge
      className={ROLE_COLOURS[role] || ''}
      variant={role === 'user' ? 'secondary' : undefined}
    >
      {role}
    </Badge>
  )
}

function isBanned(user: UserWithProfile): boolean {
  return !!user.banned_until && new Date(user.banned_until) > new Date()
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UserDetailPanel() {
  const params = useParams()
  const router = useRouter()
  const userId = params['id'] as string
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  // Data
  const [user, setUser] = useState<UserWithProfile | null>(null)
  const [allArtists, setAllArtists] = useState<Artist[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)

  // UI state
  const [showHistory, setShowHistory] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [showBanDialog, setShowBanDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [addRoleValue, setAddRoleValue] = useState<UserRole | ''>('')
  const [linkArtistId, setLinkArtistId] = useState('')
  const [linkMemberRole, setLinkMemberRole] = useState<'owner' | 'member' | 'guest'>('owner')
  const [showLinkDialog, setShowLinkDialog] = useState(false)

  // ---------------------------------------------------------------------------
  // Fetch helpers
  // ---------------------------------------------------------------------------

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')
    return session.access_token
  }, [supabase])

  const authHeaders = useCallback(async (): Promise<HeadersInit> => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + (await getToken()),
  }), [getToken])

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const headers = await authHeaders()
      const [usersRes, artistsRes] = await Promise.all([
        fetch('/api/admin/users', { headers }),
        fetch('/api/admin/artists', { headers }),
      ])

      if (!usersRes.ok) throw new Error('Failed to load users')
      const { users } = (await usersRes.json()) as { users: UserWithProfile[] }
      const found = users.find((u) => u.id === userId)
      if (!found) {
        toast.error('User not found')
        router.push('/admin/users')
        return
      }
      setUser(found)

      if (artistsRes.ok) {
        const { artists } = (await artistsRes.json()) as { artists: Artist[] }
        setAllArtists(artists)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load user')
    } finally {
      setIsLoading(false)
    }
  }, [authHeaders, userId, router])

  useEffect(() => { void load() }, [load])

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const addRole = async (role: UserRole) => {
    setIsMutating(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ addRole: role }),
      })
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Failed')
      toast.success(`Role "${role}" added`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add role')
    } finally {
      setIsMutating(false)
      setAddRoleValue('')
    }
  }

  const removeRole = async (role: UserRole) => {
    setIsMutating(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ removeRole: role }),
      })
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Failed')
      toast.success(`Role "${role}" removed`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove role')
    } finally {
      setIsMutating(false)
    }
  }

  const handleBanToggle = async () => {
    if (!user) return
    const newBan = !isBanned(user)
    setIsMutating(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ ban: newBan, ...(banReason ? { reason: banReason } : {}) }),
      })
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Failed')
      toast.success(newBan ? 'User banned' : 'User unbanned')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ban operation failed')
    } finally {
      setIsMutating(false)
      setShowBanDialog(false)
      setBanReason('')
    }
  }

  const handleDelete = async () => {
    setIsMutating(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      })
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Failed')
      toast.success('User deleted')
      router.push('/admin/users')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
      setIsMutating(false)
      setShowDeleteDialog(false)
    }
  }

  const handleLinkArtist = async () => {
    if (!linkArtistId) return
    setIsMutating(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/link-artist`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ artistId: linkArtistId, memberRole: linkMemberRole }),
      })
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Failed')
      toast.success('Artist linked')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Link failed')
    } finally {
      setIsMutating(false)
      setShowLinkDialog(false)
      setLinkArtistId('')
    }
  }

  const handleUnlinkArtist = async (artistId: string) => {
    setIsMutating(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/link-artist`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ artistId, remove: true }),
      })
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? 'Failed')
      toast.success('Artist unlinked')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unlink failed')
    } finally {
      setIsMutating(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const linkedArtistIds = useMemo(
    () => new Set((user?.linked_artists ?? []).map((a) => a.id)),
    [user],
  )

  const availableArtists = useMemo(
    () => allArtists.filter((a) => !linkedArtistIds.has(a.id)),
    [allArtists, linkedArtistIds],
  )

  const availableRolesToAdd = useMemo(
    () => ALL_ROLES.filter((r) => !(user?.roles ?? []).includes(r)),
    [user],
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (!user) return null

  const banned = isBanned(user)

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back navigation */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/users">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" />
          Back to Users
        </Link>
      </Button>

      {/* User header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-lg">{user.email}</span>
            {banned && <Badge variant="destructive">Banned</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Created: </span>
            {new Date(user.created_at).toLocaleString()}
          </div>
          <div>
            <span className="font-medium text-foreground">Last login: </span>
            {user.last_sign_in_at
              ? new Date(user.last_sign_in_at).toLocaleString()
              : '—'}
          </div>
          {user.banned_until && (
            <div className="col-span-2">
              <span className="font-medium text-foreground">Banned until: </span>
              {new Date(user.banned_until).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Roles card */}
      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current roles */}
          <div className="flex flex-wrap gap-2">
            {(user.roles.length > 0 ? user.roles : [user.role]).map((role) => (
              <div key={role} className="flex items-center gap-1">
                <RoleBadge role={role} />
                <button
                  onClick={() => void removeRole(role)}
                  disabled={isMutating}
                  aria-label={`Remove role ${role}`}
                  className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
            {user.roles.length === 0 && (
              <span className="text-sm text-muted-foreground">No roles assigned</span>
            )}
          </div>

          {/* Add role */}
          {availableRolesToAdd.length > 0 && (
            <div className="flex items-center gap-2">
              <Select
                value={addRoleValue}
                onValueChange={(v) => setAddRoleValue(v as UserRole)}
              >
                <SelectTrigger className="h-8 w-36 text-sm" aria-label="Select role to add">
                  <SelectValue placeholder="Add role…" />
                </SelectTrigger>
                <SelectContent>
                  {availableRolesToAdd.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addRoleValue && void addRole(addRoleValue as UserRole)}
                disabled={!addRoleValue || isMutating}
              >
                <Plus size={14} className="mr-1" aria-hidden="true" />
                Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked Artists card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Linked Artists</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setLinkArtistId('')
              setShowLinkDialog(true)
            }}
            disabled={isMutating || availableArtists.length === 0}
          >
            <LinkSimple size={14} className="mr-1" aria-hidden="true" />
            Link Artist
          </Button>
        </CardHeader>
        <CardContent>
          {user.linked_artists.length === 0 ? (
            <p className="text-sm text-muted-foreground">No artists linked.</p>
          ) : (
            <ul className="space-y-2">
              {user.linked_artists.map((a) => (
                <li key={a.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{a.name}</span>
                    <Badge variant="outline" className="text-xs">{a.member_role}</Badge>
                  </div>
                  <button
                    onClick={() => void handleUnlinkArtist(a.id)}
                    disabled={isMutating}
                    aria-label={`Unlink ${a.name}`}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                  >
                    <LinkBreak size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Audit history */}
      <Card>
        <CardHeader
          className="flex flex-row items-center justify-between space-y-0 cursor-pointer"
          onClick={() => setShowHistory((v) => !v)}
          role="button"
          aria-expanded={showHistory}
        >
          <CardTitle className="flex items-center gap-2">
            <ClockCounterClockwise size={18} aria-hidden="true" />
            Audit History
          </CardTitle>
          <span className="text-xs text-muted-foreground">{showHistory ? 'Hide' : 'Show'}</span>
        </CardHeader>
        {showHistory && (
          <CardContent>
            <RoleChangeHistory userId={userId} />
          </CardContent>
        )}
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant={banned ? 'outline' : 'destructive'}
            size="sm"
            onClick={() => setShowBanDialog(true)}
            disabled={isMutating}
            className={banned ? 'border-green-500 text-green-400 hover:bg-green-500/10' : ''}
          >
            {banned ? (
              <><CheckCircle size={14} className="mr-1" aria-hidden="true" />Unban User</>
            ) : (
              <><Prohibit size={14} className="mr-1" aria-hidden="true" />Ban User</>
            )}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isMutating}
          >
            <Trash size={14} className="mr-1" aria-hidden="true" />
            Delete Account
          </Button>
        </CardContent>
      </Card>

      {/* Ban dialog */}
      <AlertDialog open={showBanDialog} onOpenChange={setShowBanDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{banned ? 'Unban' : 'Ban'} {user.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              {banned
                ? 'The user will regain access immediately.'
                : 'The user will be locked out. Provide an optional reason.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!banned && (
            <div className="px-1">
              <Label htmlFor="ban-reason">Reason (optional)</Label>
              <Textarea
                id="ban-reason"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Reason for ban…"
                className="mt-1"
                rows={2}
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleBanToggle()}
              className={banned ? '' : 'bg-destructive hover:bg-destructive/90'}
              disabled={isMutating}
            >
              {banned ? 'Unban' : 'Ban'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {user.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              This is permanent. All data associated with this user will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-destructive hover:bg-destructive/90"
              disabled={isMutating}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link artist dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Artist to {user.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="link-artist">Artist</Label>
              <Select value={linkArtistId} onValueChange={setLinkArtistId}>
                <SelectTrigger id="link-artist" className="mt-1">
                  <SelectValue placeholder="Select artist…" />
                </SelectTrigger>
                <SelectContent>
                  {availableArtists.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="member-role">Member Role</Label>
              <Select
                value={linkMemberRole}
                onValueChange={(v) => setLinkMemberRole(v as 'owner' | 'member' | 'guest')}
              >
                <SelectTrigger id="member-role" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">owner</SelectItem>
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="guest">guest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleLinkArtist()}
                disabled={!linkArtistId || isMutating}
              >
                Link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
