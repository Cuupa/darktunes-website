import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { TourStop } from '@/types'
import type {
  DaySchedule,
  DealStructure,
  GuestListEntry,
  PerDiem,
  RoomingAssignment,
  Settlement,
  ShowStatus,
  TravelManifest,
  VenueContactInfo,
  VenueDetails,
} from '@/lib/tour-planner/types'

type DbClient = SupabaseClient<Database>
type TourStopRow = Database['public']['Tables']['tour_stops']['Row']
export type TourStopInsert = Database['public']['Tables']['tour_stops']['Insert']
export type TourStopUpdate = Database['public']['Tables']['tour_stops']['Update']

function rowToTourStop(row: TourStopRow): TourStop {
  return {
    id: row.id,
    tourId: row.tour_id,
    artistId: row.artist_id,
    concertId: row.concert_id,
    sortOrder: row.sort_order,
    stopDate: row.stop_date,
    isTravelDay: row.is_travel_day,
    venueName: row.venue_name,
    venueAddress: row.venue_address,
    venueCity: row.venue_city,
    venueCountry: row.venue_country,
    venueLat: row.venue_lat,
    venueLng: row.venue_lng,
    venueValidated: row.venue_validated,
    hotelName: row.hotel_name,
    hotelAddress: row.hotel_address,
    hotelCity: row.hotel_city,
    hotelCountry: row.hotel_country,
    hotelLat: row.hotel_lat,
    hotelLng: row.hotel_lng,
    hotelValidated: row.hotel_validated,
    arrivalTime: row.arrival_time,
    showStatus: row.show_status as ShowStatus,
    daySchedule: row.day_schedule as DaySchedule | null,
    deal: row.deal as DealStructure | null,
    settlement: row.settlement as Settlement | null,
    perDiems: (row.per_diems as unknown as PerDiem[]) ?? [],
    rooming: (row.rooming as unknown as RoomingAssignment[]) ?? [],
    travelManifest: (row.travel_manifest as unknown as TravelManifest[]) ?? [],
    venueDetails: row.venue_details as VenueDetails | null,
    venueContactInfo: row.venue_contact_info as VenueContactInfo | null,
    guestList: (row.guest_list as unknown as GuestListEntry[]) ?? [],
    guestListLimit: row.guest_list_limit,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getTourStopsByTourId(db: DbClient, tourId: string): Promise<TourStop[]> {
  const { data, error } = await db
    .from('tour_stops')
    .select('*')
    .eq('tour_id', tourId)
    .order('sort_order', { ascending: true })
    .order('stop_date', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToTourStop)
}

export async function getTourStopById(db: DbClient, stopId: string): Promise<TourStop | null> {
  const { data, error } = await db.from('tour_stops').select('*').eq('id', stopId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? rowToTourStop(data) : null
}

export async function createTourStop(db: DbClient, data: TourStopInsert): Promise<TourStop> {
  const { data: row, error } = await db.from('tour_stops').insert(data).select('*').single()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from createTourStop')
  return rowToTourStop(row)
}

export async function updateTourStop(db: DbClient, id: string, data: TourStopUpdate): Promise<TourStop> {
  const { data: row, error } = await db.from('tour_stops').update(data).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from updateTourStop')
  return rowToTourStop(row)
}

export async function deleteTourStop(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('tour_stops').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function reorderTourStops(
  db: DbClient,
  tourId: string,
  orderedStopIds: string[],
): Promise<TourStop[]> {
  const updates = orderedStopIds.map((id, index) =>
    db.from('tour_stops').update({ sort_order: index }).eq('id', id).eq('tour_id', tourId),
  )
  const results = await Promise.all(updates)
  for (const result of results) {
    if (result.error) throw new Error(result.error.message)
  }
  return getTourStopsByTourId(db, tourId)
}