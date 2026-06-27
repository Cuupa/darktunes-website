/**
 * T.R.A.C.K. domain types — ported from artist-tour-planner.
 * JSONB columns in Supabase mirror these structures.
 */

export type Language = 'en' | 'de'

export type APIProvider = 'nominatim' | 'google'

export type VehicleType = 'car' | 'bus' | 'truck'

export type PlanningMode = 'fastest' | 'avoid-rush-hour' | 'balanced'

export type ShowStatus = 'option' | 'confirmed' | 'contract-sent' | 'deposit-paid' | 'cancelled'

export type DealType = 'guarantee' | 'door-split' | 'versus' | 'bonus'

export type Currency = 'EUR' | 'GBP' | 'USD' | 'CHF'

export interface TourPlannerSettings {
  apiProvider: APIProvider
  googleApiKey?: string
  language: Language
  vehicleType: VehicleType
  planningMode: PlanningMode
  fuelCostPerKm?: number
  tollCosts?: number
  currency?: string
  theme?: 'light' | 'dark'
  radiusProtectionKm?: number
}

export interface DaySchedule {
  getIn?: string
  soundcheck?: string
  doors?: string
  stageTime?: string
  curfew?: string
  dinnerTime?: string
  lobbyCall?: string
  hotelDeparture?: string
  driveTime?: string
  timezone?: string
}

export interface DealStructure {
  type: DealType
  guarantee?: number
  doorSplitPercentage?: number
  versusAmount?: number
  versusPercentage?: number
  bonusThreshold?: number
  bonusAmount?: number
  currency: Currency
  withholdingTax?: number
  withholdingTaxCountry?: string
  promoterCosts?: number
  breakEvenPoint?: number
}

export interface Settlement {
  ticketsSold: number
  ticketPrice: number
  grossRevenue: number
  venueCosts: number
  hallRental?: number
  productionCosts?: number
  netRevenue: number
  artistPayment: number
  notes?: string
  venueRepSignature?: string
  signedAt?: string
}

export interface PerDiem {
  personId: string
  personName: string
  amount: number
  currency: Currency
  date: string
  paid: boolean
  notes?: string
}

export interface RoomingAssignment {
  personId: string
  personName: string
  roomType: 'single' | 'twin' | 'suite'
  roomNumber?: string
  notes?: string
}

export interface TravelManifest {
  personId: string
  personName: string
  vehicle: 'bus' | 'van' | 'flight'
  bunkNumber?: string
  seatNumber?: string
  notes?: string
}

export interface VenueDetails {
  loadingDock?: string
  powerSupply?: string
  paSpecs?: string
  techContactName?: string
  techContactPhone?: string
  techContactEmail?: string
  capacity?: number
  notes?: string
  loadInType?: 'ground-level' | 'ramp' | 'stairs' | 'elevator'
  loadInNotes?: string
  parkingSpaces?: number
  truckAccess?: boolean
}

export interface VenueContactInfo {
  promoterName?: string
  promoterEmail?: string
  promoterPhone?: string
  venueContactName?: string
  venueContactEmail?: string
  venueContactPhone?: string
  technicalContactName?: string
  technicalContactEmail?: string
  technicalContactPhone?: string
  cateringContactName?: string
  cateringContactEmail?: string
  cateringContactPhone?: string
  productionManagerName?: string
  productionManagerEmail?: string
  productionManagerPhone?: string
  notes?: string
}

export interface TechDocument {
  id: string
  name: string
  type: 'tech-rider' | 'stage-plot' | 'input-list' | 'catering-rider' | 'other'
  url?: string
  uploadedAt: string
}

export interface GuestListEntry {
  id: string
  name: string
  showId: string
  numberOfGuests: number
  approvedBy?: string
  notes?: string
  type?: 'band-guestlist' | 'buyout'
  buyoutPrice?: number
}

export interface Coordinates {
  lat: number
  lon: number
}

export interface GeocodingResult {
  coords?: Coordinates
  error?: string
  displayName?: string
}

export interface RouteSegment {
  from: string
  to: string
  fromCoords: Coordinates
  toCoords: Coordinates
  distance: number
  duration: number
  type: 'start' | 'to-venue' | 'to-hotel' | 'to-next-hotel'
  departureTime?: string
  arrivalTime?: string
  trafficWarning?: string
  alternative?: {
    distance: number
    duration: number
    reason: string
  }
}

export interface RouteResult {
  segments: RouteSegment[]
  totalDistance: number
  totalDuration: number
  error?: string
  alternativeRoutes?: AlternativeRoute[]
}

export interface AlternativeRoute {
  id: string
  name: string
  segments: RouteSegment[]
  totalDistance: number
  totalDuration: number
  reason: string
}

export interface MerchVariant {
  id: string
  type: 'size' | 'color' | 'format'
  value: string
  stock: number
}

export interface MerchSettlement {
  showId: string
  date: string
  countIn: Record<string, number>
  adds: Record<string, number>
  comps: MerchComp[]
  countOut: Record<string, number>
  sold: Record<string, number>
  grossRevenue: number
  hallFee: number
  hallFeePercentageSoft: number
  hallFeePercentageHard: number
  netRevenue: number
  taxRate: number
  venueRepSignature?: string
  signedAt?: string
  notes?: string
}

export interface MerchComp {
  itemVariantId: string
  quantity: number
  reason: string
  recipientName?: string
}

export interface ContactDealHistory {
  date: string
  guarantee: number
  currency: Currency
  notes?: string
}

export const DEFAULT_TOUR_PLANNER_SETTINGS: TourPlannerSettings = {
  apiProvider: 'nominatim',
  language: 'de',
  vehicleType: 'car',
  planningMode: 'balanced',
  currency: 'EUR',
}