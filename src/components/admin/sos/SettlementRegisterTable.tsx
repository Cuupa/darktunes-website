'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  canCorrectStatement,
  fmtCents,
  fmtDate,
  fmtEur,
  rowIsSelectable,
  type MasterRow,
} from '@/components/admin/sos/settlementCenterModel'
import {
  WorkflowProgressIcon,
  WorkflowStatusBadge,
} from '@/components/admin/sos/statementWorkflowUi'
import type { SettlementCenterState } from '@/hooks/useSettlementCenter'
import { interpolate } from '@/lib/i18n/interpolate'
import {
  CircleNotch,
  FileArrowUp,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
} from '@phosphor-icons/react'

function InvoiceStatusBadge({
  status,
  labels,
}: {
  status: string | undefined
  labels: Record<string, string>
}) {
  if (!status) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const className =
    status === 'paid'
      ? 'bg-emerald-600/90 text-white'
      : status === 'received' || status === 'partially_paid'
        ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
        : status === 'sent'
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
          : undefined

  return (
    <Badge variant="outline" className={className}>
      {labels[status] ?? status}
    </Badge>
  )
}

interface SettlementRegisterTableProps {
  settlement: SettlementCenterState
}

export function SettlementRegisterTable({ settlement }: SettlementRegisterTableProps) {
  const {
    t,
    invoiceStatusLabels,
    periodWritable,
    filter,
    setFilter,
    loading,
    filteredRows,
    selectableRows,
    allSelected,
    selectedArtists,
    toggleSelectAll,
    toggleArtist,
    busyArtists,
    creatingDrafts,
    approving,
    correcting,
    runDraftCreation,
    runApproval,
    openCorrectionDialog,
  } = settlement
  const renderRowActions = (row: MasterRow, isBusy: boolean) => (
    <div className="flex flex-wrap gap-2">
      {row.workflowStatus === 'not_uploaded' && row.artistId && periodWritable && (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy || creatingDrafts}
          onClick={() => void runDraftCreation([row])}
        >
          {isBusy ? <CircleNotch size={14} className="animate-spin" /> : <FileArrowUp size={14} />}
          {t.settlementDraftBtn}
        </Button>
      )}
      {row.workflowStatus === 'draft' && row.statementId && periodWritable && (
        <Button size="sm" disabled={approving} onClick={() => void runApproval([row.statementId!])}>
          <PaperPlaneTilt size={14} />
          {t.settlementApproveBtn}
        </Button>
      )}
      {canCorrectStatement(row) && periodWritable && (
        <Button
          size="sm"
          variant="outline"
          disabled={correcting}
          onClick={() => openCorrectionDialog(row)}
          aria-label={interpolate(t.settlementCorrectionAria, { artist: row.artistName })}
        >
          <PencilSimple size={14} />
          {t.settlementCorrectionBtn}
        </Button>
      )}
      {(row.workflowStatus === 'artist_notified' ||
        row.workflowStatus === 'acknowledged' ||
        row.workflowStatus === 'label_approved' ||
        row.workflowStatus === 'viewed' ||
        row.workflowStatus === 'invoiced' ||
        row.workflowStatus === 'paid') && <WorkflowProgressIcon complete />}
    </div>
  )

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlass
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t.settlementFilterPlaceholder}
            className="pl-8 h-9"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={toggleSelectAll} disabled={selectableRows.length === 0}>
          {allSelected ? t.settlementDeselectAll : t.settlementSelectActionable}
        </Button>
      </div>

      <div className="space-y-3 border-b border-border p-4 lg:hidden">
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t.settlementLoadingRegister}</p>
        ) : filteredRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t.settlementNoArtistsFilter}</p>
        ) : (
          filteredRows.map((row) => {
            const actionable = rowIsSelectable(row)
            const isBusy = busyArtists.has(row.artistName)
            return (
              <div key={row.artistName} className="rounded-lg border border-border bg-card/30 p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{row.artistName}</p>
                    <WorkflowStatusBadge status={row.workflowStatus} />
                  </div>
                  {actionable && (
                    <Checkbox
                      checked={selectedArtists.has(row.artistName)}
                      onCheckedChange={() => toggleArtist(row.artistName)}
                      aria-label={interpolate(t.settlementSelectArtist, { artist: row.artistName })}
                    />
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">{t.settlementColViewed}</dt>
                    <dd>{fmtDate(row.firstViewedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t.settlementColInvoice}</dt>
                    <dd>
                      <InvoiceStatusBadge status={row.invoiceStatus} labels={invoiceStatusLabels} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t.settlementColOpenBalance}</dt>
                    <dd className="tabular-nums">{fmtEur(row.ledgerBalanceEur)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t.settlementColCarryForward}</dt>
                    <dd className="tabular-nums">
                      {row.carryForwardEur != null ? fmtEur(row.carryForwardEur) : '—'}
                    </dd>
                  </div>
                </dl>
                {renderRowActions(row, isBusy)}
              </div>
            )
          })
        )}
      </div>

      <div className="hidden lg:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label={t.settlementSelectActionableAria}
                  disabled={selectableRows.length === 0}
                />
              </TableHead>
              <TableHead>{t.settlementColArtist}</TableHead>
              <TableHead>{t.settlementColStatement}</TableHead>
              <TableHead>{t.settlementColViewed}</TableHead>
              <TableHead>{t.settlementColInvoice}</TableHead>
              <TableHead>{t.settlementColReceived}</TableHead>
              <TableHead>{t.settlementColPaid}</TableHead>
              <TableHead className="text-right">{t.settlementColOpenBalance}</TableHead>
              <TableHead className="text-right">{t.settlementColCarryForward}</TableHead>
              <TableHead className="text-right">{t.settlementColActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  {t.settlementLoadingRegister}
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  {t.settlementNoArtistsFilter}
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => {
                const actionable = rowIsSelectable(row)
                const isBusy = busyArtists.has(row.artistName)

                return (
                  <TableRow key={row.artistName}>
                    <TableCell>
                      <Checkbox
                        checked={selectedArtists.has(row.artistName)}
                        onCheckedChange={() => toggleArtist(row.artistName)}
                        aria-label={interpolate(t.settlementSelectArtist, { artist: row.artistName })}
                        disabled={!actionable}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{row.artistName}</TableCell>
                    <TableCell>
                      <WorkflowStatusBadge status={row.workflowStatus} />
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(row.firstViewedAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <InvoiceStatusBadge status={row.invoiceStatus} labels={invoiceStatusLabels} />
                        {row.invoiceNumber && (
                          <span className="text-[10px] text-muted-foreground">{row.invoiceNumber}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(row.receivedAt)}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span>{fmtDate(row.paidAt)}</span>
                        {row.paidAmountCents > 0 && (
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {fmtCents(row.paidAmountCents)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          row.ledgerBalanceEur > 0
                            ? 'text-amber-300'
                            : row.ledgerBalanceEur < 0
                              ? 'text-sky-300'
                              : undefined
                        }
                      >
                        {fmtEur(row.ledgerBalanceEur)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.carryForwardEur != null ? fmtEur(row.carryForwardEur) : '—'}
                    </TableCell>
                    <TableCell className="text-right">{renderRowActions(row, isBusy)}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}