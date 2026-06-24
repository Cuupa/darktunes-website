# Architecture & Code Conventions

## Core principles

- No god-object files — split UI, hooks, and DAL into focused modules
- Strict TypeScript — no `any` in production code or test mocks
- `React.lazy()` + `Suspense` for heavy UI (3D, admin panels, galleries)
- Reuse hooks/utilities; prop-drill at most two levels
- Prefer native HTML/JS over heavy NPM packages when practical
- No speculative features (YAGNI)

## Artist Navigation

Artist Navigation — Architecture Rule
ALL components that display an artist card, tile, or list item MUST navigate to `/artists/[slug]` using Next.js `<Link href={`/artists/${artist.slug}`}>`. Opening a modal instead of navigating to the artist detail page is FORBIDDEN for artist roster components. The dedicated artist page at `app/artists/[slug]/page.tsx` is the single point of truth for artist detail. This rule applies across the homepage, the artists grid page, the footer, and any future section.

## Inversion of Control & Component Contracts

Inversion of Control (IoC) & Component Contracts
Props Over State: UI components MUST receive all data and callbacks as props — they must not directly access global state, context, or external stores.
No Direct Context Reads: Components that render UI (sections, cards, widgets) must receive their data via props. Context access is only permitted in top-level wiring components (e.g., App.tsx, AdminPanel.tsx, use-app-state.ts).
Section Contracts: All page sections must extend SectionProps (or EditableSectionProps<T>) from src/lib/component-contracts.ts. The editMode, sectionLabels, and onLabelChange props are mandatory.
Admin Panel Contracts: All admin sub-forms must extend AdminPanelProps<T> from src/lib/component-contracts.ts. No sub-form should import or read AdminSettings directly from storage/context.
Dialog Contracts: All modals must extend DialogProps (with open / onClose). No dialog should manage its own visibility state internally.

## Domain Layer

Domain Layer (src/domain/)
Repository Interfaces: `src/domain/repositories/` contains TypeScript interfaces (IArtistRepository, IReleaseRepository, INewsRepository, IAssetRepository) that define what the application needs from persistent storage without depending on Supabase. Concrete implementations live in `src/lib/api/`. This enforces the Dependency Inversion Principle.
Event Bus: `src/domain/events/eventBus.ts` provides a typed pub/sub Event Bus for decoupled domain event communication. Import the singleton `eventBus` for application-wide use or `createEventBus()` for isolated test buses. DomainEvent union includes: artist.synced, release.synced, asset.uploaded, asset.deleted, user.role.changed, sync.completed. Use `eventBus.on(type, handler)` to subscribe and `eventBus.emit(event)` to publish. Async handler errors are caught and logged — they never propagate to the emitter.

## Web Workers

Web Workers (src/workers/)
CPU-intensive image operations (resize, format conversion) MUST use `src/workers/imageProcessor.worker.ts` via `createImageProcessorWorker()` from `src/workers/index.ts` so the main thread stays responsive.
Worker instances are lazily created per component/operation and MUST be terminated (`processor.terminate()`) when done. Create in component mount effect, terminate in cleanup.
ImageBitmap objects are transferred (not copied) to the worker via the Transferable API — do not reuse a bitmap after calling `resize()` or `toBlob()`.

## Centralized Error Handling

Centralized Error Handling
All Next.js Route Handlers MUST be wrapped with `withErrorHandler` from `src/lib/errors.ts`.
`withErrorHandler` catches `ApiError` (returns its status code), `ZodError` (returns 400 with VALIDATION_ERROR code), and unknown errors (returns 500). All responses follow `{ error, code, status }` shape.
Throw `new ApiError(status, message, code?)` inside route handlers instead of manually returning `NextResponse.json({ error })`.
`app/error.tsx` and `app/global-error.tsx` are the Next.js rendering error boundaries.

## Server vs. Client Component Decision Matrix — MANDATORY

Default to React Server Components (RSC). Add `"use client"` ONLY when the component:
- Uses browser event handlers (onClick, onChange, onSubmit)
- Uses browser-only APIs (window, localStorage, navigator, IntersectionObserver)
- Uses React hooks: useState, useEffect, useReducer, useRef, useContext
- Uses framer-motion animation primitives (motion.*, AnimatePresence)
- Uses useLenis() for programmatic scroll
- Uses Supabase Realtime subscriptions

NEVER add `"use client"` to a component just to avoid a TypeScript error or for
"convenience". Prop-drill server data down to client leaf components instead.

Pattern — RSC parent → "use client" leaf:
```tsx
// ✅ Correct: Server Component fetches, Client Component animates
// app/artists/[slug]/page.tsx (Server Component)
const artist = await getArtistBySlug(client, slug)
return <ArtistHero artist={artist} /> // ArtistHero is "use client"
```

## CQRS Convention (Command Query Responsibility Segregation)

Read operations belong in React Server Components (RSC) or `unstable_cache`-wrapped
DAL calls. Write operations from the React client context run exclusively as
`"use server"` Server Actions or JWT-authenticated Route Handlers.

| Context | Pattern | Examples |
|---|---|---|
| Portal forms (artist, profile, checklist) | Server Action (`"use server"`) | `src/actions/portal/*.ts` |
| Admin forms (artists, releases, news) | Route Handler + JWT ****** `/api/admin/artists`, `/api/admin/releases` |
| External systems (cron, webhooks) | Route Handler | `/api/sync`, `/api/webhooks/*` |
| SOS statement upload | Server Action (`"use server"`) | `app/portal/statements/_actions/uploadStatement.ts` |
| Public reads | RSC + `unstable_cache` | `app/artists/[slug]/page.tsx` |

**Why admin writes use Route Handlers (not Server Actions):** The Admin UI
communicates via `fetch()` with a JWT ****** which is not the Next.js
RSC request context. This is architecturally correct and should NOT be changed.

**Why portal writes should use Server Actions:** Portal pages are RSC-rendered
and the user session is available via cookies, making Server Actions the natural
fit. Migrations from Route Handlers to Server Actions happen incrementally.

## Server Actions vs. Route Handlers

| Use Case | Use |
|---|---|
| Form submissions from Client Components (portal, newsletter, EPK) | Server Action (`"use server"`) |
| External API consumers (cron jobs, webhooks, SOS generator) | Route Handler (`route.ts`) |
| Admin JWT-protected mutations called from JS `fetch()` | Route Handler |
| File uploads > 4.5 MB (use presigned URL flow instead) | Route Handler with presigned R2 URL |

Server Actions CANNOT be called from outside the Next.js app.
Route Handlers MUST be wrapped with `withErrorHandler`.

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

## Deprecated Code — FORBIDDEN Imports

`src/lib/supabase.ts` — DEPRECATED. Creates a browser-singleton Supabase client.
DO NOT import from this file in any new code.

Replace with:
- Client Components: `createBrowserSupabaseClient()` from `@/lib/supabase/client`
- Server Components / Route Handlers: `createServerSupabaseClient()` from `@/lib/supabase/server`
- Service-role operations: pass `createServerSupabaseClient()` with SUPABASE_SERVICE_ROLE_KEY

## ISR Cache Tag Naming Convention

Tags follow the pattern: lowercase table name as-is.
Multi-resource pages combine tags: `['artists', 'releases']`
Single-resource pages: `['releases', \`release-${id}\`]`

### List-level tags (invalidate all pages of this type)
  'artists' | 'releases' | 'news' | 'videos' | 'concerts'
  'site-settings' | 'artist-profiles' | 'sync-logs'

### Entity-level tags (invalidate only one specific page)
  `'artist-${slug}'`   → use in `app/artists/[slug]/page.tsx`
  `'release-${id}'`    → use in `app/releases/[id]/page.tsx`
  `'news-${slug}'`     → use in `app/news/[slug]/page.tsx`

All pages use BOTH a list-level and an entity-level tag so that either a
full-list revalidation or a targeted single-entity revalidation will bust them:
  `app/artists/[slug]`  → tags: `['artists', 'artist-${slug}']`
  `app/releases/[id]`   → tags: `['releases', 'release-${id}']`
  `app/news/[slug]`     → tags: `['news', 'news-${slug}']`

When calling revalidateTag() in a Route Handler after a write:
- Artist update: `revalidateTag('artists')` + `revalidateTag('artist-${slug}')`
- Release update: `revalidateTag('releases')` + `revalidateTag('release-${id}')`
- News update: `revalidateTag('news')` + `revalidateTag('news-${slug}')`

`POST /api/revalidate-content` accepts an optional `entityTags` array for
targeted Supabase Database Webhook-driven revalidation.
Adding an undocumented tag silently does nothing.

## Next.js Metadata API — MANDATORY for every page.tsx

Every `page.tsx` MUST export either a static `metadata` object or a
`generateMetadata()` async function. NEVER use `<title>` or `<meta>` in JSX.

Static pages (e.g. /impressum):
```tsx
export const metadata: Metadata = {
  title: 'Impressum | darkTunes Music Group',
  description: '...',
}
```

Dynamic pages (e.g. /artists/[slug]):
```tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const artist = await getArtistBySlug(client, params.slug)
  return {
    title: `${artist.name} | darkTunes Music Group`,
    openGraph: { images: [{ url: artist.imageUrl }] },
  }
}
```

## loading.tsx — Required for all async route segments

Every route segment with async data fetching MUST have a `loading.tsx` sibling.
The loading skeleton MUST use the EXACT same grid/flex layout as the loaded
content (skeleton dimension parity — prevents CLS).

Skeleton components live in `src/components/skeletons/`.
Use shadcn/ui `<Skeleton>` as the primitive. Never use a spinner as a full-page replacement.

## generateStaticParams — Required for known dynamic routes

These routes MUST export `generateStaticParams()` to enable ISR pre-rendering:
- `app/artists/[slug]/page.tsx`
- `app/releases/[id]/page.tsx`
- `app/news/[slug]/page.tsx`

Set `export const dynamicParams = true` so ISR can serve unknown slugs at runtime.
Set `export const revalidate = 60` at the route segment level.

## Cloudflare R2 Object Key Naming Convention

ALL R2 keys MUST be stored in the corresponding DB column (`r2_key`) so that
`deleteObjectFromR2(r2Key)` can clean up when the DB record is deleted.

Key prefixes (NEVER deviate):
  artists/{artistId}/{uuid}.{ext}                         → artist images / logos
  releases/{releaseId}/{uuid}.{ext}                        → release cover art
  profile-photos/{artistId}/{uuid}.{ext}                   → portal profile photos
  release-covers/{artistId}/{uuid}.{ext}                   → portal-submitted release covers
  statements/{artistId}/{filename}                         → SOS royalty PDFs
  artist-assets/{artistId}/{uuid}.{ext}                    → artist-uploaded marketing files
  artist-documents/{artistId}/{uuid}_{originalFilename}    → portal document vault (PDF/DOCX contracts, GEMA, splits)
  press-kit/{category}/{uuid}.{ext}                        → EPK assets (press photos, etc.)
  promo-tracks/{uuid}.{ext}                                → journalist promo audio

## Naming Conventions

Files:
- React components:   PascalCase.tsx    (ArtistCard.tsx)
- Pages:              page.tsx          (enforced by Next.js)
- Hooks:              useCamelCase.ts   (useArtists.ts)
- DAL functions:      camelCase.ts      (artists.ts, siteSettings.ts)
- Utilities:          camelCase.ts      (imageUtils.ts, r2Utils.ts)
- Types:              camelCase.ts      (database.ts, users.ts)
- Server Actions:     camelCase.ts      (newsletter.ts, presignedUrl.ts)
- Route Handlers:     route.ts          (enforced by Next.js)
- Tests:              *.test.ts / *.spec.ts (co-located with source)

Components:
- All React component function names: PascalCase
- Hooks: always prefixed with `use`
- DAL functions: `verb + Noun` pattern (getArtistBySlug, upsertRelease, deleteVideo)
- Boolean props: `is` or `has` prefix (isVisible, hasError, isLoading)

## Directory Structure

## shadcn/ui Component Policy

Files in `src/components/ui/` are generated by the shadcn CLI.
⛔ NEVER edit them directly — changes will be overwritten by `npx shadcn@latest add`.

To extend a primitive: wrap it in a NEW component in `src/components/`.
To add a new shadcn component: `npx shadcn@latest add [component-name]`
Check `components.json` for the project's shadcn configuration before adding.

## Package Manager — npm ONLY

This project uses npm exclusively. NEVER use yarn, pnpm, or bun.
The `package-lock.json` is the lock file — committing a second lock file (yarn.lock,
pnpm-lock.yaml) will break CI.

CI uses `npm ci` (strict install from lock file). Never run `npm install` in CI.

## TypeScript Import Paths

`@/` maps to `./src/` (configured in tsconfig.json paths).
Always use `@/` for cross-directory imports instead of relative `../../..` paths.
Exception: Same-directory imports use `./` (e.g., `./utils`).
Exception: Files under `app/` must be imported via relative paths, not `@/app/...`.

Import order (enforced by ESLint):
1. Node built-ins (node:fs, node:path)
2. External packages (react, next/image, framer-motion)
3. Internal absolute imports (@/components/..., @/lib/...)
4. Relative imports (./Button, ../utils)

## State Management Policy

No global state library (Redux, Zustand, Jotai, Recoil) is used in this project.
Do NOT add one without team agreement.

State rules:
- Persisted server state → RSC + ISR (no React Query / SWR / TanStack)
- Shared UI state (locale, consent) → React Context in app/_components/Providers.tsx
- Component-local state → useState / useReducer
- Smooth-scroll instance → useLenis() from LenisProvider (singleton via ReactLenis)
- Form state → react-hook-form (admin/portal forms only)

## Form Validation

Admin and Portal forms: use `react-hook-form` with `@hookform/resolvers/zod`.
Zod schemas: co-locate with the form file OR in `src/lib/schemas/`.
Validate BOTH client-side (for UX) AND server-side in the Route Handler / Server Action.

Public forms (newsletter, contact): Server Actions with Zod + honeypot field.
Never trust client-side validation alone for security-relevant inputs.

## HTML Sanitization (XSS Prevention)

Any content rendered via `dangerouslySetInnerHTML` MUST be sanitized with DOMPurify.
DOMPurify requires the DOM — only use in `"use client"` components.

```tsx
import DOMPurify from 'dompurify'
// ✅
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rawHtml) }} />
// ❌ NEVER
<div dangerouslySetInnerHTML={{ __html: rawHtml }} />
```

Applies to: label_messages.body_html, artist_replies.body_html, any CMS rich-text field.

## Application Error Logging (app_logs table)

Log to `app_logs` for errors that need admin visibility but are non-fatal:
- Failed email deliveries (SOS notification, newsletter DOI)
- Failed R2 upload/delete operations during sync
- External API timeouts that fall back to cached data

Use the service-role client; never expose app_logs to anon/public.
Schema: { level: 'error'|'warn'|'info', message: string, context: JSONB, created_at }
Visible in Admin → Logs tab (AppErrors sub-view).

