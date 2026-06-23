export interface PortalUploadRules {
  maxBytes: number
  allowedMimeTypes: readonly string[]
}

export const PORTAL_PHOTO_RULES: PortalUploadRules = {
  maxBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
}

export const PORTAL_COVER_RULES: PortalUploadRules = {
  maxBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
}

export const PORTAL_ASSET_RULES: PortalUploadRules = {
  maxBytes: 20 * 1024 * 1024,
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/zip',
  ],
}

/**
 * Validates a file against portal upload rules.
 * Returns an error message string, or null when valid.
 */
export function validatePortalUpload(file: File, rules: PortalUploadRules): string | null {
  if (file.size > rules.maxBytes) {
    const maxMb = Math.round(rules.maxBytes / (1024 * 1024))
    return `File too large (max ${maxMb} MB)`
  }

  if (!rules.allowedMimeTypes.includes(file.type)) {
    return 'Unsupported file type'
  }

  return null
}