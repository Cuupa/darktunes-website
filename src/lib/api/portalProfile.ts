/**
 * src/lib/api/portalProfile.ts
 *
 * Networking helpers for the Artist Portal profile page.
 * Keeps XHR/fetch calls out of the UI component (SRP).
 */

import type { Database } from '@/types/database'

/**
 * Payload for saving an artist profile via /api/portal/profile.
 * Derived from the DB Insert type to prevent type drift (TS-2).
 * Only the fields that the portal form surfaces are included.
 */
export type ArtistProfilePayload = Pick<
  Database['public']['Tables']['artist_profiles']['Insert'],
  | 'artist_id'
  | 'bio'
  | 'bio_short'
  | 'bio_medium'
  | 'bio_long'
  | 'photo_url'
  | 'genres'
  | 'press_quote'
  | 'founding_year'
  | 'hometown'
  | 'booking_contact'
  | 'press_contact'
  | 'website_url'
  | 'instagram_url'
  | 'youtube_url'
  | 'bandcamp_url'
  | 'spotify_url'
  | 'apple_music_url'
  | 'tiktok_url'
  | 'facebook_url'
  | 'soundcloud_url'
  | 'rider_stage_plot_url'
  | 'rider_technical_url'
  | 'rider_hospitality_url'
> & {
  // artist_id is required (not optional like in Insert)
  artist_id: string
}

export type RiderType = 'stage_plot' | 'technical' | 'hospitality'

/**
 * Upload a rider PDF via the /api/portal/upload-rider Route Handler.
 * Returns the public CDN URL of the uploaded document.
 */
export async function uploadRiderDocument(
  file: File,
  riderType: RiderType,
  token: string,
): Promise<string> {
  const body = new FormData()
  body.append('file', file)

  const res = await fetch(`/api/portal/upload-rider?type=${encodeURIComponent(riderType)}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body,
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}) ) as { error?: string }
    throw new Error(errBody.error ?? 'Upload failed')
  }

  const data = (await res.json()) as { url?: string }
  if (!data.url) throw new Error('No URL in response')
  return data.url
}

/**
 * Upload an artist photo via the /api/portal/upload-photo Route Handler.
 * Uses XHR so that upload progress can be reported via `onProgress`.
 *
 * @param artistId   The artist UUID.
 * @param file       The image file to upload.
 * @param token      The user's access token (Bearer).
 * @param onProgress Called with 0–100 as the upload progresses.
 * @returns          The public URL of the uploaded photo.
 */
export function uploadArtistPhoto(
  artistId: string,
  file: File,
  token: string,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const body = new FormData()
    body.append('file', file)
    body.append('artistId', artistId)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (ev) => {
      if (ev.lengthComputable) {
        onProgress(Math.round((ev.loaded / ev.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { url?: string }
          if (data.url) {
            onProgress(100)
            resolve(data.url)
          } else {
            reject(new Error('No URL in response'))
          }
        } catch {
          reject(new Error('Invalid server response'))
        }
      } else {
        try {
          const errBody = JSON.parse(xhr.responseText) as { error?: string }
          reject(new Error(errBody.error ?? 'Upload failed'))
        } catch {
          reject(new Error('Upload failed'))
        }
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error')))
    xhr.open('POST', '/api/portal/upload-photo')
    xhr.setRequestHeader('Authorization', 'Bearer ' + token)
    xhr.send(body)
  })
}

/**
 * Persist the artist profile via the /api/portal/profile Route Handler.
 *
 * @param payload  The profile data to save.
 * @param token    The user's access token (Bearer).
 * @throws         If the server returns a non-2xx status.
 */
export async function saveArtistProfile(
  payload: ArtistProfilePayload,
  token: string,
): Promise<void> {
  const res = await fetch('/api/portal/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}) ) as { error?: string }
    throw new Error(errBody.error ?? 'Save failed')
  }
}
