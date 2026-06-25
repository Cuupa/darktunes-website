'use client'

import { SettlementActionToolbar } from '@/components/admin/sos/SettlementActionToolbar'
import { SettlementCenterDialogs } from '@/components/admin/sos/SettlementCenterDialogs'
import { SettlementRegisterTable } from '@/components/admin/sos/SettlementRegisterTable'
import { SettlementWorkflowOverview } from '@/components/admin/sos/SettlementWorkflowOverview'
import type { SettlementCenterPanelProps } from '@/components/admin/sos/settlementCenterModel'
import { useSettlementCenter } from '@/hooks/useSettlementCenter'

export type { SettlementCenterPanelProps } from '@/components/admin/sos/settlementCenterModel'

export function SettlementCenterPanel({
  persistDisabled = false,
  territoryMetrics = [],
  merchOrderRows = [],
  bronzeBatchIds = [],
  ...hookProps
}: SettlementCenterPanelProps) {
  const settlement = useSettlementCenter({
    ...hookProps,
    territoryMetrics,
    merchOrderRows,
    bronzeBatchIds,
  })

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <SettlementWorkflowOverview settlement={settlement} persistDisabled={persistDisabled} />

      <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
        <SettlementActionToolbar settlement={settlement} />
        <SettlementRegisterTable settlement={settlement} />
      </div>

      <SettlementCenterDialogs settlement={settlement} />
    </div>
  )
}