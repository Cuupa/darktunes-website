/**
 * app/api/epk/share/[token]/route.ts
 *
 * GET  — public share metadata (requires password flag only)
 * POST — unlock share payload with optional password
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getEpkShareLinkByToken } from '@/lib/api/epkShareLinks'
import { getPublicArtistEpkByArtistId } from '@/lib/api/publicArtistEpk'
import { getArtistById } from '@/lib/api/artists'
import { listEpkFonts, buildEpkFontPublicUrl } from '@/lib/api/epkFonts'
import { ensureDocumentFontsForExport } from '@/lib/epk/editor/ensureDocumentFontsForExport'
import { verifySharePassword } from '@/lib/epk/sharePassword'
import { generateEpkPdfBytes } from '@/lib/epk/export/generateEpkPdfBytes'
import { checkRateLimit, getClientIp } from '@/lib/ipRateLimit'
import { recordEpkDownloadAsync } from '@/lib/epk/recordEpkDownload'


const unlockSchema = z.object({
  password: z.string().max(200).optional(),
})

function extractToken(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/')
  const token = segments[segments.length - 1]
  if (!token) throw new ApiError(400, 'Missing share token')
  return token
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = extractToken(req)
  const db = await createServiceRoleSupabaseClient()
  const link = await getEpkShareLinkByToken(db, token)
  if (!link) throw new ApiError(404, 'Share link not found or expired')

  const artist = await getArtistById(db, link.artistId)
  if (!artist?.isVisible) throw new ApiError(404, 'Share link not found or expired')

  return NextResponse.json({
    artistName: artist.name,
    artistSlug: artist.slug,
    hasPassword: link.hasPassword,
    label: link.label,
    expiresAt: link.expiresAt,
  })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const ip = getClientIp(req)
  const token = extractToken(req)
  const { limited } = checkRateLimit(`epk-share:${ip}:${token}`, 30, 10 * 60_000)
  if (limited) throw new ApiError(429, 'Too many requests. Please try again later.')

  const body = unlockSchema.parse(await req.json().catch(() => ({})))
  const db = await createServiceRoleSupabaseClient()
  const link = await getEpkShareLinkByToken(db, token)
  if (!link) throw new ApiError(404, 'Share link not found or expired')

  if (link.passwordHash) {
    if (!body.password || !verifySharePassword(body.password, link.passwordHash)) {
      throw new ApiError(401, 'Invalid password', 'INVALID_PASSWORD')
    }
  }

  const artist = await getArtistById(db, link.artistId)
  if (!artist?.isVisible) throw new ApiError(404, 'Share link not found or expired')

  const publicEpk = await getPublicArtistEpkByArtistId(db, link.artistId)
  if (!publicEpk?.document) throw new ApiError(404, 'EPK document not available')

  const { serverEnv } = await import('@/lib/env.server')
  const fonts = await listEpkFonts(db, link.artistId).catch(() => [])
  const document = ensureDocumentFontsForExport(
    publicEpk.document,
    fonts.map((font) => ({
      id: font.id,
      name: font.name,
      r2Key: font.r2Key,
      publicUrl: buildEpkFontPublicUrl(font.r2Key, serverEnv.CLOUDFLARE_R2_PUBLIC_URL),
    })),
  )

  const action = req.nextUrl.searchParams.get('action')
  if (action === 'export') {
    const riderAttachments: string[] = []
    if (publicEpk.profile.riderStagePlotUrl) riderAttachments.push(publicEpk.profile.riderStagePlotUrl)
    if (publicEpk.profile.riderTechnicalUrl) riderAttachments.push(publicEpk.profile.riderTechnicalUrl)
    if (publicEpk.profile.riderHospitalityUrl) riderAttachments.push(publicEpk.profile.riderHospitalityUrl)

    const pdfBytes = await generateEpkPdfBytes({
      document,
      attachmentUrls: riderAttachments,
    })

    recordEpkDownloadAsync({
      artistId: link.artistId,
      source: 'share',
      shareLinkId: link.id,
      ip,
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    const filename = `${artist.slug || 'epk'}-press-kit.pdf`
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  return NextResponse.json({
    artistName: artist.name,
    document,
    profile: publicEpk.profile,
  })
})