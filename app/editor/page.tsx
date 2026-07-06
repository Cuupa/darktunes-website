export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { AdminDashboardWrapper } from '../admin/_components/AdminDashboardWrapper'
import { getMetadataBrand, pageTitle } from '@/lib/seo/metadata'

export async function generateMetadata(): Promise<Metadata> {
  const { labelName } = await getMetadataBrand()
  return {
    title: pageTitle('Editor', labelName),
    robots: { index: false, follow: false },
  }
}

export default function EditorPage() {
  return <AdminDashboardWrapper contentOnly />
}
