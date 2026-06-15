/**
 * app/admin/content/page.tsx
 *
 * Legacy redirect — the tab-based content management area has been replaced
 * by individual sidebar routes (/admin/artists, /admin/releases, etc.).
 */

export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

export default function AdminContentPage() {
  redirect('/admin/artists')
}
