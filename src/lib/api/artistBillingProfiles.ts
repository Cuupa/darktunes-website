import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type ArtistBillingProfileRow = Database['public']['Tables']['artist_billing_profiles']['Row']
type ArtistBillingProfileInsert = Database['public']['Tables']['artist_billing_profiles']['Insert']

export interface ArtistBillingProfile {
  id: string
  artistId: string
  legalName: string
  street: string
  postalCode: string
  city: string
  country: string
  taxNumber: string | undefined
  vatId: string | undefined
  isSmallBusiness: boolean
  iban: string | undefined
  bic: string | undefined
  paypalEmail: string | undefined
  createdAt: string
  updatedAt: string
}

export interface UpsertBillingProfileData {
  legalName: string
  street: string
  postalCode: string
  city: string
  country: string
  taxNumber?: string
  vatId?: string
  isSmallBusiness: boolean
  iban?: string
  bic?: string
  paypalEmail?: string
}

function rowToArtistBillingProfile(row: ArtistBillingProfileRow): ArtistBillingProfile {
  return {
    id: row.id,
    artistId: row.artist_id,
    legalName: row.legal_name,
    street: row.street,
    postalCode: row.postal_code,
    city: row.city,
    country: row.country,
    taxNumber: row.tax_number ?? undefined,
    vatId: row.vat_id ?? undefined,
    isSmallBusiness: row.is_small_business,
    iban: row.iban ?? undefined,
    bic: row.bic ?? undefined,
    paypalEmail: row.paypal_email ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normaliseOptional(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function getBillingProfile(
  db: DbClient,
  artistId: string,
): Promise<ArtistBillingProfile | null> {
  const { data, error } = await db
    .from('artist_billing_profiles')
    .select('*')
    .eq('artist_id', artistId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }

  return data ? rowToArtistBillingProfile(data as ArtistBillingProfileRow) : null
}

export async function upsertBillingProfile(
  db: DbClient,
  artistId: string,
  data: UpsertBillingProfileData,
): Promise<ArtistBillingProfile> {
  const payload: ArtistBillingProfileInsert = {
    artist_id: artistId,
    legal_name: data.legalName.trim(),
    street: data.street.trim(),
    postal_code: data.postalCode.trim(),
    city: data.city.trim(),
    country: data.country.trim() || 'DE',
    tax_number: normaliseOptional(data.taxNumber),
    vat_id: normaliseOptional(data.vatId),
    is_small_business: data.isSmallBusiness,
    iban: normaliseOptional(data.iban),
    bic: normaliseOptional(data.bic),
    paypal_email: normaliseOptional(data.paypalEmail),
  }

  const { data: row, error } = await db
    .from('artist_billing_profiles')
    .upsert(payload, { onConflict: 'artist_id' })
    .select()
    .single()

  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from upsertBillingProfile')

  return rowToArtistBillingProfile(row as ArtistBillingProfileRow)
}

export function isBillingProfileComplete(profile: ArtistBillingProfile | null): boolean {
  if (!profile) return false

  const hasRequiredAddress = [
    profile.legalName,
    profile.street,
    profile.postalCode,
    profile.city,
    profile.country,
  ].every((value) => value.trim().length > 0)

  const hasTaxIdentity = Boolean(profile.taxNumber?.trim() || profile.vatId?.trim())

  return hasRequiredAddress && hasTaxIdentity
}
