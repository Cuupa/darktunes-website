/**
 * src/lib/epk/themes.ts
 *
 * Defines the EPKTheme type and built-in theme registry for the Electronic
 * Press Kit. Each theme is a set of CSS-in-JS inline style tokens that are
 * applied to EPKDocument via EPKThemeContext.
 *
 * Built-in themes:
 *   default      — the current card/gradient style (dark-card palette).
 *   blade-runner — flat black, pure white text, single-pixel borders.
 *                  Inspired by the Wallace Corporation aesthetic from
 *                  Blade Runner 2049. Zero 3-D transforms or shadows.
 */

import type { CSSProperties } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EPKTheme {
  /** Theme identifier (stored in artist_profiles.epk_theme) */
  id: string
  /** Display name (maps to an i18n key like epk_theme_<id>) */
  name: string
  /** Outer article wrapper */
  article: CSSProperties
  /** Top header band */
  header: CSSProperties
  /** Label shown above the artist name */
  headerLabel: CSSProperties
  /** Artist name h1 */
  artistName: CSSProperties
  /** Genre badge */
  badge: CSSProperties
  /** Content body padding/bg */
  body: CSSProperties
  /** Section heading (uppercase tracking) */
  sectionHeading: CSSProperties
  /** Body text */
  text: CSSProperties
  /** Muted / secondary text */
  mutedText: CSSProperties
  /** Horizontal divider */
  divider: CSSProperties
  /** Primary accent colour (icons, links) */
  accent: string
  /** Optional styling for document background image overlays */
  backgroundImageStyle?: CSSProperties
  /** Press quote blockquote border + text */
  blockquote: CSSProperties
  /** Footer band */
  footer: CSSProperties
  /** Footer text */
  footerText: CSSProperties
}

// ---------------------------------------------------------------------------
// default theme
// ---------------------------------------------------------------------------

const defaultTheme: EPKTheme = {
  id: 'default',
  name: 'Default',
  article: {
    background: 'hsl(var(--card))',
    color: 'hsl(var(--foreground))',
    borderRadius: '0.75rem',
    overflow: 'hidden',
    border: '1px solid hsl(var(--border))',
    boxShadow: '0 4px 24px 0 rgba(0,0,0,0.25)',
  },
  header: {
    background: 'linear-gradient(to right, hsl(var(--primary)/0.20), hsl(var(--primary)/0.05))',
    borderBottom: '1px solid hsl(var(--border))',
    padding: '1.5rem 2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  headerLabel: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.2em',
    color: 'hsl(var(--primary))',
    fontWeight: 600,
    marginBottom: '0.25rem',
  },
  artistName: {
    fontSize: '1.875rem',
    fontWeight: 700,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  badge: {
    background: 'hsl(var(--secondary))',
    color: 'hsl(var(--secondary-foreground))',
    borderRadius: '9999px',
    padding: '0.125rem 0.5rem',
    fontSize: '0.7rem',
    fontWeight: 400,
  },
  body: {
    padding: '1.5rem 2rem',
  },
  sectionHeading: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.2em',
    color: 'hsl(var(--muted-foreground))',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  text: { color: 'hsl(var(--foreground))' },
  mutedText: { color: 'hsl(var(--muted-foreground))' },
  divider: { background: 'hsl(var(--border))', height: '1px', margin: '0.5rem 0' },
  accent: 'hsl(var(--primary))',
  blockquote: {
    borderLeft: '4px solid hsl(var(--primary)/0.6)',
    paddingLeft: '1rem',
    fontStyle: 'italic',
    color: 'hsl(var(--foreground)/0.7)',
    fontSize: '0.875rem',
    lineHeight: 1.6,
  },
  footer: {
    borderTop: '1px solid hsl(var(--border))',
    padding: '0.75rem 2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'hsl(var(--muted)/0.3)',
  },
  footerText: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.15em',
    color: 'hsl(var(--muted-foreground))',
  },
}

// ---------------------------------------------------------------------------
// blade-runner theme
// ---------------------------------------------------------------------------

const bladeRunnerTheme: EPKTheme = {
  id: 'blade-runner',
  name: 'Blade Runner',
  article: {
    background: '#000000',
    color: '#FFFFFF',
    borderRadius: '0',
    overflow: 'hidden',
    border: '1px solid #FFFFFF',
    boxShadow: 'none',
  },
  header: {
    background: '#000000',
    borderBottom: '1px solid #FFFFFF',
    padding: '1.5rem 2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  headerLabel: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3em',
    color: '#F0F0F0',
    fontWeight: 400,
    marginBottom: '0.25rem',
  },
  artistName: {
    fontSize: '1.875rem',
    fontWeight: 700,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    letterSpacing: '0.05em',
    color: '#FFFFFF',
  },
  badge: {
    background: 'transparent',
    color: '#FFFFFF',
    borderRadius: '0',
    border: '1px solid #FFFFFF',
    padding: '0.125rem 0.5rem',
    fontSize: '0.7rem',
    fontWeight: 400,
    letterSpacing: '0.1em',
  },
  body: {
    padding: '1.5rem 2rem',
    background: '#000000',
  },
  sectionHeading: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3em',
    color: '#A0A0A0',
    fontWeight: 400,
    marginBottom: '0.5rem',
  },
  text: { color: '#FFFFFF' },
  mutedText: { color: '#A0A0A0' },
  divider: { background: '#333333', height: '1px', margin: '0.5rem 0' },
  accent: '#F0F0F0',
  blockquote: {
    borderLeft: '2px solid #FFFFFF',
    paddingLeft: '1rem',
    fontStyle: 'italic',
    color: '#C0C0C0',
    fontSize: '0.875rem',
    lineHeight: 1.6,
    letterSpacing: '0.02em',
  },
  footer: {
    borderTop: '1px solid #333333',
    padding: '0.75rem 2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#050505',
  },
  footerText: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3em',
    color: '#606060',
  },
}

const neonUndergroundTheme: EPKTheme = {
  id: 'neon-underground',
  name: 'Neon Underground',
  article: {
    background: '#060609',
    color: '#f8f8ff',
    borderRadius: '0.75rem',
    overflow: 'hidden',
    border: '1px solid #ff2bd633',
    boxShadow: '0 0 40px rgba(0, 255, 255, 0.12)',
  },
  header: {
    background: 'linear-gradient(90deg, #10020f 0%, #090b1d 100%)',
    borderBottom: '1px solid #00e5ff55',
    padding: '1.5rem 2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  headerLabel: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.24em',
    color: '#00e5ff',
    fontWeight: 700,
    marginBottom: '0.25rem',
    textShadow: '0 0 6px #00e5ff99',
  },
  artistName: {
    fontSize: '1.875rem',
    fontWeight: 700,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    color: '#ff4be1',
    textShadow: '0 0 8px #ff4be199',
  },
  badge: {
    background: '#1a0820',
    color: '#8dfaff',
    borderRadius: '9999px',
    border: '1px solid #00e5ff66',
    padding: '0.125rem 0.5rem',
    fontSize: '0.7rem',
    fontWeight: 600,
  },
  body: {
    padding: '1.5rem 2rem',
    background: '#060609',
  },
  sectionHeading: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.24em',
    color: '#00e5ff',
    fontWeight: 700,
    marginBottom: '0.5rem',
    textShadow: '0 0 6px #00e5ff66',
  },
  text: { color: '#f8f8ff' },
  mutedText: { color: '#a4a8c2' },
  divider: { background: '#1f2650', height: '1px', margin: '0.5rem 0' },
  accent: '#ff4be1',
  backgroundImageStyle: { mixBlendMode: 'screen' },
  blockquote: {
    borderLeft: '4px solid #ff4be1',
    paddingLeft: '1rem',
    fontStyle: 'italic',
    color: '#e2d9ff',
    fontSize: '0.875rem',
    lineHeight: 1.6,
  },
  footer: {
    borderTop: '1px solid #1f2650',
    padding: '0.75rem 2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#070814',
  },
  footerText: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.2em',
    color: '#8c92b5',
  },
}

const industrialGreyTheme: EPKTheme = {
  id: 'industrial-grey',
  name: 'Industrial Grey',
  article: {
    background: '#1f2328',
    color: '#ece9e5',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    border: '1px solid #3f454c',
    boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
  },
  header: {
    background: 'linear-gradient(90deg, #2b2f35 0%, #23272d 100%)',
    borderBottom: '1px solid #4a5058',
    padding: '1.5rem 2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  headerLabel: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3em',
    color: '#ff5a36',
    fontWeight: 700,
    marginBottom: '0.25rem',
  },
  artistName: {
    fontSize: '1.875rem',
    fontWeight: 800,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: '#f2f0ed',
  },
  badge: {
    background: '#2f343b',
    color: '#f9b39f',
    borderRadius: '0.25rem',
    border: '1px solid #ff5a3670',
    padding: '0.125rem 0.5rem',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  body: {
    padding: '1.5rem 2rem',
    background: '#1f2328',
  },
  sectionHeading: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3em',
    color: '#ff6b47',
    fontWeight: 700,
    marginBottom: '0.5rem',
  },
  text: { color: '#ece9e5' },
  mutedText: { color: '#b3b7bc' },
  divider: { background: '#444a52', height: '1px', margin: '0.5rem 0' },
  accent: '#ff5a36',
  backgroundImageStyle: { mixBlendMode: 'multiply' },
  blockquote: {
    borderLeft: '4px solid #ff5a36',
    paddingLeft: '1rem',
    fontStyle: 'italic',
    color: '#d7d1ca',
    fontSize: '0.875rem',
    lineHeight: 1.6,
  },
  footer: {
    borderTop: '1px solid #444a52',
    padding: '0.75rem 2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#252a31',
  },
  footerText: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.25em',
    color: '#b3b7bc',
  },
}

const midnightForestTheme: EPKTheme = {
  id: 'midnight-forest',
  name: 'Midnight Forest',
  article: {
    background: '#09110e',
    color: '#d9e4d7',
    borderRadius: '0.75rem',
    overflow: 'hidden',
    border: '1px solid #1f3b31',
    boxShadow: '0 8px 30px rgba(0,0,0,0.28)',
  },
  header: {
    background: 'linear-gradient(90deg, #0c1713 0%, #11211b 100%)',
    borderBottom: '1px solid #24473a',
    padding: '1.5rem 2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  headerLabel: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.22em',
    color: '#86cfb0',
    fontWeight: 600,
    marginBottom: '0.25rem',
  },
  artistName: {
    fontSize: '1.875rem',
    fontWeight: 700,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    color: '#e9f2e8',
  },
  badge: {
    background: '#17332a',
    color: '#bde6d4',
    borderRadius: '9999px',
    border: '1px solid #2f6a56',
    padding: '0.125rem 0.5rem',
    fontSize: '0.7rem',
    fontWeight: 500,
  },
  body: {
    padding: '1.5rem 2rem',
    background: '#09110e',
  },
  sectionHeading: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.22em',
    color: '#86cfb0',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  text: { color: '#d9e4d7' },
  mutedText: { color: '#9eb3a4' },
  divider: { background: '#214436', height: '1px', margin: '0.5rem 0' },
  accent: '#4dbb8c',
  backgroundImageStyle: { mixBlendMode: 'soft-light' },
  blockquote: {
    borderLeft: '4px solid #4dbb8c',
    paddingLeft: '1rem',
    fontStyle: 'italic',
    color: '#bdcebf',
    fontSize: '0.875rem',
    lineHeight: 1.6,
  },
  footer: {
    borderTop: '1px solid #214436',
    padding: '0.75rem 2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#0d1814',
  },
  footerText: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.2em',
    color: '#90a896',
  },
}

const crimsonCultTheme: EPKTheme = {
  id: 'crimson-cult',
  name: 'Crimson Cult',
  article: {
    background: '#0b0b0b',
    color: '#ffffff',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    border: '1px solid #8b0000',
    boxShadow: '0 6px 28px rgba(0,0,0,0.34)',
  },
  header: {
    background: 'linear-gradient(90deg, #120606 0%, #1c0909 100%)',
    borderBottom: '1px solid #8b0000',
    padding: '1.5rem 2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  headerLabel: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.26em',
    color: '#dc143c',
    fontWeight: 700,
    marginBottom: '0.25rem',
  },
  artistName: {
    fontSize: '1.875rem',
    fontWeight: 700,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    color: '#ffffff',
  },
  badge: {
    background: '#220808',
    color: '#ffd8d8',
    borderRadius: '9999px',
    border: '1px solid #8b0000',
    padding: '0.125rem 0.5rem',
    fontSize: '0.7rem',
    fontWeight: 600,
  },
  body: {
    padding: '1.5rem 2rem',
    background: '#0b0b0b',
  },
  sectionHeading: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.26em',
    color: '#dc143c',
    fontWeight: 700,
    marginBottom: '0.5rem',
  },
  text: { color: '#ffffff' },
  mutedText: { color: '#c5b6b6' },
  divider: { background: '#3f1616', height: '1px', margin: '0.5rem 0' },
  accent: '#dc143c',
  backgroundImageStyle: { mixBlendMode: 'luminosity' },
  blockquote: {
    borderLeft: '4px solid #8b0000',
    paddingLeft: '1rem',
    fontStyle: 'italic',
    color: '#f4dede',
    fontSize: '0.875rem',
    lineHeight: 1.6,
  },
  footer: {
    borderTop: '1px solid #3f1616',
    padding: '0.75rem 2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#140909',
  },
  footerText: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.2em',
    color: '#c5b6b6',
  },
}

const synthwaveTheme: EPKTheme = {
  id: 'synthwave',
  name: 'Synthwave',
  article: {
    background: '#1a0535',
    color: '#f9ecff',
    borderRadius: '0.75rem',
    overflow: 'hidden',
    border: '1px solid #ff2fa0',
    boxShadow: '0 8px 36px rgba(0,0,0,0.32)',
  },
  header: {
    background: 'linear-gradient(90deg, #2a0d52 0%, #120a3f 55%, #0a1f4f 100%)',
    borderBottom: '1px solid #38b6ff',
    padding: '1.5rem 2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  headerLabel: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.24em',
    color: '#38b6ff',
    fontWeight: 700,
    marginBottom: '0.25rem',
  },
  artistName: {
    fontSize: '1.875rem',
    fontWeight: 700,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    color: '#ff69d7',
  },
  badge: {
    background: '#2c0d56',
    color: '#9fdcff',
    borderRadius: '9999px',
    border: '1px solid #38b6ff55',
    padding: '0.125rem 0.5rem',
    fontSize: '0.7rem',
    fontWeight: 600,
  },
  body: {
    padding: '1.5rem 2rem',
    background: '#1a0535',
  },
  sectionHeading: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.24em',
    color: '#38b6ff',
    fontWeight: 700,
    marginBottom: '0.5rem',
  },
  text: { color: '#f9ecff' },
  mutedText: { color: '#c2b3d8' },
  divider: { background: '#49266f', height: '1px', margin: '0.5rem 0' },
  accent: '#ff2fa0',
  backgroundImageStyle: { mixBlendMode: 'screen' },
  blockquote: {
    borderLeft: '4px solid #ff2fa0',
    paddingLeft: '1rem',
    fontStyle: 'italic',
    color: '#efd7ff',
    fontSize: '0.875rem',
    lineHeight: 1.6,
  },
  footer: {
    borderTop: '1px solid #49266f',
    padding: '0.75rem 2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#13042a',
  },
  footerText: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.2em',
    color: '#c2b3d8',
  },
}

const printCleanTheme: EPKTheme = {
  id: 'print-clean',
  name: 'Print / Clean',
  article: {
    background: '#ffffff',
    color: '#111111',
    borderRadius: '0',
    overflow: 'hidden',
    border: '1px solid #d0d0d0',
    boxShadow: 'none',
  },
  header: {
    background: '#ffffff',
    borderBottom: '1px solid #d0d0d0',
    padding: '1.5rem 2rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  },
  headerLabel: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.22em',
    color: '#111111',
    fontWeight: 700,
    marginBottom: '0.25rem',
  },
  artistName: {
    fontSize: '1.875rem',
    fontWeight: 700,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    color: '#111111',
  },
  badge: {
    background: '#f2f2f2',
    color: '#111111',
    borderRadius: '9999px',
    border: '1px solid #c8c8c8',
    padding: '0.125rem 0.5rem',
    fontSize: '0.7rem',
    fontWeight: 600,
  },
  body: {
    padding: '1.5rem 2rem',
    background: '#ffffff',
  },
  sectionHeading: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.22em',
    color: '#111111',
    fontWeight: 700,
    marginBottom: '0.5rem',
  },
  text: { color: '#111111' },
  mutedText: { color: '#555555' },
  divider: { background: '#d0d0d0', height: '1px', margin: '0.5rem 0' },
  accent: '#111111',
  backgroundImageStyle: { mixBlendMode: 'multiply' },
  blockquote: {
    borderLeft: '4px solid #111111',
    paddingLeft: '1rem',
    fontStyle: 'italic',
    color: '#333333',
    fontSize: '0.875rem',
    lineHeight: 1.6,
  },
  footer: {
    borderTop: '1px solid #d0d0d0',
    padding: '0.75rem 2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#f7f7f7',
  },
  footerText: {
    fontSize: '0.65rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.18em',
    color: '#555555',
  },
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const EPK_THEMES: Record<string, EPKTheme> = {
  default: defaultTheme,
  'blade-runner': bladeRunnerTheme,
  'neon-underground': neonUndergroundTheme,
  'industrial-grey': industrialGreyTheme,
  'midnight-forest': midnightForestTheme,
  'crimson-cult': crimsonCultTheme,
  synthwave: synthwaveTheme,
  'print-clean': printCleanTheme,
}

export const DEFAULT_THEME_ID = 'default'

export function getEPKTheme(id: string | undefined): EPKTheme {
  return EPK_THEMES[id ?? DEFAULT_THEME_ID] ?? EPK_THEMES[DEFAULT_THEME_ID]
}

/** Build a theme from user-supplied custom color tokens, falling back to the default theme. */
export function buildCustomTheme(tokens: Record<string, string>): EPKTheme {
  const base = defaultTheme
  const bg = tokens.bg ?? 'hsl(var(--card))'
  const text = tokens.text ?? 'hsl(var(--foreground))'
  const accent = tokens.accent ?? 'hsl(var(--primary))'
  const heading = tokens.heading ?? 'hsl(var(--muted-foreground))'

  return {
    ...base,
    id: 'custom',
    name: 'Custom',
    article: { ...base.article, background: bg, color: text },
    header: { ...base.header, background: bg },
    headerLabel: { ...base.headerLabel, color: accent },
    artistName: { ...base.artistName },
    body: { ...base.body, background: bg },
    sectionHeading: { ...base.sectionHeading, color: heading },
    text: { color: text },
    mutedText: { color: text + '99' },
    accent,
    blockquote: { ...base.blockquote, borderLeft: `4px solid ${accent}99`, color: text + 'b3' },
    footer: { ...base.footer, background: bg },
  }
}

// ---------------------------------------------------------------------------
// Section ordering constants
// ---------------------------------------------------------------------------

export type EPKSectionId = 'header' | 'quote' | 'bio' | 'info' | 'contacts' | 'riders' | 'links' | 'gallery'

export const DEFAULT_SECTIONS_ORDER: EPKSectionId[] = [
  'header',
  'quote',
  'bio',
  'gallery',
  'info',
  'contacts',
  'riders',
  'links',
]
