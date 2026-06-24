/**
 * src/lib/portal/presignedUrl.ts
 *
 * Pure, dependency-injected utilities for generating short-lived presigned
 * URLs for private R2 objects.
 *
 * - `generatePresignedDownloadUrl` — presigned GET URL for artists to download PDFs
 *   (5-minute expiry; sufficient for the browser download to start)
 * - `generatePresignedUploadUrl`   — presigned PUT URL for the SOS generator to
 *   upload PDFs directly to R2 without routing the binary through Vercel Serverless
 *   Functions (which have a 4.5 MB request body limit)
 *   (15-minute expiry; allows time to render and upload the PDF)
 *
 * Design: All external dependencies (S3Client, getSignedUrl) are injected via
 * deps interfaces so both functions are fully testable without real AWS calls.
 */

import type { S3Client } from '@aws-sdk/client-s3'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

/** Artist-facing download links expire after 5 minutes. */
const DOWNLOAD_EXPIRY_SECONDS = 300

/**
 * Server-to-server upload links expire after 15 minutes.
 * This gives the SOS generator enough time to render a complex PDF and
 * stream it directly to R2 without hitting the Vercel body-size limit.
 */
const UPLOAD_EXPIRY_SECONDS = 900

// ---------------------------------------------------------------------------
// Download — dependency injection interface
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
// Upload — dependency injection interface
// ---------------------------------------------------------------------------

export interface PresignedUploadUrlDeps {
  /** Injectable getSignedUrl implementation (from @aws-sdk/s3-request-presigner) */
  getSignedUrl: (
    client: S3Client,
    command: PutObjectCommand,
    options: { expiresIn: number },
  ) => Promise<string>
  /** Pre-configured S3Client pointed at Cloudflare R2 */
  s3Client: S3Client
  /** R2 bucket name to upload into */
  bucket: string
}

// ---------------------------------------------------------------------------
// generatePresignedDownloadUrl
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
    expiresIn: DOWNLOAD_EXPIRY_SECONDS,
  })
}

// ---------------------------------------------------------------------------
// generatePresignedUploadUrl
// ---------------------------------------------------------------------------

/**
 * Generates a short-lived presigned PUT URL so an external service (e.g. the
 * SOS PDF generator) can upload a file directly to R2, bypassing Vercel's
 * 4.5 MB Serverless Function request body limit.
 *
 * @param r2Key      - Destination object key (e.g. "statements/artist-uuid/Q1-2024.pdf")
 * @param contentType - MIME type of the object being uploaded (e.g. "application/pdf")
 * @param deps       - Injected dependencies (S3Client, getSignedUrl, bucket)
 * @returns          - A presigned PUT URL valid for 15 minutes
 */
export async function generatePresignedUploadUrl(
  r2Key: string,
  contentType: string,
  deps: PresignedUploadUrlDeps,
  expiresInSeconds: number = UPLOAD_EXPIRY_SECONDS,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: deps.bucket,
    Key: r2Key,
    ContentType: contentType,
  })

  return deps.getSignedUrl(deps.s3Client, command, {
    expiresIn: expiresInSeconds,
  })
}
