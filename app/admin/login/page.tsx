/**
 * app/admin/login/page.tsx — Admin login page (Server Component)
 *
 * Renders the LoginPageWrapper client component.
 * If the user is already authenticated, middleware.ts redirects them to /admin
 * before this page renders.
 *
 * force-dynamic ensures this page is server-rendered on every request.
 */

export const dynamic = 'force-dynamic'

import { LoginPageWrapper } from '../_components/LoginPageWrapper'

export default function AdminLoginPage() {
  return <LoginPageWrapper />
}
