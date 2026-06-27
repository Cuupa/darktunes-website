import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { TourContact } from '@/types'
import type { ContactDealHistory } from '@/lib/tour-planner/types'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['tour_contacts']['Row']
export type TourContactInsert = Database['public']['Tables']['tour_contacts']['Insert']
export type TourContactUpdate = Database['public']['Tables']['tour_contacts']['Update']

function rowToContact(row: Row): TourContact {
  return {
    id: row.id,
    artistId: row.artist_id,
    contactType: row.contact_type,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    country: row.country,
    lastContactDate: row.last_contact_date,
    notes: row.notes,
    previousDeals: (row.previous_deals as unknown as ContactDealHistory[]) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getTourContactsByArtistId(db: DbClient, artistId: string): Promise<TourContact[]> {
  const { data, error } = await db
    .from('tour_contacts')
    .select('*')
    .eq('artist_id', artistId)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToContact)
}

export async function createTourContact(db: DbClient, data: TourContactInsert): Promise<TourContact> {
  const { data: row, error } = await db.from('tour_contacts').insert(data).select('*').single()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from createTourContact')
  return rowToContact(row)
}

export async function updateTourContact(db: DbClient, id: string, data: TourContactUpdate): Promise<TourContact> {
  const { data: row, error } = await db.from('tour_contacts').update(data).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from updateTourContact')
  return rowToContact(row)
}

export async function deleteTourContact(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('tour_contacts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}