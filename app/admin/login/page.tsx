'use client'

/**
 * app/admin/login/page.tsx — Admin login page
 *
 * Renders the LoginForm client component.
 * If the user is already authenticated, middleware.ts redirects them to /admin
 * before this page renders.
 */

import { LoginForm } from '@/components/admin/LoginForm'
import { AuthProvider } from '@/contexts/AuthContext'

export default function AdminLoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  )
}
