/**
 * app/admin/page.tsx — Admin dashboard (Server Component)
 *
 * The middleware.ts at the Edge guarantees only authenticated users reach here.
 * force-dynamic ensures this page is server-rendered on every request,
 * never served from a static cache.
 */

export const dynamic = 'force-dynamic'

import { AdminDashboardWrapper } from './_components/AdminDashboardWrapper'

export default function AdminPage() {
  return <AdminDashboardWrapper />
}
