# Frontend, UI & Accessibility

## Technology Stack & Styling

Technology Stack & Styling
Core Infrastructure: Next.js 15 (App Router), React 19, Supabase (PostgreSQL & Auth), Cloudflare R2, Vercel deployment. The project was migrated from Vite SPA to Next.js 15 App Router in 2025.
UI & Design: Exclusively use Tailwind CSS v4 (PostCSS) and ensure the CSS output is minified.
Motion & UX: Implement fluid page transitions and shared layout animations with Framer Motion, and utilize Lenis for smooth scrolling. Use Phosphor Icons for all vector graphics.

## CI Color System

CI Color System (darkTunes Brand)
The following exact hex values MUST be used. They are mapped to CSS custom properties in src/index.css and must not be replaced with approximations:
  --primary / --accent / --ring: #493687  (violet – primary CTAs, active nav, focus rings)
  --secondary:                   #7e1e37  (pink – secondary buttons, hover effects, promo badges)
  --background:                  #101010  (near-black – global page background, immersive dark mode)
  --card / --muted / --popover:  #292929  (surface – cards, modals, dropdowns, player bar)
  --border / --input:            #383838  (subtle borders, input frames, disabled states)
  --foreground / text:           #ffffff  (primary text – maximum contrast on dark surfaces)

## Smooth Scrolling (Lenis)

Smooth Scrolling (Lenis)
The LenisProvider (src/components/animations/LenisProvider.tsx) is the single global smooth-scroll implementation.
It is mounted once at the root level in app/_components/Providers.tsx and wraps the entire React tree.
Do NOT add a second LenisProvider instance anywhere else in the tree.
Do NOT use CSS scroll-behavior: smooth as a replacement – Lenis overrides this at the JS layer.
LenisProvider uses ReactLenis from lenis/react (root mode) so any component can call useLenis() to get the Lenis instance for programmatic scrolling.
useLenis is re-exported from src/components/animations/LenisProvider.tsx. Import from there (not directly from lenis/react) for consistency.
For anchor-based scrolling in Header/Footer, use: const lenis = useLenis(); lenis?.scrollTo(href, { offset: -140 })
CRITICAL — overflow containers inside the admin/portal/press layouts: Lenis runs in root mode and intercepts ALL wheel/touch events at the document level. Any element that uses overflow-y-auto or overflow-auto INSIDE a layout that sets overflow-hidden on the root container (like AdminClientLayout) MUST carry the `data-lenis-prevent` HTML attribute. Without it Lenis grabs the event, tries to scroll the (non-scrollable) window, and mouse-wheel scrolling is silently blocked. This attribute is already set on the main content div (app/admin/_components/AdminClientLayout.tsx) and the sidebar nav (src/components/admin/AdminSidebarNav.tsx). Apply the same attribute to any future overflow-y-auto containers added to admin/portal/press layouts.

## WCAG Accessibility

WCAG 2.1 AA/AAA Accessibility — MANDATORY
COMPLIANCE IS NON-NEGOTIABLE: Every public-facing page and component MUST comply with WCAG 2.1 AA as a hard requirement. Strive for AAA where feasible. Any new UI element introduced without meeting at minimum AA criteria is considered a defect and must be fixed before merging. Violations found in existing code must be remediated immediately.
Skip Navigation: app/layout.tsx includes a sr-only skip link (<a href="#main-content">) as the first focusable element. The <main> element in HomePageContent.tsx carries id="main-content".
Semantic HTML: Content grids (Artists, News, Videos, Releases) use <ul>/<li> with list-none to allow grid styling while preserving list semantics for screen readers. Use <section> with aria-labelledby for major page sections.
Reduced Motion (WCAG 2.3.3 – AAA): Import useReducedMotion from framer-motion in every animated component. When prefersReducedMotion is true, set duration: 0 and skip initial offset transforms.
ARIA on dialogs: All Dialog components must set aria-labelledby pointing to the modal title's id. Close buttons must have a descriptive aria-label (e.g. "Close ${artist.name}"). Icons inside interactive elements must carry aria-hidden="true".
Icon-only links: Any link that renders only an icon MUST have a descriptive aria-label (e.g. aria-label="`${artist.name} on Spotify`").
Touch Targets (WCAG 2.5.5 – AAA): Icon-only interactive elements must include min-w-[44px] min-h-[44px] on the anchor/button element.
Navigation ARIA: Desktop <nav> must have aria-label="Main navigation". Mobile toggle button must have aria-expanded and aria-controls="mobile-menu". Mobile <nav> must have id="mobile-menu" and aria-label="Mobile navigation".
Alt text: Images must have descriptive alt text, e.g. "${artist.name} – artist photo", "${release.title} by ${artistName} – cover art", "${video.title} – video thumbnail".
Decorative elements (e.g. animated scroll-down indicator) must carry aria-hidden="true".
Focus Visible (WCAG 2.4.7 – AA): Every interactive element (buttons, links, inputs) MUST display a visible focus indicator. Use focus-visible:outline or focus-visible:ring-2 ring-accent Tailwind utilities. Never use focus:outline-none without providing an equivalent focus-visible style.
Toggle/Filter Buttons (WCAG 4.1.2 – AA): Stateful buttons that toggle or filter content MUST use aria-pressed="true|false" so screen readers can announce the pressed state. Do NOT use role="tab"/aria-selected for standalone toggle buttons that are not part of a tab panel widget.
Color Contrast (WCAG 1.4.3 – AA): Foreground/background pairs must meet 4.5:1 for normal text and 3:1 for large text (≥18pt regular or ≥14pt bold). The project's `text-muted-foreground` (#a0a0a0 on #101010) provides ~7:1 and is AA-compliant. Do not reduce contrast below these thresholds.
Language (WCAG 3.1.1 – A): The `<html>` element must always carry a `lang` attribute. The current value is resolved dynamically from the locale (app/layout.tsx). Never remove or hard-code it to an empty string.
External Links (WCAG 2.4.4 – AA): External links that open in a new tab must carry rel="noopener noreferrer". If the link text alone is not descriptive, add an aria-label.

## Image Optimisation & next/image

Image Optimisation
All public-facing images MUST be served via `getOptimizedImageUrl(url, width)` or `getSquareThumbnail(url, size)` from `src/lib/imageUtils.ts`.
These functions proxy through wsrv.nl and output WebP format, preventing origin load.
Use `getOptimizedImageUrl` for rectangular/banner images and `getSquareThumbnail` for cover art / profile photos.

Next.js `<Image>` Component – ALWAYS use `<Image />` from `next/image` instead of bare `<img>` tags. Raw `<img>` causes the `@next/next/no-img-element` lint error and degrades LCP.
- Images already proxied through wsrv.nl: add `unoptimized` so Next.js does not double-process them.
- Images in position:relative containers: use `fill` prop (e.g. carousels, hero, thumbnails).
- Logos and images with known natural dimensions: use `width` / `height` props + `style={{ width: 'auto' }}` CSS override to preserve aspect ratio.
- Unknown dimensions at render time (e.g. markdown content): use `width={0} height={0} sizes="100vw" className="max-w-full h-auto" unoptimized`.
- Priority images above the fold: add `priority` prop (equivalent to `fetchPriority="high" loading="eager"`).
- Naming conflict with icon libraries (e.g. `@phosphor-icons/react` exports `Image`): import the icon as `ImageIcon` to avoid a clash with `import Image from 'next/image'`.

## Internationalisation

Internationalisation (i18n)
The site supports English (`en`) and German (`de`). German is the default locale.
Dictionary files live in `src/i18n/dictionaries/en.json` and `src/i18n/dictionaries/de.json`.
The shared type `Dictionary` in `src/i18n/types.ts` is structurally derived from the English baseline — add new keys there first.
Locale resolution order: 1) `NEXT_LOCALE` cookie, 2) `Accept-Language` request header, 3) `de` default.
Server-side loading: call `getLocale()` then `getDictionary(locale)` from `src/i18n/getDictionary.ts` inside Server Components. Never call these from Client Components.
Prop injection (IoC): RSC parents fetch the dictionary and pass relevant sub-objects (e.g. `dict.navigation`, `dict.consent`) to Client Components as props. Client Components MUST NOT import or call dictionary functions themselves.
Locale switching: the Header writes `document.cookie = 'NEXT_LOCALE=...'` on the client and calls `router.refresh()` to trigger a server re-render with the new locale.
When adding new user-facing strings: add the English key to `en.json`, add the German translation to `de.json`, update the `getDictionary` return type (auto-inferred), then thread the new key through the RSC → Client Component prop chain.

## Responsive Design

Responsive Design & Layout Integrity
MANDATORY: All UI components MUST follow the rules below.

Mobile-First Only: Always build the mobile layout first using base Tailwind classes (without prefixes). Only scale up using sm:, md:, and lg: breakpoints. Never use desktop-first hacks like max-md:.

Fluidity over Fixed Dimensions: Never use hardcoded pixel dimensions (e.g., w-[500px], h-[300px]) for structural containers. Always use fluid utility classes (w-full, max-w-7xl, min-h-screen) or aspect ratios (aspect-video, aspect-square).

Bento/Grid Strategies: For high-density information (like the Artist Dashboard or Release Radar), use CSS Grid. Implement grid-auto-flow: dense to prevent "swiss cheese" empty gaps when grid items wrap on different screen sizes.

Zero Cumulative Layout Shift (CLS): Loading states (using shadcn/ui Skeletons) MUST use the exact same grid and flex structures as the fully loaded content.

Defensive Overflow: Prevent horizontal scrolling on mobile at all costs. Handle long texts or overflowing images gracefully using truncate, overflow-hidden, or break-words.

## Modal & Dialog Standards

Modal & Dialog Quality Standards — MANDATORY
Seven enforceable principles for consistent modal/layout quality. All new and updated modals/dialogs MUST comply.

**1. Responsive Modal Sizes (Viewport-relative)**
ALL modals/dialogs MUST use viewport-relative sizing with responsive breakpoints. Hard-coding a single `max-w-*` class without breakpoints is forbidden.
- ✅ Correct: `className="max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-xl lg:max-w-2xl"`
- ❌ Forbidden: `className="max-w-lg"` (fixed size without responsive context)

Default breakpoints for new modals:
- Mobile (<640px): `max-w-[calc(100%-2rem)]` (1 rem side margin)
- sm (≥640px): `sm:max-w-lg` (32 rem / 512 px)
- md (≥768px): `md:max-w-xl` (36 rem / 576 px)
- lg (≥1024px): `lg:max-w-2xl` (42 rem / 672 px)

Documented exceptions (must be noted in a code comment):
- Video/gallery modals: `sm:max-w-[95vw]` (maximum width for 16:9 content)
- Forms with many fields: `lg:max-w-4xl`
- Confirmation dialogs (text only): `sm:max-w-sm`

**2. Vertical Height Limiting (max-h + Scroll)**
EVERY modal body MUST enforce a maximum height with internal scrolling so long content never overflows the viewport.
- ✅ Required pattern: `<div className="overflow-y-auto max-h-[70vh] p-6">{children}</div>`
- `max-h-[70vh]` leaves 30 % of viewport for header / footer / close button.
- `overflow-y-auto` enables vertical scrolling on overflow.
- `p-6` prevents content from touching the edge.

`max-h` values by modal type:
- Standard forms: `max-h-[70vh]`
- Video / media modals: `max-h-[92vh]` (maximise space for 16:9)
- Confirmation dialogs: `max-h-[50vh]`

**3. Spacing System (8 px Grid)**
USE ONLY multiples of `0.5rem` (8 px) from the standard Tailwind spacing scale for all padding and margin inside modals and dialogs.

Allowed values:
- Tight:     `p-2` (8 px), `p-3` (12 px), `p-4` (16 px)
- Standard:  `p-6` (24 px) — default for modal bodies
- Generous:  `p-8` (32 px), `p-12` (48 px)

Forbidden:
- Off-grid values: `p-5`, `p-7`, `p-9`
- Pixel literals: `style={{ padding: '13px' }}`

```tsx
// ✅ Consistent
<DialogContent className="p-0">
  <div className="p-6">{/* header */}</div>
  <div className="overflow-y-auto max-h-[70vh] p-6">{/* body */}</div>
  <div className="p-4 border-t border-border">{/* footer */}</div>
</DialogContent>
```

**4. Z-Index Stacking**
Modals/dialogs are managed by Radix UI's `Dialog` primitive and live at Tailwind `z-50` by default. Do NOT manually override the z-index of a `DialogContent` or `DialogOverlay` unless there is a documented conflict (e.g., a custom full-screen overlay component that is not a Radix Dialog). The VisualEffectsOverlay layers occupy `z-[9996]`–`z-[9998]` and must always sit above modals; never raise a modal's z-index above `z-[9900]`.

When building a fully custom modal (like `TacticalModal`) that does not use Radix `Dialog`, use `z-50` for both the backdrop and the panel container and document the reason.

**5. Backdrop Pattern**
Every modal MUST render a visible semi-transparent backdrop so the rest of the page is visually dimmed.
- ✅ Standard: `bg-black/80` with `transition={{ duration: 0.12, ease: 'linear' }}` (skip transition when `prefersReducedMotion`)
- Use `pointer-events-auto` on the backdrop and attach `onClick={onClose}` to it so clicking outside the panel dismisses the modal.
- The `Dialog` primitive from `@/components/ui/dialog` (Radix) handles the backdrop automatically — do NOT add a second backdrop overlay on top of it.

**6. Enter/Exit Animation**
Use a consistent spring animation for panel entrance. The preferred preset ("blade snap") matches `TacticalModal` and `VideoModal`:
```ts
const MODAL_SPRING = { type: 'spring', stiffness: 400, damping: 40 } as const
```
- Entrance: opacity 0 → 1 + scale 0.96 → 1 (or `clipPath` blade-slice for panel-style dialogs).
- When `prefersReducedMotion` is `true`: set `duration: 0` on all transitions — skip all transforms.
- Import `useReducedMotion` from `framer-motion` in every animated modal.
- Do NOT use `animate-bounce` or `animate-pulse` on modal panels — reserved for loading indicators.

**7. Close / Dismiss Behaviour**
Every modal MUST support all three standard dismiss paths without exception:
1. **Close button**: visible `×` button in the top-right corner, `min-w-[44px] min-h-[44px]`, `aria-label="Close [context]"`.
2. **ESC key**: handled automatically by Radix `Dialog`; for custom modals add a `keydown` listener on `document` that calls `onClose()` when `event.key === 'Escape'`.
3. **Backdrop click**: `onClick={onClose}` on the backdrop element (Radix handles this via `onOpenChange`).

Use `onOpenChange={(isOpen) => { if (!isOpen) onClose() }}` on `<Dialog>` so all dismiss paths funnel through a single `onClose` callback — never handle each path separately.

## Visual Effects

Visual Effects (Industrial Aesthetic)
The public site renders three non-interactive overlay layers — animated noise/grain, CRT scanlines, and a vignette — controlled by CMS settings.
The VisualEffectsOverlay component (src/components/VisualEffectsOverlay.tsx) is a dumb Client Component mounted in app/layout.tsx. It receives noiseOpacity, crtScanlinesEnabled, and vignetteIntensity as props from the Server Component parent (IoC).
All overlays use pointer-events: none and z-index 9996–9998 so they never block user interactions.
Settings are stored in the site_settings KV table (keys: noise_opacity, crt_scanlines_enabled, vignette_intensity, shopify_store_url, youtube_channel_id) and managed via the Admin CMS "Visual Effects" tab (Slider + Switch controls).
CSS animation keyframes (.noise-overlay, .scanlines-overlay) live in app/globals.css. Opacity/visibility is controlled via inline style props — never hardcoded.
CRITICAL DESIGN RULE: Do NOT use neon glows, bright highlights, or flashy cyberpunk effects. Keep the aesthetic raw, dark, industrial, and subtle.
ADMIN/PORTAL/PRESS ROUTES — NO VISUAL EFFECTS: VisualEffectsOverlay and ThemeEffectsClient are both wrapped in NavHidingWrapper in app/layout.tsx. They are NOT rendered on /admin/*, /portal/*, /press/*, or /editor/* routes. Do NOT move these components outside the NavHidingWrapper. ThemeEffectsClient also removes all data-fx-* attributes from <html> in its useEffect cleanup (on unmount), so navigating from a public page to admin never leaves stale effect attributes behind.

## Color Theme Admin

Color Theme Admin (ColorThemeManager)
`src/components/admin/ColorThemeManager.tsx` is the admin editor for the CI Color System. Key architectural rules:
- All mutable editor state lives in a SINGLE `useReducer` (`ThemeDraft` + `ThemeAction` union). Do NOT add individual `useState` hooks per field — use `dispatch({ type: ... })` instead.
- Live preview is DECLARATIVE: `buildPreviewCss(draft)` produces a `:root { … }` CSS string which is rendered as `<style data-id="ctm-live-preview" dangerouslySetInnerHTML={{ ... }} />` in JSX. React mounts/unmounts it automatically. Do NOT reintroduce `document.documentElement.style.setProperty` / `removeProperty` calls — they cause hydration mismatches.
- `ThemeStyleInjector` (app/_components/ThemeStyleInjector.tsx) handles the SSR side: it injects the SAVED theme as a `<style>` tag in `<head>` at server-render time to prevent FOUC. ColorThemeManager handles the live preview only.
- `handleCancel` restores the original draft in one `dispatch({ type: 'SET_DRAFT', draft: originalDraft.current })` call — no imperative cleanup needed.
- `handleSave` diffs the draft against `value` props and calls `onChange` with only the changed fields.
- After a successful save, `handleSave` posts `{ type: 'theme-updated' }` to `BroadcastChannel('theme-updates')` so any open public-site tabs pick up the new theme within ~1 second.
- ColorThemeManager NO LONGER owns a Google Font loading useEffect — that responsibility was moved to `TypographyTab` so the font tab is self-contained and standalone-safe.

Typography System (state-of-the-art)
`ThemeTypography` (src/config/themeConfig.ts) exposes the following CSS tokens, all admin-configurable:
  - `fontFamily`           → `--font-family-body`
  - `headingFamily`        → `--font-family-heading`
  - `serifFamily`          → `--font-serif` (dedicated serif/accent override; if unset, inherits body font)
  - `headingSize`          → `--heading-size` (h1 base size in rem)
  - `headingScale`         → `--heading-scale` (ratio; h2 = h1×scale, h3 = h1×scale²)
  - `bodySize`             → `--body-size`
  - `bodyWeight`           → `--body-weight`
  - `headingWeight`        → `--heading-weight`
  - `lineHeight`           → `--line-height-body`
  - `lineHeightHeading`    → `--line-height-heading`
  - `letterSpacing`        → `--letter-spacing-body`
  - `letterSpacingHeading` → `--letter-spacing-heading`

`--font-serif` wiring (critical): The Tailwind `font-serif` utility maps to `font-family: var(--font-serif)`. There are 27+ usages in Hero, Artist bios, MarkdownContent, etc. ThemeStyleInjector emits `--font-serif` as follows:
  - `serifFamily` set → `--font-serif: 'serifFamily', serif` (dedicated accent typeface)
  - `serifFamily` empty + `fontFamily` set → `--font-serif: var(--font-family-body)` (all serif elements follow body font)
  - Both empty → token not emitted (falls back to globals.css default: `var(--font-family-body, Georgia, serif)`)
  ⛔ Do NOT restore `--font-serif` as an inline style on `<html>` in layout.tsx — inline styles override ThemeStyleInjector's `<style>` tag.

`buildGoogleFontSpec(fontName, weights)` (exported from ThemeStyleInjector.tsx):
  - Converts a font name + weight array into a Google Fonts CSS2 API family spec fragment
  - Strips CSS fallback stacks (splits on `,`), strips surrounding quotes
  - Returns `null` for empty strings and http/https URLs
  - Auto-constructs URL for unknown names (`spaces → +`) — any valid Google Font works without a map entry
  - Always includes 400 as safety weight; deduplicates and sorts weights numerically
  - Used by both ThemeStyleInjector (SSR) and TypographyTab (client-side preview font loading)

Font loading strategy:
  - ThemeStyleInjector (SSR): emits `<link rel="stylesheet">` + `<link rel="preconnect">` for configured fonts; weight-subsets to only bodyWeight + headingWeight (reduces CSS payload ~60% vs. loading 300;400;500;600;700).
  - Adds `<link rel="preload" as="style">` for the primary body font weight to improve FCP.
  - TypographyTab (client): owns a self-contained `useEffect` that calls `loadGoogleFonts()` whenever body/heading/serif font selection changes. Works standalone in any context (Storybook, testbed, future refactors) without depending on a parent's useEffect.

Real-time cross-tab theme sync:
  - `src/components/ThemeBroadcastListener.tsx` is a `"use client"` component (returns null) mounted in `app/_components/Providers.tsx`.
  - It opens `BroadcastChannel('theme-updates')` and calls `router.refresh()` when it receives `{ type: 'theme-updated' }`.
  - The admin tab that triggered the save does NOT receive its own broadcast (BroadcastChannel sender exclusion is spec behaviour).
  - Gracefully skips when BroadcastChannel is unsupported (private Safari, some Webviews).
  - NEVER add a second ThemeBroadcastListener instance.

## Hero Section

Hero Section (src/components/Hero.tsx + app/_components/HomePageContent.tsx)
The Hero component accepts a single `heroItem?: Release | NewsPost` prop (union type). Use the exported `isRelease(item)` type guard to distinguish between the two.
`HomePageContent` builds a unified `heroItems: (Release | NewsPost)[]` array combining all featured releases plus the latest news post. The carousel index (`heroIndex`) cycles through ALL items every 6 seconds with dot-indicators shown when `heroItems.length > 1`.
The "Explore" scroll button scrolls to `#releases` for release items and `#news` for news items — the `#artists` anchor does NOT exist on the home page.
The hero background gradient uses `rgba(var(--background-rgb), 0.55)` → `0.85` (bottom) to keep titles legible without fully obscuring the background image.

## Gallery Performance (ReleasesCoverflow)

## Gallery Performance (ReleasesCoverflow — Swiper Virtual)

`ReleasesCoverflow` uses **Swiper.js** (`swiper` npm package) with the `EffectCoverflow`,
`Keyboard`, and `Autoplay` modules. (`Virtual` is NOT used.)

Cover-art images are served through `getSquareThumbnail(url, 600)` (wsrv.nl proxy) and
rendered via Next.js `<Image>` **without** `unoptimized` so Next.js applies WebP
compression, keeping memory footprint low on iOS Safari.

Drag detection is handled entirely via Swiper's native touch events:
- `onTouchStart` — resets `isDragging` ref to `false`
- `onTouchMove` — sets `isDragging` to `true` (movement detected)
- `handleOverlayClick` — prevents navigation and resets `isDragging` when a click fires
  during/after a drag

No React-level `onPointerDown`/`onPointerMove` tracking exists on the container div —
those were removed to eliminate conflicts with Swiper's internal touch engine.

`coverflowEffect` is a `useMemo` computed at mount time: on viewports < 768 px the 3D
depth/modifier/scale values are lighter (`depth: 80`, `modifier: 1.8`) to reduce GPU
pressure on memory-constrained iOS devices.

`slidesPerView` breakpoints: `0 → 1.2`, `640 → 1.8`, `1024 → 2.5`, `1280 → 3.2` —
intentionally conservative on small screens to limit simultaneous images in memory.

iOS diagnostic logging (prefixed `[ReleasesCoverflow]`) is emitted to the console on
mount and on touch/slide events. An additional `useEffect` listens for the `pagehide`
event on iOS devices and stops autoplay as a memory-pressure recovery measure.

`embla-carousel-react` is retained as a dependency because `src/components/ui/carousel.tsx`
(shadcn primitive) depends on it.

## Tailwind Configuration — Source of Truth

The project uses Tailwind CSS v4 (PostCSS). CSS custom properties in
`app/globals.css` (via `@theme {}` block) are the ONLY source of truth for
design tokens.

`tailwind.config.js` exists ONLY for IDE IntelliSense. Do NOT add new color
tokens, spacing, or breakpoints there — they will NOT be picked up at runtime
with Tailwind v4's PostCSS pipeline.

Rule: Any new design token → add ONLY to `app/globals.css` inside `@theme {}`.
Never approximate: use the exact hex values defined in the CI Color System section.

## Class Name Composition

ALWAYS use `cn()` from `@/lib/utils` for conditional or merged class names.
Never use plain string template literals for Tailwind classes.
Never import `clsx` or `tailwind-merge` directly.

```tsx
// ✅
import { cn } from '@/lib/utils'
<div className={cn('base-classes', isActive && 'active-class', className)} />

// ❌ Wrong — bypasses tailwind-merge deduplication
<div className={`base-classes ${isActive ? 'active-class' : ''}`} />
```

