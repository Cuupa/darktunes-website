import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { deleteTourContact } from '@/lib/api/tourContacts'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'

function contactId(pathname: string): string {
  const id = pathname.split('/').pop()
  if (!id) throw new ApiError(400, 'Missing contact id')
  return id
}

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticatePortalBearerWithArtist(req, artistId)
  const id = contactId(req.nextUrl.pathname)

  const { data, error } = await supabase.from('tour_contacts').select('artist_id').eq('id', id).single()
  if (error || !data || data.artist_id !== artist.id) throw new ApiError(404, 'Contact not found')

  await deleteTourContact(supabase, id)
  return NextResponse.json({ ok: true })
})