/**
 * app/admin/content/page.tsx — Content Management
 *
 * Hosts the existing AdminDashboard (Artists, Releases, News, Videos,
 * Release/Video Submissions, etc.) at the /admin/content route.
 * The ?tab= query param still works exactly as before.
 */

export const dynamic = 'force-dynamic'

import { AdminDashboardWrapper } from '../_components/AdminDashboardWrapper'

export default function AdminContentPage() {
  return <AdminDashboardWrapper />
}
