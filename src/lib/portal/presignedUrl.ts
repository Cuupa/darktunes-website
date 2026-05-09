/**
 * src/lib/portal/presignedUrl.ts
 *
 * Pure, dependency-injected utility for generating short-lived presigned
 * download URLs for private R2 objects.
 *
 * The 5-minute (300 second) expiry satisfies the "short-lived" requirement
 * from the problem spec while giving users enough time to initiate a download.
 *
 * Design: All external dependencies (S3Client, getSignedUrl) are injected via
 * `PresignedUrlDeps` so this module is fully testable without real AWS calls.
 */

import type { S3Client } from '@aws-sdk/client-s3'
import { GetObjectCommand } from '@aws-sdk/client-s3'

const PRESIGNED_URL_EXPIRY_SECONDS = 300 // 5 minutes

// ---------------------------------------------------------------------------
// Dependency injection interface
// ---------------------------------------------------------------------------

export interface PresignedUrlDeps {
  /** Injectable getSignedUrl implementation (from @aws-sdk/s3-request-presigner) */
  getSignedUrl: (
    client: S3Client,
    command: GetObjectCommand,
    options: { expiresIn: number },
  ) => Promise<string>
  /** Pre-configured S3Client pointed at Cloudflare R2 */
  s3Client: S3Client
  /** R2 bucket name containing the private statements */
  bucket: string
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Generates a short-lived presigned GET URL for a private R2 object.
 *
 * @param r2Key - Object key inside the R2 bucket (e.g. "statements/artist-uuid/Q1-2024.pdf")
 * @param deps  - Injected dependencies (S3Client, getSignedUrl, bucket)
 * @returns     - A presigned URL valid for 5 minutes
 */
export async function generatePresignedDownloadUrl(
  r2Key: string,
  deps: PresignedUrlDeps,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: deps.bucket,
    Key: r2Key,
  })

  return deps.getSignedUrl(deps.s3Client, command, {
    expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
  })
}
