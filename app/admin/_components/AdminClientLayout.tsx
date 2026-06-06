'use client'

/**
 * app/admin/_components/AdminClientLayout.tsx
 *
 * Client-side shell that wraps all /admin/* routes.
 * Provides:
 *  - AuthProvider context for useAuthContext() consumers
 *  - Persistent sidebar navigation (AdminSidebarNav)
 *  - Main content area that renders {children}
 *
 * Scroll behaviour:
 *  Each panel scrolls independently when the cursor is inside it — the
 *  sidebar scrolls its nav links and the main area scrolls page content.
 *  CSS `overscroll-behavior: contain` prevents scroll from leaking to the
 *  parent once a panel reaches its boundary.
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
      {/* On mobile the sidebar renders as a sticky header + Sheet drawer;
          on ≥md it renders as a traditional left sidebar column.
          AdminSidebarNav handles both breakpoints internally. */}
      <div className="flex flex-col md:flex-row md:h-screen bg-background md:overflow-hidden">
        <AdminSidebarNav />
        <main
          className="flex-1 overflow-y-auto flex flex-col"
          style={{ overscrollBehavior: 'contain' }}
        >
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
