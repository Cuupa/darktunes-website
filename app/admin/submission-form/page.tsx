/**
 * app/admin/submission-form/page.tsx — Submission Form Schema
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../_components/AdminPageShell'

const SubmissionFormManager = lazy(() =>
  import('@/components/admin/SubmissionFormManager').then((m) => ({ default: m.SubmissionFormManager })),
)

export default function AdminSubmissionFormPage() {
  return (
    <AdminPageShell
      layout="list"
      title="Submission Form"
      description="Configure which fields appear in the release and video submission forms."
    >
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <SubmissionFormManager />
      </Suspense>
    </AdminPageShell>
  )
}