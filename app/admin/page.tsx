/**
 * app/admin/page.tsx — Admin dashboard overview (Server Component)
 *
 * The middleware.ts at the Edge guarantees only authenticated users reach here.
 * force-dynamic ensures this page is server-rendered on every request.
 */

export const dynamic = 'force-dynamic'

import { AdminOverviewWrapper } from './_components/AdminOverviewWrapper'

export default function AdminPage() {
  return <AdminOverviewWrapper />
}
