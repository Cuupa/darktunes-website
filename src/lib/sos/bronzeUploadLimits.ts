/** Vercel body limit is 4.5 MB (Hobby) / 50 MB (Pro); keep headroom for multipart overhead. */
export const MAX_BRONZE_CSV_SERVER_BYTES = 45 * 1024 * 1024

/** Maximum bronze CSV size (multipart upload via server chunks). */
export const MAX_BRONZE_CSV_BYTES = 200 * 1024 * 1024

/** Chunk size for server-side multipart uploads (must stay below MAX_BRONZE_CSV_SERVER_BYTES). */
export const BRONZE_UPLOAD_CHUNK_BYTES = 20 * 1024 * 1024