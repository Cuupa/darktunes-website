/**
 * app/admin/api-keys/page.tsx — External API credentials (admin-only)
 */

export const dynamic = 'force-dynamic'

import { AdminPageShell } from '../_components/AdminPageShell'
import { AdminApiKeysWrapper } from '../_components/AdminApiKeysWrapper'

export default function AdminApiKeysPage() {
  return (
    <AdminPageShell
      title="API Keys"
      description="Manage encrypted credentials for external integrations (Spotify, Resend, YouTube, etc.)."
    >
      <AdminApiKeysWrapper />
    </AdminPageShell>
  )
}