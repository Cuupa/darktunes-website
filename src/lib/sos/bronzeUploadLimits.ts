/** Vercel function request-body hard cap (all plans). See FUNCTION_PAYLOAD_TOO_LARGE. */
export const VERCEL_FUNCTION_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024

/**
 * Server-proxy single-request cap. Files above this size use the direct
 * browser → R2 presigned route (requires bucket CORS). The server proxy
 * never chunks multipart uploads — R2 rejects non-final parts below 5 MiB.
 */
export const MAX_BRONZE_CSV_SERVER_BYTES = 4 * 1024 * 1024

/** Maximum bronze CSV size (direct R2 upload via presigned URLs). */
export const MAX_BRONZE_CSV_BYTES = 1024 * 1024 * 1024

/**
 * Presigned multipart part size for browser → R2 direct upload.
 * Kept small so a dropped connection only costs one part, not the whole file.
 */
export const BRONZE_DIRECT_UPLOAD_PART_BYTES = 16 * 1024 * 1024

/**
 * Files at or below this size use a single presigned PUT (browser → R2).
 * Kept small on purpose: a single PUT cannot resume, so only genuinely small
 * files take it; every larger file uses resumable-by-part multipart.
 */
export const BRONZE_SINGLE_PUT_MAX_BYTES = 32 * 1024 * 1024

/** R2 requires every non-final multipart part to be at least 5 MiB. */
export const BRONZE_R2_MIN_PART_BYTES = 5 * 1024 * 1024

export type BronzeDirectUploadPlan = {
  mode: 'single-put' | 'multipart'
  partCount: number
  lastPartBytes: number
}

/**
 * How a bronze CSV of `fileSize` bytes is sent browser → R2.
 * The final multipart part may be below `BRONZE_R2_MIN_PART_BYTES`;
 * only non-final parts must meet that floor (Believe Q1 2026 last part is ~4.4 MiB).
 */
export function planBronzeDirectUpload(fileSize: number): BronzeDirectUploadPlan {
  if (fileSize <= BRONZE_SINGLE_PUT_MAX_BYTES) {
    return { mode: 'single-put', partCount: 1, lastPartBytes: fileSize }
  }
  const partCount = Math.ceil(fileSize / BRONZE_DIRECT_UPLOAD_PART_BYTES)
  const lastPartBytes = fileSize - (partCount - 1) * BRONZE_DIRECT_UPLOAD_PART_BYTES
  return { mode: 'multipart', partCount, lastPartBytes }
}
