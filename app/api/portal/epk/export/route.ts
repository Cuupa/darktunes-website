/**
 * app/api/portal/epk/export/route.ts
 *
 * POST — server-side EPK PDF export from canvas document JSON.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { getArtistProfileByArtistId } from '@/lib/api/artistProfiles'
import { ensureMigratedEpkDocument } from '@/lib/api/epkDocument'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'
import { generateEpkPdfBytes } from '@/lib/epk/export/generateEpkPdfBytes'
import { ensureDocumentFontsForExport } from '@/lib/epk/editor/ensureDocumentFontsForExport'
import { buildEpkFontPublicUrl, listEpkFonts } from '@/lib/api/epkFonts'
import { epkDocumentV2Schema } from '@/lib/epk/schema/documentV2'
import { getCachedSiteSettings } from '@/lib/cache/publicQueries'
import { getClientIp } from '@/lib/ipRateLimit'
import { checkDistributedRateLimit } from '@/lib/rateLimitDistributed'
import { emptyArtistProfile } from '@/lib/epk/migrate/emptyArtistProfile'
import { recordEpkDownloadAsync } from '@/lib/epk/recordEpkDownload'
import { PORTAL_EPK_EXPORT_RATE } from '@/lib/uploads/portalUploadLimits'

export const maxDuration = 60

const bodySchema = z.object({
  artist_id: z.string().uuid(),
  document: epkDocumentV2Schema.optional(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = bodySchema.parse(await req.json())
  const ctx = await withPortalMembershipWrite(req, body.artist_id)
  const { artist } = ctx

  const ip = getClientIp(req)
  const rl = await checkDistributedRateLimit(
    `epk-export:${ctx.user.id}:${ip}`,
    PORTAL_EPK_EXPORT_RATE.max,
    PORTAL_EPK_EXPORT_RATE.windowMs,
  )
  if (rl.limited) throw new ApiError(429, 'Too many export requests. Please try again later.')

  let document = body.document

  if (!document) {
    const { value: profile } = await portalMemberWrite(
      ctx,
      { route: 'POST /api/portal/epk/export', table: 'artist_epks', operation: 'select' },
      (db) => getArtistProfileByArtistId(db, artist.id),
    )
    const siteSettings = await getCachedSiteSettings().catch(() => null)
    const { value: state } = await portalMemberWrite(
      ctx,
      { route: 'POST /api/portal/epk/export', table: 'artist_epks', operation: 'select' },
      (db) =>
        ensureMigratedEpkDocument(
          db,
          artist.id,
          profile ?? emptyArtistProfile(artist.id),
          artist,
          siteSettings?.labelName ?? undefined,
        ),
    )
    document = state.document
  }

  const { serverEnv } = await import('@/lib/env.server')
  const { value: fontRecords } = await portalMemberWrite(
    ctx,
    { route: 'POST /api/portal/epk/export', table: 'epk_fonts', operation: 'select' },
    (db) => listEpkFonts(db, artist.id).catch(() => []),
  )
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

