import { describe, expect, it } from 'vitest'
import {
  downloadDaySheetPdf,
  downloadMerchSettlementPdf,
  downloadSettlementPdf,
  type TourPlannerPdfLabels,
} from '@/lib/tour-planner/pdf'
import type { TourStop } from '@/types'

const labels: TourPlannerPdfLabels = {
  daySheet: 'Day Sheet',
  schedule: 'Schedule',
  venue: 'Venue',
  date: 'Date',
  show: 'Show',
  tbd: 'TBD',
  getIn: 'Get-in',
  soundcheck: 'Soundcheck',
  doors: 'Doors',
  stageTime: 'Stage',
  curfew: 'Curfew',
  settlement: 'Settlement',
  ticketsSold: 'Tickets',
  ticketPrice: 'Price',
  grossRevenue: 'Gross',
  venueCosts: 'Costs',
  netRevenue: 'Net',
  artistPayment: 'Artist',
  notes: 'Notes',
  merchSettlement: 'Merch',
  hallFee: 'Hall fee',
  itemsSold: 'Items sold',
  signedAt: 'Signed',
  signature: 'Signature',
}

const stop: TourStop = {
  id: '11111111-1111-1111-1111-111111111111',
  tourId: '22222222-2222-2222-2222-222222222222',
  artistId: '33333333-3333-3333-3333-333333333333',
  concertId: null,
  stopDate: '2026-09-15',
  isTravelDay: false,
  sortOrder: 0,
  venueName: 'Columbiahalle',
  venueAddress: 'Columbiadamm 13',
  venueCity: 'Berlin',
  venueCountry: 'Germany',
  venueLat: 52.48,
  venueLng: 13.39,
  venueValidated: true,
  hotelName: null,
  hotelAddress: null,
  hotelCity: null,
  hotelCountry: null,
  hotelLat: null,
  hotelLng: null,
  hotelValidated: false,
  arrivalTime: null,
  showStatus: 'confirmed',
  daySchedule: { getIn: '14:00' },
  deal: { type: 'guarantee', currency: 'EUR', guarantee: 5000 },
  settlement: {
    ticketsSold: 800,
    ticketPrice: 35,
    grossRevenue: 28000,
    venueCosts: 4000,
    netRevenue: 24000,
    artistPayment: 12000,
  },
  perDiems: [],
  rooming: [],
  travelManifest: [],
  venueDetails: null,
  venueContactInfo: null,
  guestList: [],
  guestListLimit: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('tour planner pdf', () => {
  it('generates day sheet without throwing', () => {
    expect(() => downloadDaySheetPdf(stop, stop.daySchedule ?? {}, labels)).not.toThrow()
  })

  it('generates settlement without throwing', () => {
    expect(() =>
      downloadSettlementPdf(stop, stop.settlement!, stop.deal, labels),
    ).not.toThrow()
  })

  it('generates merch settlement without throwing', () => {
    expect(() =>
      downloadMerchSettlementPdf(stop, {
        showId: stop.id,
        date: stop.stopDate,
        countIn: {},
        adds: {},
        comps: [],
        countOut: {},
        sold: { item1: 10 },
        grossRevenue: 500,
        hallFee: 75,
        hallFeePercentageSoft: 15,
        hallFeePercentageHard: 25,
        netRevenue: 425,
        taxRate: 0,
      }, labels),
    ).not.toThrow()
  })
})