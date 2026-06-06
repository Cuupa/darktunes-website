'use client'

/**
 * src/components/admin/UsersManager.tsx
 *
 * Admin User Management table.
 *
 * Features:
 *  - Lists all registered users with role, linked artist, ban status, last login
 *  - Role dropdown (select) per user row — own row is read-only
 *  - Ban / Unban with confirmation dialog
 *  - Delete with confirmation dialog
 *  - Link / Unlink artist via dropdown of unlinked artists
 *  - Client-side filter by email or role
 *  - Skeleton loading states consistent with ArtistsManager
 */

import { useState, useMemo } from 'react'
import {
  Users,
  LinkSimple,
  LinkBreak,
  Prohibit,
  CheckCircle,
  Trash,
  MagnifyingGlass,
  ClockCounterClockwise,
  EnvelopeSimple,
  UserPlus,
} from '@phosphor-icons/react'
import { useUsers } from '@/hooks/useUsers'
import { useArtists } from '@/hooks/useArtists'
import { useAuthContext } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { RoleChangeHistory } from '@/components/admin/RoleChangeHistory'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { UserWithProfile, UserRole } from '@/types/users'

// ---------------------------------------------------------------------------
// Skeleton rows — same column count as the real table
// ---------------------------------------------------------------------------

function UserSkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-8 w-28 rounded-md" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-8 w-32" /></TableCell>
        </TableRow>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Role badge
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: UserRole }) {
  const colours: Record<UserRole, string> = {
    admin: 'bg-violet-700 text-violet-100',
    artist: 'bg-emerald-700 text-emerald-100',
    editor: 'bg-blue-700 text-blue-100',
    journalist: 'bg-amber-700 text-amber-100',
    user: '',
  }
  return <Badge className={colours[role] || ''} variant={role === 'user' ? 'secondary' : undefined}>{role}</Badge>
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UsersManager() {
  const { user: currentUser } = useAuthContext()
  const { users, isLoading, updateRole, toggleBan, deleteUser, linkArtist, unlinkArtist } = useUsers()
  const { artists } = useArtists()

  // Filter state
  const [filter, setFilter] = useState('')

  // Confirmation dialogs
  const [banTarget, setBanTarget] = useState<UserWithProfile | null>(null)
  const [banReason, setBanReason] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<UserWithProfile | null>(null)

  // Artist link dialog
  const [linkTarget, setLinkTarget] = useState<UserWithProfile | null>(null)
  const [selectedArtistId, setSelectedArtistId] = useState<string>('')

  // History dialog
  const [historyTarget, setHistoryTarget] = useState<UserWithProfile | null>(null)

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('user')
  const [isInviting, setIsInviting] = useState(false)

  const [isMutating, setIsMutating] = useState(false)

  // IDs of artists already linked to some user
  const linkedArtistIds = useMemo(
    () => new Set(users.map((u) => u.linked_artist?.id).filter(Boolean)),
    [users],
  )

  // Artists not yet linked to any user (available for linking)
  const unlinkedArtists = useMemo(
    () => artists.filter((a) => !linkedArtistIds.has(a.id)),
    [artists, linkedArtistIds],
  )

  // Client-side filter
  const filteredUsers = useMemo(() => {
    if (!filter.trim()) return users
    const q = filter.toLowerCase()
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    )
  }, [users, filter])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRoleChange = async (user: UserWithProfile, role: UserRole) => {
    await updateRole(user.id, role)
  }

  const handleBanConfirm = async () => {
    if (!banTarget) return
    setIsMutating(true)
    try {
      await toggleBan(banTarget.id, !banTarget.banned_until, banReason || undefined)
    } finally {
      setIsMutating(false)
      setBanTarget(null)
      setBanReason('')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsMutating(true)
    try {
      await deleteUser(deleteTarget.id)
    } finally {
      setIsMutating(false)
      setDeleteTarget(null)
    }
  }

  const handleLinkConfirm = async () => {
    if (!linkTarget || !selectedArtistId) return
    setIsMutating(true)
    try {
      await linkArtist(linkTarget.id, selectedArtistId)
    } finally {
      setIsMutating(false)
      setLinkTarget(null)
      setSelectedArtistId('')
    }
  }

  const handleUnlink = async (user: UserWithProfile) => {
    setIsMutating(true)
    try {
      await unlinkArtist(user.id)
    } finally {
      setIsMutating(false)
    }
  }

  const handleInviteSubmit = async () => {
    if (!inviteEmail.trim()) return
    setIsInviting(true)
    try {
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to send invite')
        return
      }
      toast.success(`Invite sent to ${inviteEmail.trim()}`)
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole('user')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setIsInviting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isBanned = (u: UserWithProfile) =>
    !!u.banned_until && new Date(u.banned_until) > new Date()

  const isSelf = (u: UserWithProfile) => u.id === currentUser?.id

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">{users.length} user(s)</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInviteOpen(true)}
              className="gap-1.5"
            >
              <UserPlus size={14} aria-hidden="true" />
              Invite User
            </Button>
          </div>
          <div className="relative w-64">
            <MagnifyingGlass
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="Filter by email or role…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Linked Band</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <UserSkeletonRows />
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {filter ? 'No users match the filter.' : 'No users found.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((u) => {
                const self = isSelf(u)
                const banned = isBanned(u)

                return (
                  <TableRow key={u.id} className={banned ? 'opacity-60' : undefined}>
                    {/* Email */}
                    <TableCell className="font-mono text-sm">
                      {u.email}
                      {self && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          You
                        </Badge>
                      )}
                    </TableCell>

                    {/* Role dropdown */}
                    <TableCell>
                      {self ? (
                        <RoleBadge role={u.role} />
                      ) : (
                        <Select
                          value={u.role}
                          onValueChange={(v) => void handleRoleChange(u, v as UserRole)}
                        >
                          <SelectTrigger className="h-8 w-32 text-sm" aria-label={`Role for ${u.email}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="artist">artist</SelectItem>
                            <SelectItem value="editor">editor</SelectItem>
                            <SelectItem value="journalist">journalist</SelectItem>
                            <SelectItem value="user">user</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>

                    {/* Linked band */}
                    <TableCell className="text-sm">
                      {u.linked_artist ? (
                        <span className="text-foreground">{u.linked_artist.name}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {banned ? (
                        <Badge variant="destructive" className="gap-1">
                          <Prohibit size={11} aria-hidden="true" />
                          Banned
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-green-400 border-green-400/30">
                          <CheckCircle size={11} aria-hidden="true" />
                          Active
                        </Badge>
                      )}
                    </TableCell>

                    {/* Last login */}
                    <TableCell className="text-xs text-muted-foreground">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleDateString()
                        : '—'}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      {self ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-muted-foreground select-none">
                              read-only
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            Du kannst dich nicht selbst verwalten
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <div className="flex justify-end gap-1">
                          {/* View History */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setHistoryTarget(u)}
                                disabled={isMutating}
                                aria-label={`View history for ${u.email}`}
                              >
                                <ClockCounterClockwise size={15} aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View audit history</TooltipContent>
                          </Tooltip>

                          {/* Link / Unlink artist */}
                          {u.linked_artist ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => void handleUnlink(u)}
                                  disabled={isMutating}
                                  aria-label={`Unlink artist from ${u.email}`}
                                >
                                  <LinkBreak size={15} aria-hidden="true" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Unlink band</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setLinkTarget(u)
                                    setSelectedArtistId('')
                                  }}
                                  disabled={isMutating || unlinkedArtists.length === 0}
                                  aria-label={`Link artist to ${u.email}`}
                                >
                                  <LinkSimple size={15} aria-hidden="true" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {unlinkedArtists.length === 0
                                  ? 'All artists are already linked'
                                  : 'Link band'}
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {/* Ban / Unban */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setBanTarget(u)}
                                disabled={isMutating}
                                aria-label={banned ? `Unban ${u.email}` : `Ban ${u.email}`}
                                className={banned ? 'text-green-400 hover:text-green-400' : 'text-amber-500 hover:text-amber-500'}
                              >
                                {banned ? (
                                  <CheckCircle size={15} aria-hidden="true" />
                                ) : (
                                  <Prohibit size={15} aria-hidden="true" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{banned ? 'Unban user' : 'Ban user'}</TooltipContent>
                          </Tooltip>

                          {/* Delete */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeleteTarget(u)}
                                disabled={isMutating}
                                aria-label={`Delete ${u.email}`}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash size={15} aria-hidden="true" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete user</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Ban confirmation dialog */}
        <AlertDialog
          open={!!banTarget}
          onOpenChange={(open) => {
            if (!open) {
              setBanTarget(null)
              setBanReason('')
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {banTarget && isBanned(banTarget) ? 'Unban User' : 'Ban User'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {banTarget && isBanned(banTarget)
                  ? `Unban ${banTarget?.email}? They will be able to sign in again.`
                  : `Ban ${banTarget?.email}? They will not be able to sign in until unbanned.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="px-1 pb-2">
              <Textarea
                placeholder="Reason (optional)…"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isMutating}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBanConfirm}
                disabled={isMutating}
                className={
                  banTarget && isBanned(banTarget)
                    ? 'bg-green-700 hover:bg-green-700/90'
                    : 'bg-amber-600 hover:bg-amber-600/90 text-white'
                }
              >
                {banTarget && isBanned(banTarget) ? 'Unban' : 'Ban'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Permanently delete <strong>{deleteTarget?.email}</strong>? This action cannot be
                undone. Their profile and all associated data will be removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isMutating}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={isMutating}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Link artist dialog */}
        <Dialog
          open={!!linkTarget}
          onOpenChange={(open) => {
            if (!open) {
              setLinkTarget(null)
              setSelectedArtistId('')
            }
          }}
        >
          <DialogContent aria-describedby={undefined} aria-labelledby="users-link-dialog-title">
            <DialogHeader>
              <DialogTitle id="users-link-dialog-title">
                <div className="flex items-center gap-2">
                  <Users size={18} aria-hidden="true" />
                  Link Band to User
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Linking a band to <strong>{linkTarget?.email}</strong> gives them access to the
                Artist Portal for that band.
              </p>
              <Select value={selectedArtistId} onValueChange={setSelectedArtistId}>
                <SelectTrigger aria-label="Select artist to link">
                  <SelectValue placeholder="Select an artist…" />
                </SelectTrigger>
                <SelectContent>
                  {unlinkedArtists.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setLinkTarget(null)
                  setSelectedArtistId('')
                }}
                disabled={isMutating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleLinkConfirm}
                disabled={!selectedArtistId || isMutating}
              >
                Link Band
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {/* History dialog */}
        <Dialog
          open={!!historyTarget}
          onOpenChange={(open) => !open && setHistoryTarget(null)}
        >
          <DialogContent aria-describedby={undefined} aria-labelledby="users-history-dialog-title">
            <DialogHeader>
              <DialogTitle id="users-history-dialog-title">
                <div className="flex items-center gap-2">
                  <ClockCounterClockwise size={18} aria-hidden="true" />
                  Audit History — {historyTarget?.email}
                </div>
              </DialogTitle>
            </DialogHeader>
            {historyTarget && (
              <RoleChangeHistory userId={historyTarget.id} />
            )}
          </DialogContent>
        </Dialog>

        {/* Invite user dialog */}
        <Dialog
          open={inviteOpen}
          onOpenChange={(open) => {
            if (!open) {
              setInviteOpen(false)
              setInviteEmail('')
              setInviteRole('user')
            }
          }}
        >
          <DialogContent aria-describedby="invite-dialog-desc" aria-labelledby="invite-dialog-title">
            <DialogHeader>
              <DialogTitle id="invite-dialog-title">
                <div className="flex items-center gap-2">
                  <EnvelopeSimple size={18} aria-hidden="true" />
                  Invite New User
                </div>
              </DialogTitle>
            </DialogHeader>
            <p id="invite-dialog-desc" className="text-sm text-muted-foreground">
              An invitation email will be sent to the address below. The recipient can set their
              password and sign in immediately.
            </p>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleInviteSubmit() }}
                  disabled={isInviting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-role">Initial role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                  <SelectTrigger id="invite-role" aria-label="Select initial role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="artist">Artist</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="journalist">Journalist</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={isInviting}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleInviteSubmit()}
                disabled={!inviteEmail.trim() || isInviting}
              >
                <EnvelopeSimple size={14} className="mr-1.5" aria-hidden="true" />
                {isInviting ? 'Sending…' : 'Send Invite'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
