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
  MusicNote,
  DiscordLogo,
  TelegramLogo,
  LinkedinLogo,
  GithubLogo,
  SoundcloudLogo,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'

export const SOCIAL_ICON_MAP: Record<string, Icon> = {
  InstagramLogo,
  YoutubeLogo,
  SpotifyLogo,
  FacebookLogo,
  TwitterLogo,
  TiktokLogo,
  BandcampLogo: MusicNote,
  DiscordLogo,
  TelegramLogo,
  LinkedinLogo,
  GithubLogo,
  SoundcloudLogo,
  Globe,
}

export const SOCIAL_ICON_OPTIONS = Object.keys(SOCIAL_ICON_MAP)
