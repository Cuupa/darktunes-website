'use client'

import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthProvider } from '@/contexts/AuthContext'
import { useAuthContext } from '@/contexts/AuthContext'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { Skeleton } from '@/components/ui/skeleton'

interface AdminDashboardWrapperProps {
  contentOnly?: boolean
  standalone?: boolean
}

function EditorAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { loading, isAuthenticated, profile } = useAuthContext()

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) {
      router.replace('/login?returnTo=/editor')
      return
    }
    if (profile?.role === 'admin') {
      router.replace('/admin')
      return
    }
    if (profile?.role !== 'editor') {
      router.replace('/login?error=unauthorized')
    }
  }, [loading, isAuthenticated, profile?.role, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" aria-busy="true" aria-label="Loading editor dashboard">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated || profile?.role !== 'editor') {
    return null
  }

  return children
}

export function AdminDashboardWrapper({ contentOnly = false, standalone = true }: AdminDashboardWrapperProps) {
  return (
    <AuthProvider>
      <EditorAuthGate>
        <Suspense>
          <AdminDashboard contentOnly={contentOnly} standalone={standalone} />
        </Suspense>
      </EditorAuthGate>
    </AuthProvider>
  )
}