/**
 * src/lib/api/portalProfile.ts
 *
 * Networking helpers for the Artist Portal profile page.
 * Keeps XHR/fetch calls out of the UI component (SRP).
 */

export interface ArtistProfilePayload {
  artist_id: string
  bio: string | null
  bio_short: string | null
  bio_medium: string | null
  bio_long: string | null
  photo_url: string | null
  genres: string[]
  press_quote: string | null
  founding_year: number | null
  hometown: string | null
  booking_contact: string | null
  press_contact: string | null
  website_url: string | null
  instagram_url: string | null
  youtube_url: string | null
  bandcamp_url: string | null
  spotify_url: string | null
  apple_music_url: string | null
  tiktok_url: string | null
  facebook_url: string | null
  soundcloud_url: string | null
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
        reject(new Error(`Upload failed (${xhr.status})`))
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
    throw new Error(`Save failed (${res.status})`)
  }
}
