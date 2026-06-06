'use client'

import { Suspense } from 'react'
import { AdminDashboard } from '@/components/admin/AdminDashboard'

interface AdminDashboardWrapperProps {
  contentOnly?: boolean
  standalone?: boolean
}

export function AdminDashboardWrapper({ contentOnly = false, standalone = true }: AdminDashboardWrapperProps) {
  return (
    <Suspense>
      <AdminDashboard contentOnly={contentOnly} standalone={standalone} />
    </Suspense>
  )
}
