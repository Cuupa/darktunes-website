export function getAllReleases(releaseTitlesByArtist: Record<string, string[]>): string[] {
  const seen = new Set<string>()
  for (const titles of Object.values(releaseTitlesByArtist)) {
    for (const title of titles) {
      seen.add(title)
    }
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b))
}
