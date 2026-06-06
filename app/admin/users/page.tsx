/**
 * app/admin/users/page.tsx — User Management
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../_components/AdminPageShell'

const UsersManager = lazy(() =>
  import('@/components/admin/UsersManager').then((m) => ({ default: m.UsersManager })),
)

export default function AdminUsersPage() {
  return (
    <AdminPageShell title="User Management" description="Manage registered users: assign roles, ban/unban accounts, link artists, or delete users.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <UsersManager />
      </Suspense>
    </AdminPageShell>
  )
}
