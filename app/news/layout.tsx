import type { ReactNode } from 'react'
import { PageTransition } from '@/components/animations/PageTransition'

export default function NewsLayout({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
