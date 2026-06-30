/** Maps snake_case schema field keys to camelCase submit-release body keys. */
export const RELEASE_STANDARD_FIELD_TO_BODY_KEY: Record<string, string> = {
  title: 'title',
  audio_download_url: 'audioDownloadUrl',
  cover_art_url: 'coverArtUrl',
  cover_art_verified: 'coverArtVerified',
  release_date: 'releaseDate',
  type: 'type',
  genre: 'genre',
  catalog_number: 'catalogNumber',
  isrc: 'isrc',
  label_copy: 'labelCopy',
  spotify_url: 'spotifyUrl',
  apple_music_url: 'appleMusicUrl',
  youtube_url: 'youtubeUrl',
  notes: 'notes',
}