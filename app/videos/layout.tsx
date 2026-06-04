import type { ReactNode } from 'react'
import { PageTransition } from '@/components/animations/PageTransition'

export default function VideosLayout({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
