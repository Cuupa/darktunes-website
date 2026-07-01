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
 *  `ScrollableAppShell` owns vertical scroll for the main content pane.
 *  Lenis is not mounted on /admin/* so wheel events reach native scroll.
 *  Nested panels (e.g. file explorer with `fill`) may scroll
 *  internally; list managers must not add a root `overflow-y-auto` wrapper.
 *
 * Visual effects:
 *  VisualEffectsOverlay and ThemeEffectsClient are suppressed for
 *  /admin/* routes in app/layout.tsx via NavHidingWrapper.
 */

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import { AuthProvider } from '@/contexts/AuthContext'
import { AdminSidebarNav } from '@/components/admin/AdminSidebarNav'
import { ScrollableAppShell } from '@/components/layout/ScrollableAppShell'
import { isAdminListRoute } from '@/lib/scroll/dashboardRoutes'

interface AdminClientLayoutProps {
  children: React.ReactNode
}

export function AdminClientLayout({ children }: AdminClientLayoutProps) {
  const pathname = usePathname()
  const lockScroll = isAdminListRoute(pathname)

  return (
    <AuthProvider>
      {/* On mobile the sidebar renders as a sticky header + Sheet drawer;
          on ≥md it renders as a traditional left sidebar column.
          AdminSidebarNav handles both breakpoints internally. */}
      <ScrollableAppShell
        lockScroll={lockScroll}
        sidebar={<AdminSidebarNav />}
        footer={(
          <div className="py-4 text-center">
            <p className="text-xs text-muted-foreground/30 select-none">
              Platform by Neuroklast &amp; Seifried.dev
            </p>
          </div>
        )}
      >
        <Suspense>{children}</Suspense>
      </ScrollableAppShell>
    </AuthProvider>
  )
}
