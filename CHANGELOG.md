# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **ISR pre-rendering**: `releases/[id]` and `news/[slug]` now export `generateStaticParams()` + `dynamicParams = true`, pre-rendering all visible entries at build time so ISR starts warm rather than cold on-demand.
- **Loading skeletons** (zero CLS): added `loading.tsx` for all previously uncovered async routes — `/artists`, `/events`, `/events/[id]`, `/news/[slug]`, `/fan/[slug]`, `/datenschutz`, `/impressum`, `/login`, `/promo-pool`, `/epk/share/[token]`, `/newsletter`, `/newsletter/confirmed`, `/offline`, `/account/privacy`, `/account/delete`, `/press/releases/[slug]`, `/press/artists/[slug]`, and all 12 admin sub-pages (`/admin/features`, `/admin/settings`, `/admin/analytics`, `/admin/assets`, `/admin/users`, `/admin/statements`, `/admin/videos`, `/admin/tour-planner`, `/admin/portal-faq`, `/admin/api-keys`, `/admin/support`, `/admin/promo-log`).
- **Metadata exports**: `/promo-pool` and `/editor` now export `generateMetadata()` with `robots: noindex`.

### Changed
- **`generateInvoicePdf`** converted from synchronous with `require()` to `async` with `await import()` — eliminates `@typescript-eslint/no-require-imports` suppressions.
- **ESLint `react-hooks/exhaustive-deps` suppressions removed** from `TiptapEditor.tsx`, `FileExplorer.tsx`, `PromoLogManager.tsx`, `AdminDashboard.tsx`, `ArtistForm.tsx`, and `useSosCSVProcessor.ts` by fixing root causes: ref-based stable callbacks, functional `setState` updaters, and a `sendProcessRef` to decouple worker lifecycle from `sendProcess` identity.

- **Enterprise Analytics — Portal** (`/portal/analytics`): 11 tabs — Streaming, Listeners, Territories, Events (concert + promo impact), Earnings, Releases, Revenue Mix, EPK & Press, Settlement, Website engagement, Merch. Overview intelligence panel on `/portal` with deep links. Authenticated Supabase reads for correct RLS.
- **Enterprise Analytics — Admin** (`/admin/analytics`): Label Intelligence Hub — roster health, period trends, press CRM, website engagement, financial audit viewer. Sidebar entry under MANAGEMENT.
- **Gold-layer tables**: `promo_impact`, `page_events`, `merch_orders` in `supabase/reset.sql` + `src/types/database.ts`.
- **Website tracking**: consent-gated `PageTracker` + `POST /api/page-events` (rate-limited, service-role insert, slug resolution). Shop clicks from roster cards.
- **Merch pipeline**: `buildMerchOrderRows()` in SOS worker → upsert on Accounting **Save to Portal**.
- **DAL**: `pageEvents.ts`, `merchOrders.ts`, `labelAnalytics.ts`, `promoImpact.ts`; analytics compute modules in `src/lib/analytics/`.
- **Artist Portal — Document Vault**: `/portal/documents` — artists upload and manage PDF/DOCX contracts, GEMA forms, and splits documents. Stored in R2 under `artist-documents/{artistId}/`. `artist_documents` table with RLS. Route handlers: `POST /api/portal/documents/upload` (20 MB), `DELETE /api/portal/documents/[id]`.
- **Artist Portal — Calendar**: `/portal/calendar` — tour date / event calendar view for the artist's own concerts.
- **Artist Portal — Interviews**: `/portal/interviews` — interview request management and scheduling.
- **Artist Portal — Onboarding Wizard**: `/portal/onboarding` — first-run wizard guiding new artists through profile setup, photo upload, and social links.
- **Artist Portal — Help / FAQ**: `/portal/help` — FAQ page and artist support contact form.
- **Artist Portal — Video Submission**: `/portal/releases/videos/new` — artists submit new video entries for admin review (`is_visible=false`). Notifies admins via `editor_notifications` and email.
- **Admin — Accounting tab**: `/admin/accounting` — Tab A: SOS Generator (upload royalty PDFs for any artist via `uploadStatement` Server Action); Tab B: Statement History table.
- **Admin — System tab**: `/admin/system` — Health dashboard, Audit/Error/App-Error logs with filtering, Media Library, and Maintenance panel (clear logs, purge orphaned releases, reset checklists, manage accreditations, clear stats).
- **Admin — Release Submissions**: `/admin/release-submissions` — review and approve/reject artist-submitted releases.
- **Admin — Video Submissions**: `/admin/video-submissions` — review and approve/reject artist-submitted videos.
- **Supabase Read Replica client**: `src/lib/supabase/replica.ts` exports `createReplicaSupabaseClient()`. When `SUPABASE_REPLICA_URL` and `SUPABASE_REPLICA_ANON_KEY` are set, analytics queries and admin health/log reads are routed to the replica. Falls back to primary DB when env vars are unset.
- **Admin Maintenance API routes**: `POST /api/admin/maintenance/clear-logs`, `purge-releases`, `reset-checklists`, `clear-accreditations`, `reset-accreditations`, `clear-stats`.

### Changed
- **SOS webhook removed**: `POST /api/webhooks/sos` and `POST /api/webhooks/sos/confirm` deleted. Statement-of-Sales PDFs are now uploaded via a direct `uploadStatement` Server Action (`app/portal/statements/_actions/uploadStatement.ts`) authenticated by the admin's Supabase session. `SOS_WEBHOOK_SECRET` env var is no longer needed.
- `isValidArtistId` and `isValidPeriod` moved from the deleted `src/lib/sos/sosWebhook.ts` into the new `src/lib/sos/validation.ts`.

### Fixed
- **ESLint 0 warnings**: Added `argsIgnorePattern: '^_'`, `varsIgnorePattern: '^_'`, `caughtErrorsIgnorePattern: '^_'` to the `@typescript-eslint/no-unused-vars` rule in `eslint.config.js`. Removed stale `eslint-disable-next-line` directives in `heroItems.ts` and `sos-csv-processor.worker.ts`.
- **`ArtistsManager.tsx` dead state**: Removed vestigial `editingArtist` / `setEditingArtist` state and `artistToFormData()` — editing now navigates to `/admin/artists/[id]/edit`; the inline dialog is create-only.
- **`ColorThemeManager.tsx` useEffect deps**: Added `draft.typography` to the dependency array alongside the individual font-family properties.
- **Upload size limits in SECURITY.md**: Corrected `/api/portal/upload-release-cover` from 10 MB → 5 MB. Added `/api/portal/upload-asset` as 20 MB (was incorrectly listed as 50 MB). Added `/api/portal/documents/upload` at 20 MB.

## [1.1.0] — 2026-06-06

### Added
- **Statement of Sales Email Notifications**: Artists receive an automatic email via Resend when a new statement is uploaded. Email includes period, optional amount, and link to `/portal/statements` for secure download.
- **Admin Statements Manager**: New read-only tab in Admin dashboard to monitor all uploaded statements across all artists.

### Changed
- `sendStatementNotification()` is called after every successful `sales_statements` insert (non-blocking).
