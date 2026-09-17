import { describe, expect, it } from 'vitest'
import {
  BRONZE_DIRECT_UPLOAD_PART_BYTES,
  BRONZE_R2_MIN_PART_BYTES,
  BRONZE_SINGLE_PUT_MAX_BYTES,
  MAX_BRONZE_CSV_BYTES,
  MAX_BRONZE_CSV_SERVER_BYTES,
  VERCEL_FUNCTION_BODY_LIMIT_BYTES,
} from './bronzeUploadLimits'

describe('bronzeUploadLimits', () => {
  it('keeps the server proxy within the Vercel body cap', () => {
    expect(MAX_BRONZE_CSV_SERVER_BYTES).toBeLessThan(VERCEL_FUNCTION_BODY_LIMIT_BYTES)
  })

  it('keeps direct multipart parts provider-conform', () => {
    expect(BRONZE_DIRECT_UPLOAD_PART_BYTES).toBeGreaterThanOrEqual(BRONZE_R2_MIN_PART_BYTES)
    expect(BRONZE_DIRECT_UPLOAD_PART_BYTES).toBeGreaterThan(MAX_BRONZE_CSV_SERVER_BYTES)
  })

  it('allows large direct uploads to R2 via presigned URLs', () => {
    expect(MAX_BRONZE_CSV_BYTES).toBeGreaterThan(200 * 1024 * 1024)
    expect(BRONZE_SINGLE_PUT_MAX_BYTES).toBeGreaterThan(BRONZE_DIRECT_UPLOAD_PART_BYTES)
    expect(BRONZE_SINGLE_PUT_MAX_BYTES).toBeLessThan(MAX_BRONZE_CSV_BYTES)
  })
})
