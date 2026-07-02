/**
 * app/admin/statements/page.tsx — Sales Statements
 */

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Suspense, lazy } from 'react'
import { getTranslations } from 'next-intl/server'
import { SealCheck } from '@phosphor-icons/react/dist/ssr'
import { AdminPageShell } from '../_components/AdminPageShell'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

const StatementsManager = lazy(() =>
  import('@/components/admin/StatementsManager').then((m) => ({ default: m.StatementsManager })),
)

export default async function AdminStatementsPage() {
  const t = await getTranslations('admin.accounting')

  return (
    <AdminPageShell
      title={t('statementsPageTitle')}
      description={t('statementsPageDescription')}
    >
      <Alert className="mb-6 border-primary/30 bg-primary/5">
        <SealCheck size={16} className="text-primary" />
        <AlertTitle className="text-sm">{t('subTabSettlements')}</AlertTitle>
        <AlertDescription className="flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>{t('statementsSettlementAlertBody')}</span>
          <Button size="sm" className="shrink-0" asChild>
            <Link href="/admin/accounting?subTab=settlements">{t('statementsSettlementCta')}</Link>
          </Button>
        </AlertDescription>
      </Alert>

      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">{t('historyLoadingAria')}</div>}>
        <StatementsManager readOnly settlementHref="/admin/accounting?subTab=settlements" hideReadOnlyBanner />
      </Suspense>
    </AdminPageShell>
  )
}