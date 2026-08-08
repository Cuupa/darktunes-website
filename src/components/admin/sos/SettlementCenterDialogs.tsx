'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { MonthField } from '@/components/ui/month-field'
import { MoneyField, isMoneyInputValid } from '@/components/admin/sos/fields/AccountingNumberFields'
import { isValidIsoDateRange } from '@/lib/sos/accountingInputValidation'
import { monthToPeriodDate } from '@/lib/sos/lineItemsFromArtistData'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  fmtEur,
  type PaymentMethod,
} from '@/components/admin/sos/settlementCenterModel'
import type { SettlementCenterState } from '@/hooks/useSettlementCenter'
import { interpolate } from '@/lib/i18n/interpolate'
import { CircleNotch } from '@phosphor-icons/react'

interface SettlementCenterDialogsProps {
  settlement: SettlementCenterState
}

export function SettlementCenterDialogs({ settlement }: SettlementCenterDialogsProps) {
  const {
    t,
    correctionDialogOpen,
    setCorrectionDialogOpen,
    correctionTarget,
    setCorrectionTarget,
    correctionAmountEur,
    setCorrectionAmountEur,
    correctionNotes,
    setCorrectionNotes,
    correcting,
    correctionDeltaEur,
    runCorrection,
    paymentDialogOpen,
    setPaymentDialogOpen,
    selectedPaymentTargets,
    paymentAmountsEur,
    setPaymentAmountsEur,
    paymentMethod,
    setPaymentMethod,
    paymentReference,
    setPaymentReference,
    recordingPayment,
    runRecordPayment,
    defaultOutstandingEur,
    lockDialogOpen,
    setLockDialogOpen,
    locking,
    runLockPeriod,
    archiveDialogOpen,
    setArchiveDialogOpen,
    nextPeriodStart,
    setNextPeriodStart,
    nextPeriodEnd,
    setNextPeriodEnd,
    archiving,
    runArchivePeriod,
  } = settlement

  return (
    <>
      <Dialog
        open={correctionDialogOpen}
        onOpenChange={(open) => {
          setCorrectionDialogOpen(open)
          if (!open) setCorrectionTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.settlementCorrectionTitle}</DialogTitle>
            <DialogDescription>{t.settlementCorrectionDesc}</DialogDescription>
          </DialogHeader>
          {correctionTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{correctionTarget.artistName}</p>
                <p className="mt-1 text-muted-foreground">
                  {t.settlementPreviousAmount}{' '}
                  <span className="tabular-nums text-foreground">
                    {correctionTarget.statementAmountEur != null
                      ? fmtEur(correctionTarget.statementAmountEur)
                      : correctionTarget.payout != null
                        ? fmtEur(correctionTarget.payout)
                        : '—'}
                  </span>
                </p>
                {correctionDeltaEur != null && (
                  <p className="mt-1 text-muted-foreground">
                    {t.settlementChangeAmount}{' '}
                    <span
                      className={`tabular-nums ${
                        correctionDeltaEur > 0
                          ? 'text-emerald-300'
                          : correctionDeltaEur < 0
                            ? 'text-amber-300'
                            : 'text-foreground'
                      }`}
                    >
                      {correctionDeltaEur >= 0 ? '+' : ''}
                      {fmtEur(correctionDeltaEur)}
                    </span>
                  </p>
                )}
              </div>
              {correctionTarget.invoiceId && (
                <Alert className="border-amber-500/30 bg-amber-500/5">
                  <AlertDescription className="text-xs">
                    {t.settlementInvoiceExistsWarning}
                  </AlertDescription>
                </Alert>
              )}
              <MoneyField
                id="correction-amount"
                label={t.settlementCorrectedAmountLabel}
                value={correctionAmountEur}
                onChange={setCorrectionAmountEur}
                allowZero
                min={0}
                placeholder={t.settlementCorrectedAmountPlaceholder}
                messages={{
                  required: t.validationFieldRequired,
                  invalid: t.validationFieldInvalidNumber,
                  out_of_range: t.validationFieldOutOfRange,
                  too_many_decimals: t.validationAmountMaxDecimals,
                }}
              />
              <div className="space-y-2">
                <Label htmlFor="correction-notes">{t.settlementInternalNoteLabel}</Label>
                <Textarea
                  id="correction-notes"
                  value={correctionNotes}
                  onChange={(event) => setCorrectionNotes(event.target.value)}
                  placeholder={t.settlementCorrectionReasonPlaceholder}
                  className="min-h-[72px] resize-y"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionDialogOpen(false)}>
              {t.settlementCancel}
            </Button>
            <Button
              disabled={
                correcting ||
                !correctionTarget ||
                !isMoneyInputValid(correctionAmountEur, { allowZero: true, min: 0 })
              }
              onClick={() => void runCorrection()}
            >
              {correcting ? <CircleNotch size={16} className="animate-spin" /> : null}
              {t.settlementCreateCorrectionDraft}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.settlementPaymentTitle}</DialogTitle>
            <DialogDescription>
              {selectedPaymentTargets.length === 1
                ? t.settlementPaymentDescSingle
                : interpolate(t.settlementPaymentDescMulti, {
                    count: selectedPaymentTargets.length,
                  })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              {selectedPaymentTargets.map((target) => {
                if (!target.invoiceId) return null
                const outstanding = defaultOutstandingEur(target)
                return (
                  <div key={target.invoiceId} className="space-y-1.5 rounded-md border border-border p-3">
                    <Label htmlFor={`payment-amount-${target.invoiceId}`}>
                      {target.artistName}
                      {outstanding
                        ? interpolate(t.settlementOutstandingSuffix, { amount: outstanding })
                        : ''}
                    </Label>
                    <MoneyField
                      id={`payment-amount-${target.invoiceId}`}
                      value={paymentAmountsEur[target.invoiceId] ?? ''}
                      onChange={(value) =>
                        setPaymentAmountsEur((prev) => ({
                          ...prev,
                          [target.invoiceId!]: value,
                        }))
                      }
                      placeholder={t.settlementPaymentAmountPlaceholder}
                      messages={{
                        required: t.validationFieldRequired,
                        invalid: t.validationFieldInvalidNumber,
                        out_of_range: t.validationAmountPositive,
                        too_many_decimals: t.validationAmountMaxDecimals,
                      }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="space-y-2">
              <Label>{t.settlementPaymentMethod}</Label>
              <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sepa">SEPA</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="manual">{t.settlementPaymentManual}</SelectItem>
                  <SelectItem value="other">{t.settlementPaymentOther}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-reference">{t.settlementPaymentReferenceLabel}</Label>
              <Input
                id="payment-reference"
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
                placeholder={t.settlementPaymentReferencePlaceholder}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              {t.settlementCancel}
            </Button>
            <Button
              disabled={
                recordingPayment ||
                selectedPaymentTargets.filter((target) => target.invoiceId).length === 0 ||
                selectedPaymentTargets.some(
                  (target) =>
                    !!target.invoiceId &&
                    !isMoneyInputValid(paymentAmountsEur[target.invoiceId] ?? '', {
                      allowZero: false,
                    }),
                )
              }
              onClick={() => void runRecordPayment()}
            >
              {recordingPayment ? <CircleNotch size={16} className="animate-spin" /> : null}
              {t.settlementSavePayment}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.settlementLockTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.settlementLockDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.settlementCancel}</AlertDialogCancel>
            <AlertDialogAction disabled={locking} onClick={() => void runLockPeriod()}>
              {locking ? t.settlementLocking : t.settlementLockConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.settlementArchiveTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.settlementArchiveDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 py-2">
            <MonthField
              id="next-period-start"
              label={t.settlementNextPeriodStart}
              value={nextPeriodStart.length >= 7 ? nextPeriodStart.slice(0, 7) : nextPeriodStart}
              onChange={(ym) => {
                // Archive API expects full ISO dates; map month → first/last day.
                const start = monthToPeriodDate(ym, false) ?? `${ym}-01`
                setNextPeriodStart(start)
                const endOfMonth = monthToPeriodDate(ym, true) ?? start
                if (!nextPeriodEnd || nextPeriodEnd < start) {
                  setNextPeriodEnd(endOfMonth)
                }
              }}
              required
              max={
                nextPeriodEnd.length >= 7
                  ? nextPeriodEnd.slice(0, 7)
                  : undefined
              }
            />
            <MonthField
              id="next-period-end"
              label={t.settlementNextPeriodEnd}
              value={nextPeriodEnd.length >= 7 ? nextPeriodEnd.slice(0, 7) : nextPeriodEnd}
              onChange={(ym) => {
                setNextPeriodEnd(monthToPeriodDate(ym, true) ?? `${ym}-01`)
              }}
              required
              min={
                nextPeriodStart.length >= 7
                  ? nextPeriodStart.slice(0, 7)
                  : undefined
              }
              error={
                nextPeriodStart &&
                nextPeriodEnd &&
                !isValidIsoDateRange(nextPeriodStart, nextPeriodEnd)
                  ? t.validationInvalidDateRange
                  : undefined
              }
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.settlementCancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                archiving ||
                !nextPeriodStart ||
                !nextPeriodEnd ||
                !isValidIsoDateRange(nextPeriodStart, nextPeriodEnd)
              }
              onClick={() => void runArchivePeriod()}
            >
              {archiving ? t.settlementArchiving : t.settlementArchiveConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}