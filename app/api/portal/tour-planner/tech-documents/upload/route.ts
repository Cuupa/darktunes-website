import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { getTourById } from '@/lib/api/tours'
import { createR2Client } from '@/lib/r2Utils'
import { authenticateTourPlannerRequest } from '@/lib/portal/tourPlannerAuth'

const MAX_BYTES = 10 * 1024 * 1024

async function uploadPdfToR2(
  file: File,
  artistId: string,
  tourId: string,
  s3: S3Client,
  bucket: string,
  r2PublicUrl: string,
): Promise<string> {
  const key = `tour-tech-docs/${artistId}/${tourId}/${randomUUID()}.pdf`
  const buffer = Buffer.from(await file.arrayBuffer())

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
      ContentLength: buffer.length,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  return `${r2PublicUrl.replace(/\/$/, '')}/${key}`
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)

  const formData = await req.formData()
  const file = formData.get('file')
  const tourId = formData.get('tourId')

  if (!(file instanceof File)) throw new ApiError(400, 'No file provided')
  if (!tourId || typeof tourId !== 'string') throw new ApiError(400, 'tourId is required')
  if (file.size > MAX_BYTES) throw new ApiError(413, 'File too large (max 10 MB)')

  const isPdf =
    file.type === 'application/pdf' ||
    file.type === 'application/octet-stream' ||
    file.name.toLowerCase().endsWith('.pdf')

  if (!isPdf) throw new ApiError(415, 'Only PDF files are allowed')

  const tour = await getTourById(supabase, tourId)
  if (!tour || tour.artistId !== artist.id) throw new ApiError(404, 'Tour not found')

  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const url = await uploadPdfToR2(
    file,
    artist.id,
    tourId,
    s3,
    serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
    serverEnv.CLOUDFLARE_R2_PUBLIC_URL,
  )

  return NextResponse.json({ url })
})