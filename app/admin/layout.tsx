/**
 * app/admin/layout.tsx — Admin area layout (Server Component)
 *
 * This layout wraps all /admin/* routes. The auth protection is handled
 * by middleware.ts at the Edge before this layout ever renders.
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
