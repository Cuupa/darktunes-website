import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getBillingProfile, isBillingProfileComplete, upsertBillingProfile } from '@/lib/api/artistBillingProfiles'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'
import { portalWriteWithCanary } from '@/lib/portal/portalWriteClient'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'

const upsertBillingProfileSchema = z.object({
  artist_id: z.string().uuid(),
  legal_name: z.string().trim().min(1),
  street: z.string().trim().min(1),
  postal_code: z.string().trim().min(1),
  city: z.string().trim().min(1),
  country: z.string().trim().min(1).default('DE'),
  tax_number: z.string().optional(),
  vat_id: z.string().optional(),
  is_small_business: z.boolean().default(false),
  iban: z.string().optional(),
  bic: z.string().optional(),
  paypal_email: z.string().email().optional().or(z.literal('')),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { supabase, user } = await authenticatePortalBearer(req)
  const artistId = req.nextUrl.searchParams.get('artist_id') ?? undefined
  const artist = await resolvePortalArtist(supabase, user.id, artistId)
  if (!artist) throw new ApiError(403, 'Forbidden')

  // Membership verified — service-role avoids RLS drift blocking band members.
  const serviceDb = await createServiceRoleSupabaseClient()
  const profile = await getBillingProfile(serviceDb, artist.id)

  return NextResponse.json({
    profile,
    isComplete: isBillingProfileComplete(profile),
  })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { supabase, user } = await authenticatePortalBearer(req)
  const body: unknown = await req.json()
  const parsed = upsertBillingProfileSchema.safeParse(body)

  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((issue) => issue.message).join('; '))
  }

  const artist = await resolvePortalArtist(supabase, user.id, parsed.data.artist_id)
  if (!artist) throw new ApiError(403, 'Forbidden')

  const serviceDb = await createServiceRoleSupabaseClient()
  const { value: profile } = await portalWriteWithCanary({
    userDb: supabase,
    serviceDb,
    context: {
      route: 'POST /api/portal/billing-profile',
      table: 'artist_billing_profiles',
      operation: 'upsert',
      artistId: artist.id,
      userId: user.id,
    },
    write: (db) =>
      upsertBillingProfile(db, artist.id, {
        legalName: parsed.data.legal_name,
        street: parsed.data.street,
        postalCode: parsed.data.postal_code,
        city: parsed.data.city,
        country: parsed.data.country,
        taxNumber: parsed.data.tax_number,
        vatId: parsed.data.vat_id,
        isSmallBusiness: parsed.data.is_small_business,
        iban: parsed.data.iban,
        bic: parsed.data.bic,
        paypalEmail: parsed.data.paypal_email || undefined,
      }),
  })

  return NextResponse.json({
    profile,
    isComplete: isBillingProfileComplete(profile),
  })
})
