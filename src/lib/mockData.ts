import type { Artist, Release, NewsPost, Video } from '@/types'

export const mockArtists: Artist[] = [
  {
    id: '1',
    name: 'C Z A R I N A',
    slug: 'czarina',
    bio: 'Dark electronic pop artist pushing boundaries with haunting vocals and industrial beats. CZARINA crafts atmospheric soundscapes that blend synthetic textures with raw emotion.',
    genres: ['Darkpop', 'Electronic', 'Industrial'],
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=800&fit=crop',
    spotifyUrl: 'https://open.spotify.com/artist/example',
    instagramUrl: 'https://instagram.com/czarina',
    featured: true
  },
  {
    id: '2',
    name: 'BLACKBOOK',
    slug: 'blackbook',
    bio: 'Merging gothic rock with modern metal sensibilities, BLACKBOOK delivers powerful performances that resonate with darkness and intensity.',
    genres: ['Gothic Rock', 'Metal'],
    imageUrl: 'https://images.unsplash.com/photo-1528722828814-77b9b83aafb2?w=800&h=800&fit=crop',
    spotifyUrl: 'https://open.spotify.com/artist/example',
    youtubeUrl: 'https://youtube.com/@blackbook',
    featured: true
  },
  {
    id: '3',
    name: 'SMASH HIT COMBO',
    slug: 'smash-hit-combo',
    bio: 'High-energy alternative rock with punk influences. Raw, unfiltered, and unapologetically loud.',
    genres: ['Alternative', 'Punk', 'Rock'],
    imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=800&fit=crop',
    instagramUrl: 'https://instagram.com/smashhitcombo',
    featured: false
  },
  {
    id: '4',
    name: 'FROZEN PLASMA',
    slug: 'frozen-plasma',
    bio: 'Pioneers of the synthpop revival, FROZEN PLASMA combines retro electronic aesthetics with contemporary production.',
    genres: ['Synthpop', 'Electro'],
    imageUrl: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&h=800&fit=crop',
    spotifyUrl: 'https://open.spotify.com/artist/example',
    featured: false
  },
  {
    id: '5',
    name: 'CATTAC',
    slug: 'cattac',
    bio: 'Aggressive industrial metal with mechanical precision. CATTAC delivers sonic warfare through complex rhythms and distorted vocals.',
    genres: ['Industrial', 'Metal'],
    imageUrl: 'https://images.unsplash.com/photo-1524650359799-842906ca1c06?w=800&h=800&fit=crop',
    youtubeUrl: 'https://youtube.com/@cattac',
    featured: false
  },
  {
    id: '6',
    name: 'NEON VOID',
    slug: 'neon-void',
    bio: 'Cyberpunk-inspired electronic artist creating dystopian soundscapes. The future sounds dark with NEON VOID.',
    genres: ['Electronic', 'Industrial', 'Darkwave'],
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=800&fit=crop',
    spotifyUrl: 'https://open.spotify.com/artist/example',
    featured: false
  }
]

export const mockReleases: Release[] = [
  {
    id: '1',
    title: 'Polymorph',
    artistId: '1',
    artistName: 'C Z A R I N A',
    releaseDate: '2024-03-15',
    coverArt: 'https://images.unsplash.com/photo-1611339555312-e607c8352fd7?w=800&h=800&fit=crop',
    type: 'album',
    spotifyUrl: 'https://open.spotify.com/album/example',
    featured: true
  },
  {
    id: '2',
    title: 'Monsters',
    artistId: '2',
    artistName: 'BLACKBOOK',
    releaseDate: '2024-04-24',
    coverArt: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&h=800&fit=crop',
    type: 'single',
    spotifyUrl: 'https://open.spotify.com/track/example',
    youtubeUrl: 'https://youtube.com/watch?v=example',
    featured: true
  },
  {
    id: '3',
    title: 'Split',
    artistId: '3',
    artistName: 'SMASH HIT COMBO',
    releaseDate: '2024-04-17',
    coverArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=800&fit=crop',
    type: 'single',
    spotifyUrl: 'https://open.spotify.com/track/example',
    featured: true
  },
  {
    id: '4',
    title: 'Synthetic Dreams',
    artistId: '4',
    artistName: 'FROZEN PLASMA',
    releaseDate: '2024-03-27',
    coverArt: 'https://images.unsplash.com/photo-1558007685-38a2e6f1a845?w=800&h=800&fit=crop',
    type: 'ep',
    spotifyUrl: 'https://open.spotify.com/album/example',
    featured: false
  },
  {
    id: '5',
    title: 'Machine Heart',
    artistId: '5',
    artistName: 'CATTAC',
    releaseDate: '2024-02-14',
    coverArt: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=800&fit=crop',
    type: 'album',
    spotifyUrl: 'https://open.spotify.com/album/example',
    featured: false
  }
]

export const mockNews: NewsPost[] = [
  {
    id: '1',
    title: 'BLACKBOOK Returns with Brand New Single "Monsters"',
    excerpt: 'With "MONSTERS," BLACKBOOK deliver one of their most emotionally direct and introspective releases to date. Blending atmospheric modern rock with raw, honest lyricism.',
    content: 'Full article content would go here...',
    publishedAt: '2024-04-24',
    imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1200&h=600&fit=crop',
    slug: 'blackbook-monsters'
  },
  {
    id: '2',
    title: 'THROATCUT Signs with darkTunes Music Group',
    excerpt: 'We are thrilled to announce the signing of brutal metalcore act THROATCUT to the darkTunes roster. Prepare for uncompromising heaviness.',
    content: 'Full article content would go here...',
    publishedAt: '2024-05-01',
    imageUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=1200&h=600&fit=crop',
    slug: 'throatcut-signing'
  },
  {
    id: '3',
    title: 'C Z A R I N A Unveils "Polymorph" - A Genre-Defying Masterpiece',
    excerpt: 'The highly anticipated album "Polymorph" showcases CZARINA\'s evolution as a darkpop visionary, pushing sonic boundaries further than ever.',
    content: 'Full article content would go here...',
    publishedAt: '2024-03-15',
    slug: 'czarina-polymorph'
  },
  {
    id: '4',
    title: 'darkTunes Announces 2024 European Tour Dates',
    excerpt: 'Get ready for the darkTunes showcase tour hitting major European cities this fall. Featuring CATTAC, NEON VOID, and surprise guests.',
    content: 'Full article content would go here...',
    publishedAt: '2024-05-03',
    slug: 'european-tour-2024'
  }
]

export const mockVideos: Video[] = [
  {
    id: '1',
    title: 'Monsters (Official Music Video)',
    artistName: 'BLACKBOOK',
    youtubeId: 'dQw4w9WgXcQ',
    thumbnailUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1200&h=675&fit=crop',
    publishedAt: '2024-04-24'
  },
  {
    id: '2',
    title: 'Polymorph (Visualizer)',
    artistName: 'C Z A R I N A',
    youtubeId: 'dQw4w9WgXcQ',
    thumbnailUrl: 'https://images.unsplash.com/photo-1611339555312-e607c8352fd7?w=1200&h=675&fit=crop',
    publishedAt: '2024-03-15'
  },
  {
    id: '3',
    title: 'Split (Official Video)',
    artistName: 'SMASH HIT COMBO',
    youtubeId: 'dQw4w9WgXcQ',
    thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&h=675&fit=crop',
    publishedAt: '2024-04-17'
  }
]
