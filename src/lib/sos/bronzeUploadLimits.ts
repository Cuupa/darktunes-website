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

/** Presigned multipart part size for browser → R2 direct upload. */
export const BRONZE_DIRECT_UPLOAD_PART_BYTES = 64 * 1024 * 1024

/** Files at or below this size use a single presigned PUT (browser → R2). */
export const BRONZE_SINGLE_PUT_MAX_BYTES = 100 * 1024 * 1024

/** R2 requires every non-final multipart part to be at least 5 MiB. */
export const BRONZE_R2_MIN_PART_BYTES = 5 * 1024 * 1024
