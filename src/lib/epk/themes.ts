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

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const EPK_THEMES: Record<string, EPKTheme> = {
  default: defaultTheme,
  'blade-runner': bladeRunnerTheme,
}

export const DEFAULT_THEME_ID = 'default'

export function getEPKTheme(id: string | undefined): EPKTheme {
  return EPK_THEMES[id ?? DEFAULT_THEME_ID] ?? EPK_THEMES[DEFAULT_THEME_ID]
}

// ---------------------------------------------------------------------------
// Section ordering constants
// ---------------------------------------------------------------------------

export type EPKSectionId = 'header' | 'quote' | 'bio' | 'info' | 'contacts' | 'riders' | 'links'

export const DEFAULT_SECTIONS_ORDER: EPKSectionId[] = [
  'header',
  'quote',
  'bio',
  'info',
  'contacts',
  'riders',
  'links',
]
