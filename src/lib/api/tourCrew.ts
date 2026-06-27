import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { TourCrewMember } from '@/types'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['tour_crew_members']['Row']
export type TourCrewInsert = Database['public']['Tables']['tour_crew_members']['Insert']
export type TourCrewUpdate = Database['public']['Tables']['tour_crew_members']['Update']

function rowToCrew(row: Row): TourCrewMember {
  return {
    id: row.id,
    tourId: row.tour_id,
    artistId: row.artist_id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    passportNumber: row.passport_number,
    passportExpiry: row.passport_expiry,
    passportIssuePlace: row.passport_issue_place,
    dateOfBirth: row.date_of_birth,
    nationality: row.nationality,
    visaInfo: row.visa_info,
    roomAssignment: row.room_assignment,
    busAssignment: row.bus_assignment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getTourCrewByTourId(db: DbClient, tourId: string): Promise<TourCrewMember[]> {
  const { data, error } = await db
    .from('tour_crew_members')
    .select('*')
    .eq('tour_id', tourId)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToCrew)
}

export async function createTourCrewMember(db: DbClient, data: TourCrewInsert): Promise<TourCrewMember> {
  const { data: row, error } = await db.from('tour_crew_members').insert(data).select('*').single()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from createTourCrewMember')
  return rowToCrew(row)
}

export async function updateTourCrewMember(db: DbClient, id: string, data: TourCrewUpdate): Promise<TourCrewMember> {
  const { data: row, error } = await db.from('tour_crew_members').update(data).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from updateTourCrewMember')
  return rowToCrew(row)
}

export async function deleteTourCrewMember(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('tour_crew_members').delete().eq('id', id)
  if (error) throw new Error(error.message)
}