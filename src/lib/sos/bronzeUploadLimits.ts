/** Vercel body limit is 4.5 MB (Hobby) / 50 MB (Pro); keep headroom for multipart overhead. */
export const MAX_BRONZE_CSV_SERVER_BYTES = 45 * 1024 * 1024

/** Direct browser PUT to R2 via presigned URL (requires R2 CORS for the site origin). */
export const MAX_BRONZE_CSV_BYTES = 200 * 1024 * 1024