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
          <main className="flex-1 flex flex-col min-h-0">
            <Suspense>
              {/* data-lenis-prevent tells Lenis (global smooth-scroll) to yield
                  wheel/touch events that originate inside this overflow container
                  to the browser's native scroll handler. Without it Lenis
                  intercepts all events at document level and the overflow-y-auto
                  panel cannot be scrolled. */}
              <div
                className="flex-1 overflow-y-auto min-h-0"
                style={{ overscrollBehavior: 'contain' }}
                data-lenis-prevent
              >
                {children}
              </div>
            </Suspense>
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
