import { describe, expect, it } from 'vitest'
import {
  BRONZE_DIRECT_UPLOAD_PART_BYTES,
  BRONZE_SINGLE_PUT_MAX_BYTES,
  BRONZE_UPLOAD_CHUNK_BYTES,
  MAX_BRONZE_CSV_BYTES,
  MAX_BRONZE_CSV_SERVER_BYTES,
  MAX_BRONZE_MULTIPART_PART_BYTES,
  VERCEL_FUNCTION_BODY_LIMIT_BYTES,
} from './bronzeUploadLimits'

describe('bronzeUploadLimits', () => {
  it('keeps server-proxy chunks within Vercel body cap', () => {
    expect(MAX_BRONZE_CSV_SERVER_BYTES).toBe(BRONZE_UPLOAD_CHUNK_BYTES)
    expect(MAX_BRONZE_MULTIPART_PART_BYTES).toBeLessThanOrEqual(
      VERCEL_FUNCTION_BODY_LIMIT_BYTES,
    )
    expect(BRONZE_UPLOAD_CHUNK_BYTES).toBeLessThan(VERCEL_FUNCTION_BODY_LIMIT_BYTES)
  })

  it('allows large direct uploads to R2 via presigned URLs', () => {
    expect(MAX_BRONZE_CSV_BYTES).toBeGreaterThan(200 * 1024 * 1024)
    expect(BRONZE_DIRECT_UPLOAD_PART_BYTES).toBeGreaterThan(BRONZE_UPLOAD_CHUNK_BYTES)
    expect(BRONZE_SINGLE_PUT_MAX_BYTES).toBeLessThan(MAX_BRONZE_CSV_BYTES)
  })
})