/**
 * app/admin/statements/page.tsx — Sales Statements
 */

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Suspense, lazy } from 'react'
import { SealCheck } from '@phosphor-icons/react/dist/ssr'
import { AdminPageShell } from '../_components/AdminPageShell'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

const StatementsManager = lazy(() =>
  import('@/components/admin/StatementsManager').then((m) => ({ default: m.StatementsManager })),
)

export default function AdminStatementsPage() {
  return (
    <AdminPageShell
      title="Statements"
      description="Historische Übersicht aller hochgeladenen Royalty-Statements. Für Freigaben, Rechnungen und Zahlungen nutzen Sie die Abrechnungszentrale."
    >
      <Alert className="mb-6 border-primary/30 bg-primary/5">
        <SealCheck size={16} className="text-primary" />
        <AlertTitle className="text-sm">Abrechnungszentrale</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>
            Statements freigeben, Rechnungen verfolgen, Zahlungen erfassen und Perioden abschließen —
            alles in der Abrechnungszentrale unter Accounting.
          </span>
          <Button size="sm" className="shrink-0" asChild>
            <Link href="/admin/accounting">Zur Abrechnungszentrale</Link>
          </Button>
        </AlertDescription>
      </Alert>

      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <StatementsManager />
      </Suspense>
    </AdminPageShell>
  )
}