import { describe, expect, it } from 'vitest'
import {
  BRONZE_DIRECT_UPLOAD_PART_BYTES,
  BRONZE_R2_MIN_PART_BYTES,
  BRONZE_SINGLE_PUT_MAX_BYTES,
  planBronzeDirectUpload,
} from './bronzeUploadLimits'

/** Byte sizes of `statement of sales examples/Q4 2025 - Q1 2026/` (gitignored CSVs). */
const BELIEVE_Q4_2025_BYTES = 63_671_078
const BELIEVE_Q1_2026_BYTES = 71_684_050
const BANDCAMP_RAW_BYTES = 2_400_806
const BANDCAMP_PAYOUTS_BYTES = 500_215
const DARKMERCH_CSV_BYTES = 7_454

describe('planBronzeDirectUpload', () => {
  it('uses a single PUT at and below 32 MB', () => {
    expect(planBronzeDirectUpload(BRONZE_SINGLE_PUT_MAX_BYTES)).toEqual({
      mode: 'single-put',
      partCount: 1,
      lastPartBytes: BRONZE_SINGLE_PUT_MAX_BYTES,
    })
    expect(planBronzeDirectUpload(BANDCAMP_RAW_BYTES).mode).toBe('single-put')
    expect(planBronzeDirectUpload(BANDCAMP_PAYOUTS_BYTES).mode).toBe('single-put')
    expect(planBronzeDirectUpload(DARKMERCH_CSV_BYTES).mode).toBe('single-put')
  })

  it('splits Believe Q4 2025 into four 16 MB parts with a legal last part', () => {
    const plan = planBronzeDirectUpload(BELIEVE_Q4_2025_BYTES)
    expect(plan.mode).toBe('multipart')
    expect(plan.partCount).toBe(4)
    expect(plan.lastPartBytes).toBe(BELIEVE_Q4_2025_BYTES - 3 * BRONZE_DIRECT_UPLOAD_PART_BYTES)
    expect(plan.lastPartBytes).toBeGreaterThanOrEqual(BRONZE_R2_MIN_PART_BYTES)
  })

  it('accepts Believe Q1 2026 whose final part is below the 5 MiB non-final floor', () => {
    const plan = planBronzeDirectUpload(BELIEVE_Q1_2026_BYTES)
    expect(plan.mode).toBe('multipart')
    expect(plan.partCount).toBe(5)
    expect(plan.lastPartBytes).toBe(BELIEVE_Q1_2026_BYTES - 4 * BRONZE_DIRECT_UPLOAD_PART_BYTES)
    expect(plan.lastPartBytes).toBeGreaterThan(0)
    expect(plan.lastPartBytes).toBeLessThan(BRONZE_R2_MIN_PART_BYTES)
  })
})
