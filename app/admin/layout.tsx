/**
 * app/admin/layout.tsx — Admin area layout (Server Component)
 *
 * This layout wraps all /admin/* routes. The auth protection is handled
 * by middleware.ts at the Edge before this layout ever renders.
 *
 * Renders a persistent sidebar navigation via AdminClientLayout (client).
 * The login and artists/news sub-routes opt out by being outside this scope
 * or by using their own full-page layouts.
 */

import type { Metadata } from 'next'
import { AdminClientLayout } from './_components/AdminClientLayout'

export const metadata: Metadata = {
  title: 'Admin — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminClientLayout>{children}</AdminClientLayout>
}
