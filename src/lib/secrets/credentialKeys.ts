/**
 * SSOT for admin-managed external API credential keys stored in api_credentials.
 */

export type CredentialCategory = 'sync' | 'email' | 'newsletter' | 'monitoring'

export interface CredentialKeyDefinition {
  key: string
  label: string
  description: string
  category: CredentialCategory
  /** True for secrets (API keys, tokens); false for non-secret config (channel ID, from address). */
  isSecret: boolean
  docsUrl?: string
  /** Legacy env var name used by import-env migration. */
  envVar?: string
}

export const CREDENTIAL_KEY_DEFINITIONS: readonly CredentialKeyDefinition[] = [
  {
    key: 'spotify_client_id',
    label: 'Spotify Client ID',
    description: 'Spotify Web API client ID for artist sync and admin prefill.',
    category: 'sync',
    isSecret: false,
    docsUrl: 'https://developer.spotify.com/dashboard',
    envVar: 'SPOTIFY_CLIENT_ID',
  },
  {
    key: 'spotify_client_secret',
    label: 'Spotify Client Secret',
    description: 'Spotify Web API client secret.',
    category: 'sync',
    isSecret: true,
    docsUrl: 'https://developer.spotify.com/dashboard',
    envVar: 'SPOTIFY_CLIENT_SECRET',
  },
  {
    key: 'discogs_token',
    label: 'Discogs Token',
    description: 'Discogs Personal Access Token for release sync.',
    category: 'sync',
    isSecret: true,
    docsUrl: 'https://www.discogs.com/settings/developers',
    envVar: 'DISCOGS_TOKEN',
  },
  {
    key: 'songkick_api_key',
    label: 'Songkick API Key',
    description: 'Songkick API key for concert sync.',
    category: 'sync',
    isSecret: true,
    docsUrl: 'https://www.songkick.com/developer',
    envVar: 'SONGKICK_API_KEY',
  },
  {
    key: 'bandsintown_api_key',
    label: 'Bandsintown API Key',
    description: 'Global Bandsintown app_id fallback when per-artist key is unset.',
    category: 'sync',
    isSecret: true,
    docsUrl: 'https://www.bandsintown.com/api/overview',
    envVar: 'BANDSINTOWN_API_KEY',
  },
  {
    key: 'lastfm_api_key',
    label: 'Last.fm API Key',
    description: 'Last.fm API key for portal listener trend sync.',
    category: 'sync',
    isSecret: true,
    docsUrl: 'https://www.last.fm/api/account/create',
    envVar: 'LASTFM_API_KEY',
  },
  {
    key: 'soundcharts_api_key',
    label: 'Soundcharts API Key',
    description: 'Soundcharts API key for optional paid listener sync.',
    category: 'sync',
    isSecret: true,
    docsUrl: 'https://soundcharts.com',
    envVar: 'SOUNDCHARTS_API_KEY',
  },
  {
    key: 'youtube_api_key',
    label: 'YouTube API Key',
    description: 'YouTube Data API v3 key for channel video sync.',
    category: 'sync',
    isSecret: true,
    docsUrl: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
    envVar: 'YOUTUBE_API_KEY',
  },
  {
    key: 'youtube_channel_id',
    label: 'YouTube Channel ID',
    description: 'Label YouTube channel ID for /api/sync-youtube.',
    category: 'sync',
    isSecret: false,
    envVar: 'YOUTUBE_CHANNEL_ID',
  },
  {
    key: 'resend_api_key',
    label: 'Resend API Key',
    description: 'Resend API key for transactional email from Next.js routes.',
    category: 'email',
    isSecret: true,
    docsUrl: 'https://resend.com/api-keys',
    envVar: 'RESEND_API_KEY',
  },
  {
    key: 'resend_from_email',
    label: 'Resend From Address',
    description: 'Verified sender address for outgoing emails.',
    category: 'email',
    isSecret: false,
    envVar: 'RESEND_FROM_EMAIL',
  },
  {
    key: 'mailerlite_api_key',
    label: 'MailerLite API Key',
    description: 'MailerLite API key for post-DOI newsletter sync.',
    category: 'newsletter',
    isSecret: true,
    docsUrl: 'https://developers.mailerlite.com/',
    envVar: 'MAILERLITE_API_KEY',
  },
  {
    key: 'mailerlite_group_id',
    label: 'MailerLite Group ID',
    description: 'MailerLite group/segment ID for new subscribers.',
    category: 'newsletter',
    isSecret: false,
    envVar: 'MAILERLITE_GROUP_ID',
  },
  {
    key: 'health_alert_webhook_url',
    label: 'Health Alert Webhook URL',
    description: 'Optional Slack or generic webhook for critical health alerts.',
    category: 'monitoring',
    isSecret: true,
    envVar: 'HEALTH_ALERT_WEBHOOK_URL',
  },
] as const

export type CredentialKey = (typeof CREDENTIAL_KEY_DEFINITIONS)[number]['key']

const DEFINITION_BY_KEY = new Map(
  CREDENTIAL_KEY_DEFINITIONS.map((def) => [def.key, def] as const),
)

export function getCredentialDefinition(key: string): CredentialKeyDefinition | undefined {
  return DEFINITION_BY_KEY.get(key)
}

export function isAllowedCredentialKey(key: string): key is CredentialKey {
  return DEFINITION_BY_KEY.has(key)
}

export const CREDENTIAL_CATEGORIES: readonly CredentialCategory[] = [
  'sync',
  'email',
  'newsletter',
  'monitoring',
]

export const CATEGORY_LABELS: Record<CredentialCategory, string> = {
  sync: 'Sync & Metadata',
  email: 'Email (Resend)',
  newsletter: 'Newsletter (MailerLite)',
  monitoring: 'Monitoring',
}