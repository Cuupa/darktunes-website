import { randomUUID } from 'crypto'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createR2Client, deleteObjectFromR2 } from '@/lib/r2Utils'
import { generatePresignedUploadUrl } from '@/lib/portal/presignedUrl'

export function buildStatementR2Key(artistId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `statements/${artistId}/${randomUUID()}_${safeName}`
}

export async function uploadStatementPdfToR2(pdfBase64: string, r2Key: string): Promise<void> {
  const { serverEnv } = await import('@/lib/env.server')
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )

  const uploadUrl = await generatePresignedUploadUrl(r2Key, 'application/pdf', {
    getSignedUrl,
    s3Client: s3,
    bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
  })

  const pdfBuffer = Buffer.from(pdfBase64, 'base64')
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: pdfBuffer,
    headers: { 'Content-Type': 'application/pdf' },
  })

  if (!uploadRes.ok) {
    throw new Error(`R2 upload failed (${uploadRes.status})`)
  }
}

/** Best-effort delete of a statement PDF from R2 (logs on failure, does not throw). */
export async function deleteStatementPdfFromR2(r2Key: string): Promise<void> {
  try {
    const { serverEnv } = await import('@/lib/env.server')
    const s3 = createR2Client(
      serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
      serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
      serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    )
    await deleteObjectFromR2(r2Key, s3, serverEnv.CLOUDFLARE_R2_BUCKET_NAME)
  } catch (err) {
    console.warn('[deleteStatementPdfFromR2] Failed to delete R2 object:', r2Key, err)
  }
}