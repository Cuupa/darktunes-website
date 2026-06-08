'use client'

/**
 * app/admin/_components/AdminClientLayout.tsx
 *
 * Client-side shell that wraps all /admin/* routes.
 * Provides:
 *  - AuthProvider context for useAuthContext() consumers
 *  - DictContext for useDict() consumers (admin error messages, i18n)
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
import { DictContext } from '@/contexts/DictContext'
import { AdminSidebarNav } from '@/components/admin/AdminSidebarNav'
import type { Dictionary } from '@/i18n/types'

interface AdminClientLayoutProps {
  children: React.ReactNode
  dict: Dictionary
}

export function AdminClientLayout({ children, dict }: AdminClientLayoutProps) {
  return (
    <AuthProvider>
      <DictContext.Provider value={dict}>
        {/* On mobile the sidebar renders as a sticky header + Sheet drawer;
            on ≥md it renders as a traditional left sidebar column.
            AdminSidebarNav handles both breakpoints internally. */}
        <div className="flex flex-col h-dvh overflow-hidden md:flex-row bg-background">
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
      </DictContext.Provider>
    </AuthProvider>
  )
}
