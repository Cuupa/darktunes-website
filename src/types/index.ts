export interface Artist {
  id: string
  name: string
  slug: string
  bio: string
  genres: string[]
  imageUrl: string
  spotifyUrl?: string
  instagramUrl?: string
  youtubeUrl?: string
  websiteUrl?: string
  featured: boolean
}

export interface Release {
  id: string
  title: string
  artistId: string
  artistName: string
  releaseDate: string
  coverArt: string
  type: 'album' | 'ep' | 'single'
  spotifyUrl?: string
  appleMusicUrl?: string
  youtubeUrl?: string
  featured: boolean
}

export interface NewsPost {
  id: string
  title: string
  excerpt: string
  content: string
  publishedAt: string
  imageUrl?: string
  slug: string
}

export interface Video {
  id: string
  title: string
  artistName: string
  youtubeId: string
  thumbnailUrl: string
  publishedAt: string
}
