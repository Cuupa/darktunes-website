export interface UploadReleaseSubmissionAssetResult {
  r2_key: string
  id: string
}

function inferContentType(file: File, kind: 'audio' | 'cover'): string {
  if (file.type) return file.type
  const name = file.name.toLowerCase()
  if (kind === 'cover') return 'image/jpeg'
  if (name.endsWith('.zip')) return 'application/zip'
  if (name.endsWith('.wav')) return 'audio/wav'
  if (name.endsWith('.flac')) return 'audio/flac'
  if (name.endsWith('.aiff') || name.endsWith('.aif')) return 'audio/aiff'
  if (name.endsWith('.mp3')) return 'audio/mpeg'
  return 'application/octet-stream'
}

export async function uploadReleaseSubmissionAsset(input: {
  artistId: string
  kind: 'audio' | 'cover'
  file: File
  accessToken: string
}): Promise<UploadReleaseSubmissionAssetResult> {
  const registerUrl = `/api/portal/release-submission-assets?artistId=${encodeURIComponent(input.artistId)}`
  const registerRes = await fetch(registerUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      kind: input.kind,
      file_name: input.file.name,
      content_type: inferContentType(input.file, input.kind),
      byte_size: input.file.size,
    }),
  })
  if (!registerRes.ok) {
    const err = (await registerRes.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Upload of “${input.file.name}” failed (HTTP ${registerRes.status}).`)
  }
  const registered = (await registerRes.json()) as {
    id: string
    r2_key: string
    upload_url: string
    content_type: string
  }
  const putRes = await fetch(registered.upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': registered.content_type,
    },
    body: input.file,
  })
  if (!putRes.ok) {
    throw new Error(
      `Upload of “${input.file.name}” to storage failed (HTTP ${putRes.status}). Check the connection and retry.`,
    )
  }
  return { r2_key: registered.r2_key, id: registered.id }
}
