/**
 * Client helper: download bronze CSV text via presigned R2 GET (bypasses Vercel response limit).
 */

export async function downloadBronzeCsvText(batchId: string): Promise<string> {
  const presignRes = await fetch(`/api/admin/sos/import-batches/${batchId}/presign-download`)
  if (!presignRes.ok) {
    const errBody = await presignRes.json().catch(() => ({}))
    const message =
      typeof errBody === 'object' && errBody && 'error' in errBody
        ? String((errBody as { error: unknown }).error)
        : presignRes.statusText || `HTTP ${presignRes.status}`
    throw new Error(message)
  }

  const { downloadUrl } = (await presignRes.json()) as { downloadUrl?: string }
  if (!downloadUrl) throw new Error('Missing presigned download URL')

  const csvRes = await fetch(downloadUrl)
  if (!csvRes.ok) {
    throw new Error(`Bronze download failed (${csvRes.status})`)
  }

  return csvRes.text()
}