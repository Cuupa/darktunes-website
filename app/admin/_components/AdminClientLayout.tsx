'use client'

/**
 * app/admin/_components/AdminClientLayout.tsx
 *
 * Client-side shell that wraps all /admin/* routes.
 * Provides:
 *  - AuthProvider context for useAuthContext() consumers
 *  - Persistent sidebar navigation (AdminSidebarNav)
 *  - Main content area that renders {children}
 */

import { Suspense } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { AdminSidebarNav } from '@/components/admin/AdminSidebarNav'

interface AdminClientLayoutProps {
  children: React.ReactNode
}

export function AdminClientLayout({ children }: AdminClientLayoutProps) {
  return (
    <AuthProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        <AdminSidebarNav />
        <main className="flex-1 overflow-y-auto flex flex-col">
          <Suspense><div className="flex-1">{children}</div></Suspense>
          <div className="py-4 text-center">
            <p className="text-xs text-muted-foreground/30 select-none">
              Platform by Neuroklast &amp; Seifried.dev
            </p>
          </div>
        </main>
      </div>
    </AuthProvider>
  )
}
