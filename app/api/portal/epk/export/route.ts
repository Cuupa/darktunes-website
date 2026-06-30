/**
 * app/api/portal/epk/export/route.ts
 *
 * POST — server-side EPK PDF export from canvas document JSON.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'
import {
  getArtistProfileByArtistId,
  resolvePortalArtist,
} from '@/lib/api/artistProfiles'
import { ensureMigratedEpkDocument } from '@/lib/api/epkDocument'
import { generateEpkPdfBytes } from '@/lib/epk/export/generateEpkPdfBytes'
import { ensureDocumentFontsForExport } from '@/lib/epk/editor/ensureDocumentFontsForExport'
import { buildEpkFontPublicUrl, listEpkFonts } from '@/lib/api/epkFonts'
import { epkDocumentV2Schema } from '@/lib/epk/schema/documentV2'
import { getCachedSiteSettings } from '@/lib/cache/publicQueries'
import { checkRateLimit, getClientIp } from '@/lib/ipRateLimit'
import { emptyArtistProfile } from '@/lib/epk/migrate/emptyArtistProfile'
import { recordEpkDownloadAsync } from '@/lib/epk/recordEpkDownload'

export const maxDuration = 60

const bodySchema = z.object({
  artist_id: z.string().uuid(),
  document: epkDocumentV2Schema.optional(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const ip = getClientIp(req)
  const { limited } = checkRateLimit(`epk-export:${ip}`, 10, 10 * 60_000)
  if (limited) throw new ApiError(429, 'Too many export requests. Please try again later.')

  const { supabase, user } = await authenticatePortalBearer(req)
  const body = bodySchema.parse(await req.json())

  const artist = await resolvePortalArtist(supabase, user.id, body.artist_id).catch((err) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  })
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  let document = body.document

  if (!document) {
    const profile = await getArtistProfileByArtistId(supabase, artist.id)
    const siteSettings = await getCachedSiteSettings().catch(() => null)
    const state = await ensureMigratedEpkDocument(
      supabase,
      artist.id,
      profile ?? emptyArtistProfile(artist.id),
      artist,
      siteSettings?.labelName ?? undefined,
    )
    document = state.document
  }

  const { serverEnv } = await import('@/lib/env.server')
  const fontRecords = await listEpkFonts(supabase, artist.id).catch(() => [])
  const hydratedDocument = ensureDocumentFontsForExport(document, fontRecords.map((font) => ({
    id: font.id,
    name: font.name,
    r2Key: font.r2Key,
    publicUrl: buildEpkFontPublicUrl(font.r2Key, serverEnv.CLOUDFLARE_R2_PUBLIC_URL),
  })))

  const pdfBytes = await generateEpkPdfBytes({
    document: hydratedDocument,
  })

  recordEpkDownloadAsync({
    artistId: artist.id,
    source: 'portal',
    ip: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  const filename = `${slugify(artist.name)}-epk.pdf`
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
})

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'epk'
}

