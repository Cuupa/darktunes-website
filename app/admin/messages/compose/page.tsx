/**
 * app/admin/messages/compose/page.tsx — Full-page message composer
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { AdminPageShell } from '../../_components/AdminPageShell'
import { AdminComposeClient } from './_components/AdminComposeClient'

export default function AdminMessagesComposePage() {
  return (
    <AdminPageShell
      title="Compose Message"
      description="Write a new inbox message to one or more artists."
    >
      <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading composer…</div>}>
        <AdminComposeClient />
      </Suspense>
    </AdminPageShell>
  )
}
