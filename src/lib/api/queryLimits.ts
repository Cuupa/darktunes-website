/**
 * SSOT for unbounded public and portal query caps.
 *
 * Import these constants in DAL functions and client-side fetchers instead of
 * hard-coding numeric literals so limits can be reviewed and updated in one place.
 */
export const PUBLIC_QUERY_LIMITS = {
  /** Maximum visible artists returned by getPublicArtists. */
  artists: 200,
  /** Maximum releases returned by getPublicReleases. */
  releases: 500,
  /** Maximum news posts returned by getPublicNewsPosts / getPressOnlyNewsPosts. */
  news: 100,
  /** Maximum news posts returned by getPublicNewsPostsByArtistId. */
  newsByArtist: 50,
  /** Maximum concerts returned by getPublicConcerts. */
  concerts: 500,
  /** Maximum statements per artist returned by getSalesStatementsByArtistId. */
  statementsByArtist: 200,
  /** Maximum statements loaded in the admin StatementsManager client component. */
  statementsAdmin: 500,
} as const
