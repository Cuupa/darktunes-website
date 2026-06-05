'use client'

/**
 * app/_components/ConditionalSiteHeader.tsx
 *
 * Client component that suppresses its children on non-public routes.
 * This lets the SiteHeader (a Server Component) remain a Server Component
 * while still being conditionally shown based on the current pathname.
 *
 * Usage in layout.tsx:
 *   <NavHidingWrapper><SiteHeader /></NavHidingWrapper>
 */

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

/** Path prefixes where the public navbar must NOT be rendered. */
const HIDDEN_PREFIXES = ['/admin', '/portal', '/press', '/editor']

export function NavHidingWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const hidden = HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
  if (hidden) return null
  return <>{children}</>
}
