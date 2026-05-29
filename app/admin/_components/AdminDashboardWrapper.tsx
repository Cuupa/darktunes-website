'use client'

import { Suspense } from 'react'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { AuthProvider } from '@/contexts/AuthContext'

export function AdminDashboardWrapper() {
  return (
    <AuthProvider>
      <Suspense>
        <AdminDashboard />
      </Suspense>
    </AuthProvider>
  )
}
