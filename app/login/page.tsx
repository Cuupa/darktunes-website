export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CentralLoginForm } from './_components/CentralLoginForm'

export const metadata: Metadata = {
  title: 'Login — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <CentralLoginForm />
    </Suspense>
  )
}