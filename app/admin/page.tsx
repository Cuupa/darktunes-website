'use client'

/**
 * app/admin/page.tsx — Admin dashboard
 *
 * The middleware guarantees that only authenticated users reach this page.
 * We render the AdminDashboard client component which includes all CMS features.
 */

import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { AuthProvider } from '@/contexts/AuthContext'

export default function AdminPage() {
  return (
    <AuthProvider>
      <AdminDashboard />
    </AuthProvider>
  )
}
