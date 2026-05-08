'use client'

import { LoginForm } from '@/components/admin/LoginForm'
import { AuthProvider } from '@/contexts/AuthContext'

export function LoginPageWrapper() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  )
}
