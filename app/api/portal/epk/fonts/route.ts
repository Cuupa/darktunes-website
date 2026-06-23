/**
 * app/api/portal/epk/fonts/route.ts
 *
 * GET    — list custom EPK fonts for the active artist (+ global fonts)
 * POST   — upload a font file to R2 and register in epk_fonts
 * DELETE — remove an artist-owned font (R2 object + DB row)
 */

import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'
import {
  buildEpkFontPublicUrl,
  createEpkFont,
  deleteEpkFont,
  listEpkFonts,
} from '@/lib/api/epkFonts'
import { createR2Client, deleteObjectFromR2 } from '@/lib/r2Utils'

const ALLOWED_FONT_TYPES = new Set([
  'font/woff2',
  'font/woff',
  'font/ttf',
  'font/otf',
  'application/font-woff',
  'application/font-woff2',
  'application/x-font-ttf',
  'application/x-font-opentype',
  'application/octet-stream',
])
const MAX_FONT_BYTES = 5 * 1024 * 1024

const deleteSchema = z.object({ id: z.string().uuid() })

function extFromMimeType(mimeType: string, filename: string): string {
  if (mimeType.includes('woff2') || filename.endsWith('.woff2')) return 'woff2'
  if (mimeType.includes('woff') || filename.endsWith('.woff')) return 'woff'
  if (mimeType.includes('otf') || filename.endsWith('.otf')) return 'otf'
  return 'ttf'
}

function familyFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Custom Font'
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { supabase, user } = await authenticatePortalBearer(req)
  const artistId = new URL(req.url).searchParams.get('artistId')

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch((err) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  })
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const { serverEnv } = await import('@/lib/env.server')
  const fonts = await listEpkFonts(supabase, artist.id)

  return NextResponse.json({
    fonts: fonts.map((font) => ({
      id: font.id,
      name: font.name,
      family: font.name,
      r2Key: font.r2Key,
      mimeType: font.mimeType,
      publicUrl: buildEpkFontPublicUrl(font.r2Key, serverEnv.CLOUDFLARE_R2_PUBLIC_URL),
      createdAt: font.createdAt,
    })),
  })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { supabase, user } = await authenticatePortalBearer(req)
  const artistId = new URL(req.url).searchParams.get('artistId')

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch((err) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  })
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const formData = await req.formData()
  const file = formData.get('file')
  const label = formData.get('name')

  if (!(file instanceof File)) throw new ApiError(400, 'No file provided')
  if (file.size > MAX_FONT_BYTES) throw new ApiError(413, 'Font file too large (max 5 MB)')

  const contentType = file.type || 'application/octet-stream'
  const lowerName = file.name.toLowerCase()
  const looksLikeFont =
    ALLOWED_FONT_TYPES.has(contentType) ||
    lowerName.endsWith('.woff2') ||
    lowerName.endsWith('.woff') ||
    lowerName.endsWith('.ttf') ||
    lowerName.endsWith('.otf')

  if (!looksLikeFont) {
    throw new ApiError(415, 'Unsupported font type. Allowed: WOFF2, WOFF, TTF, OTF')
  }

  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const ext = extFromMimeType(contentType, lowerName)
  const r2Key = `epk-fonts/${artist.id}/${randomUUID()}.${ext}`

  await s3.send(
    new PutObjectCommand({
      Bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
      Key: r2Key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  const familyName =
    typeof label === 'string' && label.trim()
      ? label.trim()
      : familyFromFilename(file.name)

  const record = await createEpkFont(supabase, {
    artist_id: artist.id,
    name: familyName,
    r2_key: r2Key,
    mime_type: contentType,
  })

  return NextResponse.json({
    font: {
      id: record.id,
      name: record.name,
      family: record.name,
      r2Key: record.r2Key,
      mimeType: record.mimeType,
      publicUrl: buildEpkFontPublicUrl(record.r2Key, serverEnv.CLOUDFLARE_R2_PUBLIC_URL),
      createdAt: record.createdAt,
    },
  })
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const { supabase, user } = await authenticatePortalBearer(req)
  const artistId = new URL(req.url).searchParams.get('artistId')

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch((err) => {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  })
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  const body = deleteSchema.parse(await req.json())
  const removed = await deleteEpkFont(supabase, body.id, artist.id)
  if (!removed) throw new ApiError(404, 'Font not found')

  if (removed.artistId) {
    const { serverEnv } = await import('@/lib/env.server')
    const s3 = createR2Client(
      serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
      serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
      serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    )
    await deleteObjectFromR2(removed.r2Key, s3, serverEnv.CLOUDFLARE_R2_BUCKET_NAME)
  }

  return NextResponse.json({ success: true })
})