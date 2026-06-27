import { jsPDF } from 'jspdf'
import type { TourStop } from '@/types'
import type { DaySchedule, DealStructure, MerchSettlement, Settlement } from '@/lib/tour-planner/types'

export interface TourPlannerPdfLabels {
  daySheet: string
  schedule: string
  venue: string
  date: string
  show: string
  tbd: string
  getIn: string
  soundcheck: string
  doors: string
  stageTime: string
  curfew: string
  settlement: string
  ticketsSold: string
  ticketPrice: string
  grossRevenue: string
  venueCosts: string
  netRevenue: string
  artistPayment: string
  notes: string
  merchSettlement: string
  hallFee: string
  itemsSold: string
  signedAt: string
  signature: string
}

function formatMoney(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
}

function writeLines(doc: jsPDF, lines: string[], startY = 16): void {
  doc.setFontSize(11)
  lines.forEach((line, i) => doc.text(line, 14, startY + i * 7))
}

export function downloadDaySheetPdf(
  stop: TourStop,
  schedule: DaySchedule,
  labels: TourPlannerPdfLabels,
): void {
  const doc = new jsPDF()
  const s = schedule
  const lines = [
    `${labels.daySheet} — ${stop.venueName ?? labels.show}`,
    `${labels.date}: ${stop.stopDate}`,
    '',
    labels.schedule,
    `${labels.getIn}: ${s.getIn ?? labels.tbd}`,
    `${labels.soundcheck}: ${s.soundcheck ?? labels.tbd}`,
    `${labels.doors}: ${s.doors ?? labels.tbd}`,
    `${labels.stageTime}: ${s.stageTime ?? labels.tbd}`,
    `${labels.curfew}: ${s.curfew ?? labels.tbd}`,
    '',
    labels.venue,
    stop.venueAddress ?? '',
    `${stop.venueCity ?? ''}, ${stop.venueCountry ?? ''}`,
  ]
  writeLines(doc, lines)
  doc.save(`day-sheet-${stop.stopDate}.pdf`)
}

export function downloadSettlementPdf(
  stop: TourStop,
  settlement: Settlement,
  deal: DealStructure | null,
  labels: TourPlannerPdfLabels,
): void {
  const doc = new jsPDF()
  const currency = deal?.currency ?? 'EUR'
  const lines = [
    `${labels.settlement} — ${stop.venueName ?? labels.show}`,
    `${labels.date}: ${stop.stopDate}`,
    '',
    `${labels.ticketsSold}: ${settlement.ticketsSold}`,
    `${labels.ticketPrice}: ${formatMoney(settlement.ticketPrice, currency)}`,
    `${labels.grossRevenue}: ${formatMoney(settlement.grossRevenue, currency)}`,
    `${labels.venueCosts}: ${formatMoney(settlement.venueCosts, currency)}`,
    `${labels.netRevenue}: ${formatMoney(settlement.netRevenue, currency)}`,
    `${labels.artistPayment}: ${formatMoney(settlement.artistPayment, currency)}`,
  ]
  if (settlement.notes) lines.push('', `${labels.notes}:`, settlement.notes)
  if (settlement.venueRepSignature) {
    lines.push('', `${labels.signature}: ${settlement.venueRepSignature}`)
  }
  if (settlement.signedAt) lines.push(`${labels.signedAt}: ${settlement.signedAt}`)
  writeLines(doc, lines)
  doc.save(`settlement-${stop.stopDate}.pdf`)
}

export function downloadMerchSettlementPdf(
  stop: TourStop,
  settlement: MerchSettlement,
  labels: TourPlannerPdfLabels,
): void {
  const doc = new jsPDF()
  const soldTotal = Object.values(settlement.sold).reduce((sum, qty) => sum + qty, 0)
  const lines = [
    `${labels.merchSettlement} — ${stop.venueName ?? labels.show}`,
    `${labels.date}: ${stop.stopDate}`,
    '',
    `${labels.grossRevenue}: ${formatMoney(settlement.grossRevenue)}`,
    `${labels.hallFee}: ${formatMoney(settlement.hallFee)}`,
    `${labels.netRevenue}: ${formatMoney(settlement.netRevenue)}`,
    `${labels.itemsSold}: ${soldTotal}`,
  ]
  if (settlement.notes) lines.push('', `${labels.notes}:`, settlement.notes)
  if (settlement.venueRepSignature) {
    lines.push('', `${labels.signature}: ${settlement.venueRepSignature}`)
  }
  if (settlement.signedAt) lines.push(`${labels.signedAt}: ${settlement.signedAt}`)
  writeLines(doc, lines)
  doc.save(`merch-settlement-${stop.stopDate}.pdf`)
}