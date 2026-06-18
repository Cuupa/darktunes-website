/**
 * src/config/socialIcons.ts
 *
 * Shared map of social-link icon names → Phosphor icon components.
 * Kept in a standalone config module so that lightweight consumers such as
 * Footer.tsx do not pull in the heavy SiteSettingsManager admin component
 * (which depends on react-hook-form, zod, TiptapEditor, etc.) into the
 * public-facing client bundle.
 */

import {
  Globe,
  InstagramLogo,
  YoutubeLogo,
  SpotifyLogo,
  FacebookLogo,
  TwitterLogo,
  TiktokLogo,
  DiscordLogo,
  TelegramLogo,
  LinkedinLogo,
  GithubLogo,
  SoundcloudLogo,
} from '@phosphor-icons/react'
import type { ElementType } from 'react'
import { BandcampIcon } from '@/components/icons/BandcampIcon'

export const SOCIAL_ICON_MAP: Record<string, ElementType> = {
  InstagramLogo,
  YoutubeLogo,
  SpotifyLogo,
  FacebookLogo,
  TwitterLogo,
  TiktokLogo,
  BandcampLogo: BandcampIcon,
  DiscordLogo,
  TelegramLogo,
  LinkedinLogo,
  GithubLogo,
  SoundcloudLogo,
  Globe,
}

export const SOCIAL_ICON_LABELS: Record<string, string> = {
  InstagramLogo: 'Instagram',
  YoutubeLogo: 'YouTube',
  SpotifyLogo: 'Spotify',
  FacebookLogo: 'Facebook',
  TwitterLogo: 'X / Twitter',
  TiktokLogo: 'TikTok',
  BandcampLogo: 'Bandcamp',
  DiscordLogo: 'Discord',
  TelegramLogo: 'Telegram',
  LinkedinLogo: 'LinkedIn',
  GithubLogo: 'GitHub',
  SoundcloudLogo: 'SoundCloud',
  Globe: 'Website',
}

export const SOCIAL_ICON_OPTIONS = Object.keys(SOCIAL_ICON_MAP)
