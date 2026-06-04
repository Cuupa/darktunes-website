import type { ReactNode } from 'react'
import { PageTransition } from '@/components/animations/PageTransition'

export default function ArtistsLayout({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
