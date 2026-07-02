export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CentralLoginForm } from './_components/CentralLoginForm'
import { getMetadataBrand, pageTitle } from '@/lib/seo/metadata'

export async function generateMetadata(): Promise<Metadata> {
  const { labelName } = await getMetadataBrand()
  return {
    title: pageTitle('Login', labelName),
    robots: { index: false, follow: false },
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <CentralLoginForm />
    </Suspense>
  )
}