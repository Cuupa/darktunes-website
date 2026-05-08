'use client'

import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { AuthProvider } from '@/contexts/AuthContext'

export function AdminDashboardWrapper() {
  return (
    <AuthProvider>
      <AdminDashboard />
    </AuthProvider>
  )
}
