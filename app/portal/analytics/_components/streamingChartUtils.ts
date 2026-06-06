/**
 * app/portal/analytics/_components/streamingChartUtils.ts
 *
 * Shared utilities for the streaming chart components.
 * Platform brand colours are kept as constants (external brand values);
 * the fallback for unknown platforms uses the CSS custom property so it
 * respects the active theme (AGT-9).
 */

/** Platform brand colours — external values, intentionally hardcoded as constants. */
export const PLATFORM_COLORS: Record<string, string> = {
  spotify: '#1db954',
  apple_music: '#fc3c44',
  youtube: '#ff0000',
}

export function formatPlatformLabel(platform: string): string {
  return platform
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
