export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { PressLoginForm } from './_components/PressLoginForm'

export const metadata: Metadata = {
  title: 'Press Login — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default function PressLoginPage() {
  return <PressLoginForm />
}
