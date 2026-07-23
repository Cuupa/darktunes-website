/**
 * Browser-side cover art validation (JPEG magic bytes + exact 3000×3000).
 * No network — used before upload so artists get instant feedback without CORS.
 */

import {
  COVER_ART_REQUIRED_SIZE,
  isJpegMagicBytes,
  isValidCoverArtSize,
} from '@/lib/submissions/coverArtUrl'

/** High-quality 3000×3000 JPEGs often exceed 5 MB; keep headroom under portal limits. */
export const SUBMISSION_COVER_MAX_BYTES = 15 * 1024 * 1024

export type CoverArtClientStatus =
  | 'ok'
  | 'too_large'
  | 'wrong_format'
  | 'wrong_size'
  | 'read_error'

export interface CoverArtClientResult {
  status: CoverArtClientStatus
  verified: boolean
  width?: number
  height?: number
  message?: string
}

/**
 * Validate a local File as release cover art (JPEG, exactly 3000×3000).
 */
export async function validateCoverArtFile(file: File): Promise<CoverArtClientResult> {
  if (file.size > SUBMISSION_COVER_MAX_BYTES) {
    return {
      status: 'too_large',
      verified: false,
      message: `Cover art is too large (max ${Math.round(SUBMISSION_COVER_MAX_BYTES / (1024 * 1024))} MB)`,
    }
  }

  // Prefer MIME when present, but always confirm with magic bytes
  if (file.type && file.type !== 'image/jpeg' && file.type !== 'image/jpg') {
    // Some browsers report empty type for renamed files — still check bytes
    if (file.type.startsWith('image/') && file.type !== 'image/jpeg') {
      return {
        status: 'wrong_format',
        verified: false,
        message: 'Cover art must be JPEG/JPG',
      }
    }
  }

  try {
    const header = new Uint8Array(await file.slice(0, 3).arrayBuffer())
    if (!isJpegMagicBytes(header)) {
      return {
        status: 'wrong_format',
        verified: false,
        message: 'Cover art must be JPEG/JPG',
      }
    }
  } catch {
    return {
      status: 'read_error',
      verified: false,
      message: 'Could not read the selected file',
    }
  }

  try {
    const dims = await readImageDimensions(file)
    if (!isValidCoverArtSize(dims.width, dims.height)) {
      return {
        status: 'wrong_size',
        verified: false,
        width: dims.width,
        height: dims.height,
        message: `Expected ${COVER_ART_REQUIRED_SIZE}×${COVER_ART_REQUIRED_SIZE} px, got ${dims.width}×${dims.height} px`,
      }
    }
    return {
      status: 'ok',
      verified: true,
      width: dims.width,
      height: dims.height,
    }
  } catch {
    return {
      status: 'read_error',
      verified: false,
      message: 'Could not read image dimensions',
    }
  }
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  // createImageBitmap is accurate and avoids layout; fall back to Image element
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    try {
      return { width: bitmap.width, height: bitmap.height }
    } finally {
      bitmap.close()
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const width = img.naturalWidth
      const height = img.naturalHeight
      URL.revokeObjectURL(objectUrl)
      resolve({ width, height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Image decode failed'))
    }
    img.src = objectUrl
  })
}
