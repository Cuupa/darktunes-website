/** Vercel body limit is 4.5 MB (Hobby) / 50 MB (Pro); keep headroom for multipart overhead. */
export const MAX_BRONZE_CSV_BYTES = 45 * 1024 * 1024