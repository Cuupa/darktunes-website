'use client'

import { Suspense } from 'react'
import { AdminDashboard } from '@/components/admin/AdminDashboard'

interface AdminDashboardWrapperProps {
  contentOnly?: boolean
}

export function AdminDashboardWrapper({ contentOnly = false }: AdminDashboardWrapperProps) {
  return (
    <Suspense>
      <AdminDashboard contentOnly={contentOnly} />
    </Suspense>
  )
}
