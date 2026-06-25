import type { Metadata } from 'next'
import { ApplyForm } from './_components/ApplyForm'

export const metadata: Metadata = {
  title: 'Apply for Press Access — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default function PressApplyPage() {
  return <ApplyForm />
}