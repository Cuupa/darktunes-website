/**
 * app/admin/messages/page.tsx — Artist Messages
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../../_components/AdminPageShell'

const MessagesManager = lazy(() =>
  import('@/components/admin/MessagesManager').then((m) => ({ default: m.MessagesManager })),
)

export default function AdminMessagesPage() {
  return (
    <AdminPageShell title="Artist Messages" description="Send inbox messages to artists and track read status.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <MessagesManager />
      </Suspense>
    </AdminPageShell>
  )
}
