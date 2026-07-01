'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ReactLenis, useLenis } from 'lenis/react'
import { isDashboardRoute } from '@/lib/scroll/dashboardRoutes'
import { shouldPreventLenis } from '@/lib/scroll/lenisPrevent'

export { useLenis }

interface LenisProviderProps {
  children: ReactNode
}

function ScrollLockObserver() {
  const lenis = useLenis()

  useEffect(() => {
    if (!lenis) return
    const observer = new MutationObserver(() => {
      if (document.body.dataset.scrollLocked === '1') {
        lenis.stop()
      } else {
        lenis.start()
      }
    })
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-scroll-locked'],
    })
    return () => observer.disconnect()
  }, [lenis])

  return null
}

const LENIS_OPTIONS = {
  lerp: 0.08,
  duration: 0.55,
  easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  syncTouch: true,
  syncTouchLerp: 0.075,
  wheelMultiplier: 0.9,
  touchMultiplier: 1.3,
  infinite: false,
  prevent: shouldPreventLenis,
} as const

export function LenisProvider({ children }: LenisProviderProps) {
  const pathname = usePathname()
  const onDashboard = isDashboardRoute(pathname)

  if (onDashboard) {
    return <>{children}</>
  }

  return (
    <ReactLenis root options={LENIS_OPTIONS}>
      <ScrollLockObserver />
      {children}
    </ReactLenis>
  )
}