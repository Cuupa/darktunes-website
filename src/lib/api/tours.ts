import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import type { Tour } from '@/types'
import type { TourPlannerSettings } from '@/lib/tour-planner/types'
import { DEFAULT_TOUR_PLANNER_SETTINGS } from '@/lib/tour-planner/types'
import type { RouteResult, TechDocument } from '@/lib/tour-planner/types'

type DbClient = SupabaseClient<Database>
type TourRow = Database['public']['Tables']['tours']['Row']
export type TourInsert = Database['public']['Tables']['tours']['Insert']
export type TourUpdate = Database['public']['Tables']['tours']['Update']

function parseSettings(raw: Json): TourPlannerSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return DEFAULT_TOUR_PLANNER_SETTINGS
  }
  return { ...DEFAULT_TOUR_PLANNER_SETTINGS, ...(raw as unknown as TourPlannerSettings) }
}

function rowToTour(row: TourRow): Tour {
  return {
    id: row.id,
    artistId: row.artist_id,
    name: row.name,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    archived: row.archived,
    sortOrder: row.sort_order,
    settings: parseSettings(row.settings),
    routeCache: (row.route_cache as RouteResult | null) ?? null,
    budget: row.budget,
    techDocuments: (row.tech_documents as unknown as TechDocument[]) ?? [],
    currency: row.currency,
    totalBudget: row.total_budget !== null ? Number(row.total_budget) : null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getToursByArtistId(db: DbClient, artistId: string, includeArchived = false): Promise<Tour[]> {
  let query = db
    .from('tours')
    .select('*')
    .eq('artist_id', artistId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (!includeArchived) {
    query = query.eq('archived', false)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToTour)
}

export async function getTourById(db: DbClient, tourId: string): Promise<Tour | null> {
  const { data, error } = await db.from('tours').select('*').eq('id', tourId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? rowToTour(data) : null
}

export async function createTour(db: DbClient, data: TourInsert): Promise<Tour> {
  const { data: row, error } = await db.from('tours').insert(data).select('*').single()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from createTour')
  return rowToTour(row)
}

export async function updateTour(db: DbClient, id: string, data: TourUpdate): Promise<Tour> {
  const { data: row, error } = await db.from('tours').update(data).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from updateTour')
  return rowToTour(row)
}

export async function deleteTour(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('tours').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function duplicateTour(db: DbClient, tourId: string, userId: string): Promise<Tour> {
  const source = await getTourById(db, tourId)
  if (!source) throw new Error('Tour not found')

  const copy = await createTour(db, {
    artist_id: source.artistId,
    name: `${source.name} (Copy)`,
    description: source.description,
    start_date: source.startDate,
    end_date: source.endDate,
    settings: source.settings as unknown as Json,
    route_cache: source.routeCache as unknown as Json,
    budget: source.budget as Json,
    tech_documents: source.techDocuments as unknown as Json,
    currency: source.currency,
    total_budget: source.totalBudget,
    created_by: userId,
  })

  const { data: stops, error: stopsError } = await db
    .from('tour_stops')
    .select('*')
    .eq('tour_id', tourId)
    .order('sort_order', { ascending: true })

  if (stopsError) throw new Error(stopsError.message)

  if (stops?.length) {
    const { error: insertError } = await db.from('tour_stops').insert(
      stops.map((stop) => ({
        tour_id: copy.id,
        artist_id: stop.artist_id,
        sort_order: stop.sort_order,
        stop_date: stop.stop_date,
        is_travel_day: stop.is_travel_day,
        venue_name: stop.venue_name,
        venue_address: stop.venue_address,
        venue_city: stop.venue_city,
        venue_country: stop.venue_country,
        venue_lat: stop.venue_lat,
        venue_lng: stop.venue_lng,
        venue_validated: stop.venue_validated,
        hotel_name: stop.hotel_name,
        hotel_address: stop.hotel_address,
        hotel_city: stop.hotel_city,
        hotel_country: stop.hotel_country,
        hotel_lat: stop.hotel_lat,
        hotel_lng: stop.hotel_lng,
        hotel_validated: stop.hotel_validated,
        arrival_time: stop.arrival_time,
        show_status: stop.show_status,
        day_schedule: stop.day_schedule,
        deal: stop.deal,
        settlement: stop.settlement,
        per_diems: stop.per_diems,
        rooming: stop.rooming,
        travel_manifest: stop.travel_manifest,
        venue_details: stop.venue_details,
        venue_contact_info: stop.venue_contact_info,
        guest_list: stop.guest_list,
        guest_list_limit: stop.guest_list_limit,
        notes: stop.notes,
      })),
    )
    if (insertError) throw new Error(insertError.message)
  }

  return copy
}