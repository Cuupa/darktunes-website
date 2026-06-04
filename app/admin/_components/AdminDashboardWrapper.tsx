'use client'

import { Suspense } from 'react'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { AuthProvider } from '@/contexts/AuthContext'

interface AdminDashboardWrapperProps {
  contentOnly?: boolean
}

export function AdminDashboardWrapper({ contentOnly = false }: AdminDashboardWrapperProps) {
  return (
    <AuthProvider>
      <Suspense>
        <AdminDashboard contentOnly={contentOnly} />
      </Suspense>
    </AuthProvider>
  )
}
