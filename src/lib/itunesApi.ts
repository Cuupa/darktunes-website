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
}

export interface iTunesSearchResponse {
  resultCount: number
  results: iTunesRelease[]
}

export async function searchItunesArtist(
  artistName: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<iTunesRelease[]> {
  const encodedArtist = encodeURIComponent(artistName)
  const response = await fetchFn(
    `https://itunes.apple.com/search?term=${encodedArtist}&entity=album&limit=200`
  )

  if (!response.ok) {
    throw new Error(`iTunes API error: ${response.status}`)
  }

  const data: iTunesSearchResponse = await response.json() as iTunesSearchResponse

  return data.results.filter(result =>
    result.artistName.toLowerCase() === artistName.toLowerCase()
  )
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
    coverArt: itunesRelease.artworkUrl600 || itunesRelease.artworkUrl100.replace('100x100', '600x600'),
    type,
    appleMusicUrl: itunesRelease.collectionViewUrl,
    featured: false
  }
}
