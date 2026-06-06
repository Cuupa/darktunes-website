export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../../_components/AdminPageShell'
import { Skeleton } from '@/components/ui/skeleton'

const UserDetailPanel = lazy(() =>
  import('@/components/admin/UserDetailPanel').then((m) => ({ default: m.UserDetailPanel })),
)

export default function AdminUserDetailPage() {
  return (
    <AdminPageShell
      title="User Detail"
      description="View and manage a user's roles, linked artists, and account status."
    >
      <Suspense
        fallback={
          <div className="space-y-4 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        }
      >
        <UserDetailPanel />
      </Suspense>
    </AdminPageShell>
  )
}
