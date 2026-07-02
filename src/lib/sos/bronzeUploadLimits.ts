/** Vercel function request-body hard cap (all plans). See FUNCTION_PAYLOAD_TOO_LARGE. */
export const VERCEL_FUNCTION_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024

/**
 * Chunk size for server-side multipart uploads (Vercel proxy fallback only).
 * Must stay below VERCEL_FUNCTION_BODY_LIMIT_BYTES after FormData overhead.
 */
export const BRONZE_UPLOAD_CHUNK_BYTES = 4 * 1024 * 1024

/** Files above this size use multipart in the server-proxy fallback path. */
export const MAX_BRONZE_CSV_SERVER_BYTES = BRONZE_UPLOAD_CHUNK_BYTES

/** Maximum bronze CSV size (direct R2 upload via presigned URLs). */
export const MAX_BRONZE_CSV_BYTES = 1024 * 1024 * 1024

/** Presigned multipart part size for browser → R2 direct upload. */
export const BRONZE_DIRECT_UPLOAD_PART_BYTES = 64 * 1024 * 1024

/** Files at or below this size use a single presigned PUT (browser → R2). */
export const BRONZE_SINGLE_PUT_MAX_BYTES = 100 * 1024 * 1024

/** Max accepted part payload in the server-proxy multipart/part route. */
export const MAX_BRONZE_MULTIPART_PART_BYTES = BRONZE_UPLOAD_CHUNK_BYTES + 256 * 1024