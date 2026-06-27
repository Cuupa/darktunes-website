import { jsPDF } from 'jspdf'
import type { TourStop } from '@/types'
import type { DaySchedule } from '@/lib/tour-planner/types'

export function downloadDaySheetPdf(stop: TourStop, schedule: DaySchedule): void {
  const doc = new jsPDF()
  const s = schedule
  const lines = [
    `DAY SHEET — ${stop.venueName ?? 'Show'}`,
    `Date: ${stop.stopDate}`,
    '',
    'SCHEDULE',
    `Get-In: ${s.getIn ?? 'TBD'}`,
    `Soundcheck: ${s.soundcheck ?? 'TBD'}`,
    `Doors: ${s.doors ?? 'TBD'}`,
    `Stage: ${s.stageTime ?? 'TBD'}`,
    `Curfew: ${s.curfew ?? 'TBD'}`,
    '',
    'VENUE',
    stop.venueAddress ?? '',
    `${stop.venueCity ?? ''}, ${stop.venueCountry ?? ''}`,
  ]
  doc.setFontSize(11)
  lines.forEach((line, i) => doc.text(line, 14, 16 + i * 7))
  doc.save(`day-sheet-${stop.stopDate}.pdf`)
}