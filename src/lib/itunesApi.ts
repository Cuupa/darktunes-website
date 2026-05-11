export interface iTunesRelease {
  collectionId: number
  collectionName: string
  artistId: number
  artistName: string
  artworkUrl100: string
  artworkUrl600?: string
  releaseDate: string
  collectionType: string
  trackCount: number
  primaryGenreName: string
  collectionViewUrl: string
  wrapperType?: string
}

export interface iTunesSearchResponse {
  resultCount: number
  results: Array<{ artistId: number; artistName: string }>
}

export interface iTunesLookupResponse {
  resultCount: number
  results: iTunesRelease[]
}

function upgradeArtworkUrl(url: string): string {
  return url.replace(/\d+x\d+bb(\.\w+)$/, '3000x3000bb$1')
}

export async function searchItunesArtist(
  artistName: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<iTunesRelease[]> {
  const encodedArtist = encodeURIComponent(artistName)
  const searchResponse = await fetchFn(
    `https://itunes.apple.com/search?term=${encodedArtist}&entity=musicArtist&attribute=artistTerm&limit=5`,
  )

  if (!searchResponse.ok) {
    throw new Error(`iTunes API error: ${searchResponse.status}`)
  }

  const searchData = (await searchResponse.json()) as iTunesSearchResponse
  const artistMatch = searchData.results.find(
    (result) => result.artistName.toLowerCase() === artistName.toLowerCase(),
  )

  if (!artistMatch?.artistId) return []

  const lookupResponse = await fetchFn(
    `https://itunes.apple.com/lookup?id=${artistMatch.artistId}&entity=album&limit=200`,
  )

  if (!lookupResponse.ok) {
    throw new Error(`iTunes API error: ${lookupResponse.status}`)
  }

  const lookupData = (await lookupResponse.json()) as iTunesLookupResponse

  return lookupData.results
    .filter((result) => result.wrapperType === 'collection')
    .map((result) => ({
      ...result,
      artworkUrl100: upgradeArtworkUrl(result.artworkUrl100),
      artworkUrl600: result.artworkUrl600 ? upgradeArtworkUrl(result.artworkUrl600) : result.artworkUrl600,
    }))
}

export async function getAllArtistsReleases(artistNames: string[]): Promise<Map<string, iTunesRelease[]>> {
  const releasesMap = new Map<string, iTunesRelease[]>()
  
  const fetchPromises = artistNames.map(async (artistName) => {
    const releases = await searchItunesArtist(artistName)
    return { artistName, releases }
  })
  
  const results = await Promise.all(fetchPromises)
  
  results.forEach(({ artistName, releases }) => {
    if (releases.length > 0) {
      releasesMap.set(artistName, releases)
    }
  })
  
  return releasesMap
}

export function convertItunesReleaseToRelease(itunesRelease: iTunesRelease): {
  id: string
  title: string
  artistId: string
  artistName: string
  releaseDate: string
  coverArt: string
  type: 'album' | 'ep' | 'single'
  appleMusicUrl: string
  featured: boolean
} {
  const type = itunesRelease.trackCount === 1 
    ? 'single' 
    : itunesRelease.trackCount <= 6 
      ? 'ep' 
      : 'album'
  
  return {
    id: String(itunesRelease.collectionId),
    title: itunesRelease.collectionName,
    artistId: String(itunesRelease.artistId),
    artistName: itunesRelease.artistName,
    releaseDate: itunesRelease.releaseDate.split('T')[0],
    coverArt: upgradeArtworkUrl(itunesRelease.artworkUrl100),
    type,
    appleMusicUrl: itunesRelease.collectionViewUrl,
    featured: false
  }
}
