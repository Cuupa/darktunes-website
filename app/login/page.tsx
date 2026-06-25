export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { CentralLoginForm } from './_components/CentralLoginForm'

export const metadata: Metadata = {
  title: 'Login — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return <CentralLoginForm />
}