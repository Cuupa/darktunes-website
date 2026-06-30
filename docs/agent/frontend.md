# Frontend, UI & Accessibility

Stack: Next.js 15 App Router, React 19, Tailwind v4 (PostCSS), Framer Motion, Lenis, Phosphor Icons.

## CI colors (exact hex)

| Token | Hex | Use |
|-------|-----|-----|
| primary / accent / ring | `#493687` | CTAs, active nav, focus |
| secondary | `#7e1e37` | Secondary buttons, promo |
| background | `#101010` | Page background |
| card / muted / popover | `#292929` | Surfaces |
| border / input | `#383838` | Borders, inputs |
| foreground | `#ffffff` | Primary text |

Defined in `app/globals.css` `@theme {}`. `tailwind.config.js` is IDE-only — runtime tokens live in CSS only.

## Lenis smooth scroll

Single `LenisProvider` in `Providers.tsx`. No second instance; no CSS `scroll-behavior: smooth`. Import `useLenis` from `LenisProvider.tsx`.

**Dashboard scroll shell:** Admin and portal layouts use `ScrollableAppShell` (`src/components/layout/ScrollableAppShell.tsx`). Contract: outer `h-dvh overflow-hidden` → inner `flex-1 min-h-0 overflow-y-auto` with `data-lenis-prevent`. Do **not** put `overflow-y-auto` on a flex child whose parent is only `min-h-screen` — the pane never constrains height and Lenis blocks wheel events. Nested tables/panels may add their own `overflow-x-auto` + `data-lenis-prevent`.

## WCAG 2.1 AA (mandatory)

- Skip link → `#main-content` in `app/layout.tsx`
- Semantic lists: `<ul>/<li>` for grids; `<section aria-labelledby>`
- `useReducedMotion` in animated components
- Dialogs: `aria-labelledby`; icon-only controls: `aria-label` + `aria-hidden` on icons
- Touch targets: `min-w-[44px] min-h-[44px]` on icon-only controls
- Focus: `focus-visible:ring-2` — never bare `focus:outline-none`
- Toggle buttons: `aria-pressed`; external links: `rel="noopener noreferrer"`
- Contrast: 4.5:1 normal text; `text-muted-foreground` is AA-safe

## Images

Public images via `getOptimizedImageUrl` / `getSquareThumbnail` (`imageUtils.ts`). Use `next/image`; wsrv.nl URLs get `unoptimized`. Icon name clash: import Phosphor `Image` as `ImageIcon`.

## i18n

`en.json` / `de.json`; type from English baseline. RSC loads dict → props to clients. Locale: cookie → Accept-Language → `de`. New strings: both JSON files + prop chain.

## Responsive layout

Mobile-first; fluid widths (`w-full`, `max-w-*`); no hardcoded structural pixels. Skeletons match loaded layout (zero CLS). `truncate` / `break-words` for overflow.

## Modals (mandatory)

| Rule | Pattern |
|------|---------|
| Width | `max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-xl lg:max-w-2xl` |
| Height | Body `overflow-y-auto max-h-[70vh]` (forms); `max-h-[92vh]` (media) |
| Spacing | 8px grid: `p-2`–`p-12`; default body `p-6` |
| z-index | Radix default `z-50`; never above `z-[9900]` (effects at 9996+) |
| Dismiss | Close button (44px), ESC, backdrop click via `onOpenChange` |
| Motion | Spring `{ stiffness: 400, damping: 40 }`; duration 0 when reduced motion |

## Visual effects

`VisualEffectsOverlay` in `NavHidingWrapper` — public routes only. Props from CMS `site_settings`. Raw, dark, industrial — no neon. `ThemeEffectsClient` cleans `data-fx-*` on unmount.

## Color theme admin

`ColorThemeManager`: single `useReducer` draft; live preview via `<style data-id="ctm-live-preview">` — no `documentElement.style` mutations. `ThemeStyleInjector` for SSR saved theme. `BroadcastChannel('theme-updates')` for cross-tab refresh; single `ThemeBroadcastListener`.

Typography tokens in `themeConfig.ts`; `--font-serif` wired in `ThemeStyleInjector` (never inline on `<html>`).

## Hero & gallery

`Hero.tsx`: `heroItem?: Release | NewsPost`; carousel every 6s; Explore → `#releases` or `#news`. `ReleasesCoverflow`: Swiper coverflow; wsrv thumbnails; no Virtual module; iOS `pagehide` stops autoplay.

## Class names

Always `cn()` from `@/lib/utils` — never template literal class merging.