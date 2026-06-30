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
 *
 *  `data-lenis-prevent` on both overflow containers tells the global Lenis
 *  smooth-scroll instance (LenisProvider) to yield wheel/touch events that
 *  originate inside those elements to the browser's native scroll handler.
 *  Without this attribute Lenis intercepts all events at document level,
 *  and mouse-wheel scrolling is silently blocked inside the admin panels.
 *
 * Visual effects:
 *  VisualEffectsOverlay and ThemeEffectsClient are suppressed for
 *  /admin/* routes in app/layout.tsx via NavHidingWrapper.
 */

import { Suspense } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { AdminSidebarNav } from '@/components/admin/AdminSidebarNav'
import { ScrollableAppShell } from '@/components/layout/ScrollableAppShell'

interface AdminClientLayoutProps {
  children: React.ReactNode
}

export function AdminClientLayout({ children }: AdminClientLayoutProps) {
  return (
    <AuthProvider>
      {/* On mobile the sidebar renders as a sticky header + Sheet drawer;
          on ≥md it renders as a traditional left sidebar column.
          AdminSidebarNav handles both breakpoints internally. */}
      <ScrollableAppShell
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
