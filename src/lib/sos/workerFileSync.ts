export function fileParseFingerprint(id: string, data: string): string {
  return `${id}:${data.length}:${data.slice(0, 64)}:${data.slice(-64)}`
}

export function planCsvWorkerFileSync(
  files: Array<{ id: string; data?: string }>,
  sentFingerprints: ReadonlyMap<string, string>,
): { toRemove: string[]; toAdd: string[] } {
  const current = new Map<string, string>()
  for (const file of files) {
    if (!file.data) continue
    current.set(file.id, fileParseFingerprint(file.id, file.data))
  }

  const toRemove: string[] = []
  const toAdd: string[] = []

  for (const id of sentFingerprints.keys()) {
    if (!current.has(id)) toRemove.push(id)
  }

  for (const [id, fingerprint] of current) {
    if (sentFingerprints.get(id) === fingerprint) continue
    if (sentFingerprints.has(id)) toRemove.push(id)
    toAdd.push(id)
  }

  return { toRemove, toAdd }
}
