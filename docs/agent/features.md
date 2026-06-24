# Portal, Press & Product Features

## Artist Portal

Artist Portal (Multi-Tenant)
The Artist Portal lives at `/portal/*` — a secure dashboard for the label's bands.
Auth: `middleware.ts` protects all `/portal/*` routes (except `/portal/login`) using the same Supabase session-cookie pattern as `/admin/*`.
Multi-tenancy: `artists.user_id UUID REFERENCES auth.users(id)` links each artist row to a Supabase Auth user. One auth user ↔ one artist.
Portal DAL functions: `getArtistByUserId(db, userId)` in `src/lib/api/artistProfiles.ts` resolves the current user's linked artist. Always call this before accessing artist-scoped data.
RLS enforcement: `artist_profiles`, `streaming_stats`, `sales_statements`, `release_checklists`, `artist_replies`, and `artist_assets` all have artist-scoped RLS policies using `auth.uid()` + artist linkage. Security is at the DB layer; no middleware-only filtering.
Presigned URL pattern: `src/lib/portal/presignedUrl.ts` exposes two injectable functions:
  - `generatePresignedDownloadUrl(r2Key, deps)` — 5-minute GET URL for artist downloads (`PresignedUrlDeps`)
  - `generatePresignedUploadUrl(r2Key, contentType, deps)` — 15-minute PUT URL for the SOS PDF generator to upload directly to R2, bypassing Vercel's 4.5 MB body limit (`PresignedUploadUrlDeps`)
  The Server Action `app/portal/statements/_actions/presignedUrl.ts` wires real deps for artist-facing downloads.
Photo upload: `app/api/portal/upload-photo/route.ts` accepts `multipart/form-data`, verifies auth, confirms artist ownership, then uploads to `profile-photos/{artistId}/{uuid}.{ext}` in R2. Max 5 MB, image types only.
Release submission: `POST /api/portal/submit-release` creates a new release with `is_visible = FALSE` (pending admin approval). Optional cover uploads use `POST /api/portal/upload-release-cover` (max 5 MB images) into `release-covers/{artistId}/`. After a successful insert, the route fires a fire-and-forget call to `sendSubmissionNotificationEmail()` (see Submission Notifications below) and creates `editor_notifications` rows for all admins and editors so the bell icon in the admin sidebar highlights the new submission.
Artist-owned marketing uploads: `POST /api/portal/upload-asset` stores files in `artist-assets/{artistId}/` and inserts into `artist_assets`; `DELETE /api/portal/upload-asset` deletes own rows. Allowed MIME types: JPEG, PNG, WebP, PDF, ZIP (max 20 MB).
Label replies: `artist_replies` stores artist-side responses to inbox messages. The portal uses `sendPortalReply` Server Action + `src/lib/api/artistReplies.ts`.
Messaging upgrade: `label_messages` supports `body_html`, `read_at`, `starred`, `deleted_at`, and a generated `search_vector`; `artist_replies` supports `body_html` + `deleted_at`; admin-only `message_templates` stores reusable rich-text subjects/bodies. Admin messaging UI is split into `src/components/messaging/*` (RichTextEditor, MessageComposer, MessageSearch, MessageActions, ThreadView), and all rendered message HTML must be sanitized with DOMPurify in client components.
Admin asset visibility: `AssetsManager` (admin Assets tab) shows both the general `assets` table and a second "Artist Assets" section that lists all `artist_assets` rows (joined with `artists.name` for identification). Admins can copy URLs; artists manage their own rows via the portal.
IoC in portal: Every portal page is a Server Component that fetches data and passes it as props to a `"use client"` leaf component. Leaf components never call `fetch` or Supabase directly.
Release checklists: `src/lib/api/releaseChecklists.ts` provides `getOrCreateReleaseChecklist(db, artistId, releaseId)` (seeds DEFAULT_RELEASE_TASKS on first call) and `toggleChecklistItem(db, id, isCompleted)`. The PATCH `/api/portal/checklist` route handler uses Bearer token auth and relies on RLS for artist-scoped enforcement.
Bio lengths: `artist_profiles` has three bio columns — `bio_short` (≤100 words), `bio_medium` (≤300 words), `bio_long` (≤1000 words) — in addition to the general `bio` field. The profile form exposes all four.
Portal nav items are now feature-flag aware (`portal_feature_flags`): Overview, Profile, Analytics, Releases (`/portal/releases`), Tour (`/portal/tour`), Calendar (`/portal/calendar`), Marketing (`/portal/marketing`), Documents (`/portal/documents`), Interviews (`/portal/interviews`), Statements, Messages (`/portal/messages`), Help (`/portal/help`). Settings (`/portal/settings`) is always visible (not flag-gated). Onboarding (`/portal/onboarding`) is shown only for new artists who have not completed the first-run wizard.
Billing master data lives in `artist_billing_profiles` and is edited at `/portal/billing`. Portal invoice creation MUST call `isBillingProfileComplete()` before generating PDFs. SOS-linked invoices pass through `/portal/invoices?statement={id}`, store the artist’s own bookkeeping number in `artist_invoice_number`, and set `sales_statements.status = 'invoiced'` after successful creation.

## Settlement & Abrechnungszentrale

Enterprise settlement lifecycle for SOS statements and artist invoices. Admin UI: **Accounting → Abrechnungszentrale** (`SettlementCenterPanel` in `src/components/admin/sos/SettlementCenterPanel.tsx`).

**Workflow (7 steps):** review → draft upload → label approve + notify → artist viewed → invoice created → invoice received → paid. Status helpers live in `src/lib/sos/statementWorkflow.ts`; badges/stepper in `statementWorkflowUi.tsx`.

**Tables** (schema in `supabase/reset.sql`): `settlement_periods`, `artist_settlement_ledger` (append-only), `period_carry_forwards`, `financial_audit_events`. Extended columns on `sales_statements` (view tracking, correction/versioning, FX, `settlement_period_id`) and `artist_invoices` (received/paid/outstanding, `settlement_period_id`).

**DAL:** `src/lib/api/settlementPeriods.ts`, `settlementLedger.ts`, `settlementRegister.ts`, `financialAudit.ts`; extended `salesStatements.ts` (`linkApprovedStatementToSettlement`, `recordStatementView`, `createCorrectionStatement`) and `artistInvoices.ts` (`markInvoiceReceived`, `recordInvoicePayment`).

**Admin APIs:** `GET /api/admin/settlements/register`, `GET /api/admin/settlements/periods`, `POST .../periods/[id]/lock`, `POST .../periods/[id]/archive`, `POST /api/admin/sales-statements/bulk-approve`, `POST .../[id]/correction`, `PATCH /api/admin/invoices/[id]/received`, `PATCH .../[id]/payment`.

**Portal:** `POST /api/portal/statements/[id]/view` (also triggered on PDF download via `getStatementPresignedUrl` server action). Invoice create (`POST /api/portal/invoices`) books `invoice_liability` ledger entries.

**Carry-forward:** Archiving a period (`archivePeriodWithCarryForward`) writes `period_carry_forwards` + `carry_out`/`carry_in` ledger entries. SOS CSV processing accepts `carryForwardByArtist` in `DataProcessorConfig` (loaded from register `openingBalanceEur` in `AccountingPanel`).

**Corrections:** `POST /api/admin/sales-statements/[id]/correction` supersedes the original statement and creates a correction draft; UI wizard in Abrechnungszentrale per-artist **Korrektur** button.

**Shared client helpers:** `getAdminAccessToken()` in `src/lib/admin/getAccessToken.ts` (admin API auth from client components). Workflow step derivation: `deriveActiveWorkflowStep` / `deriveCompletedWorkflowSteps` in `statementWorkflow.ts`.

**CSP:** `src/lib/security/contentSecurityPolicy.ts` is the single source of truth (imported by `next.config.ts`). `connect-src` must include `https://*.r2.cloudflarestorage.com` for browser-side R2 presigned uploads.

Portal Analytics page (`app/portal/analytics/page.tsx`) — tabs: Streaming, Listeners, Territories, Events (concert + **promo impact** from `promo_impact`), Earnings, Releases, Revenue Mix, EPK & Press, **Settlement** (`artist_settlement_ledger` read-only), **Website** (`page_events`), **Merch** (`merch_orders`). Promo impact precomputed in `src/lib/analytics/promoImpactCompute.ts` on SOS persist. Merch orders normalised in the SOS worker (`buildMerchOrderRows`) and upserted on persist. Overview (`/portal`) shows **Intelligence** panel via `src/lib/analytics/overviewInsights.ts`. Auto-insights in `src/lib/analytics/insights.ts`.

**Website tracking (consent-gated):** `PageTracker` in `Providers.tsx` fires `page_view` / `news_view` when `darktunes_consent=accepted`. Shop clicks from roster + artist detail pages (`trackShopClick`). Smart-link clicks from artist `smartLinks` and release Odesli hubs (`trackSmartLinkClick`). `POST /api/page-events` (rate-limited, service-role insert, slug → artist/news resolution). Skips `/admin`, `/portal`, `/press`, `/editor`.

Admin Label Analytics (`app/admin/analytics/page.tsx`, admin-only): persistent **Label Intelligence Hub** — roster health matrix, `sos_period_summaries` trends, press download CRM, **website engagement** (`page_events` label rollup), and `financial_audit_events` viewer. Nav entry under MANAGEMENT in `AdminSidebarNav`.

## Document Vault

Document Vault (Artist Portal)
`/portal/documents` — artists upload and manage PDF/DOCX contracts, GEMA registration forms, and royalty splits documents.
Table: `artist_documents` — columns: `id`, `artist_id`, `filename`, `original_filename`, `r2_key`, `file_size`, `mime_type`, `created_at`. RLS: artists can only read/insert/delete their own rows.
Upload: `POST /api/portal/documents/upload` — accepts `multipart/form-data`, verifies auth, confirms artist ownership, uploads to `artist-documents/{artistId}/{uuid}_{filename}` in R2, inserts `artist_documents` row. Max 20 MB. Allowed MIME types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
Delete: `DELETE /api/portal/documents/[id]` — verifies auth and artist ownership (via RLS), deletes R2 object first, then deletes DB row.
Download: documents are served as short-lived presigned R2 GET URLs generated in a Server Action — the raw R2 key is never sent to the browser.
Client component: `app/portal/documents/_components/DocumentVault.tsx`. The `artistId` prop is received for type safety but the upload API derives the artist from the session cookie — the prop is intentionally not forwarded to the API (rename to `_artistId` in destructuring if ESLint flags it).

## Video Submission Portal

Video Submission Portal
`/portal/releases/videos/new` — artists submit new video entries for admin review.
Submission creates a `videos` row with `is_visible = FALSE` (pending admin approval). The route fires `sendSubmissionNotificationEmail()` and creates `editor_notifications` rows for all admins and editors.
Admin review: `app/admin/video-submissions/page.tsx` renders `VideoSubmissionsManager` — lists all `is_visible=false` video rows, lets admins approve (set `is_visible=true`) or reject (delete) each submission.
API: `POST /api/portal/submit-video` (artist auth, creates pending video row); `PATCH /api/admin/video-submissions/[id]` (admin/editor auth, approve or reject).

## Artist Portal Access Gate

Artist Portal Access Gate
`middleware.ts` gates `/portal/*` (except `/portal/accept-invite`) by querying `artist_members` via `hasPortalArtistMembership()` in `src/lib/portal/membership.ts` — NOT JWT `app_metadata.artist_id`. Admins bypass the membership check.
Portal layout (`app/portal/layout.tsx`) enforces role-based access BEFORE rendering the portal UI:
  - Roles `artist` or `admin` → portal accessible (user must also have a linked artist record).
  - Role `user` (unassigned/new) → `PortalAccessGate` component shown — explains how to request access.
  - Other roles (`editor`, `journalist`) → `PortalAccessGate` shown with role explanation.
`PortalAccessGate` lives at `app/portal/_components/PortalAccessGate.tsx`.
New users default to `user` role = zero portal/admin access until an Admin explicitly assigns a role and links their artist profile.
Onboarding redirect: `shouldRedirectToOnboarding()` in `src/lib/portal/onboardingGate.ts` redirects to `/portal/onboarding?artistId=…` when no `artist_epks` row exists OR when `onboarding_completed` is false and `isProfileComplete()` returns false.
Multi-artist context: all portal pages and onboarding server actions resolve the active artist via `resolvePortalArtist(db, userId, artistId)` using the `?artistId=` query param; `getArtistByUserId()` is deprecated for portal flows.

## Artist Preview

Artist Preview
`PortalSidebar` accepts `artistSlug: string | null`, `featureFlags: Record<string, boolean>`, and `unreadMessages: number` props from the layout Server Component.
When `artistSlug` is set, a "Preview Public Profile" link is shown under the artist name (opens `/artists/{slug}` in a new tab).
The same preview link/button appears at the top of `ProfileForm` (passed via `artistSlug` prop from `portal/profile/page.tsx`).

## EPK PDF Export

EPK PDF Export (Artist Portal) — Dual Path
**Legacy (HTML presets):** Browser print dialog on the live HTML preview (`src/lib/epk/printEpkDocument.ts`, entry `app/portal/profile/_components/epkPdf.ts`). `generateEpkPdf()` clones `[data-epk-root]` from `EPKPreview.tsx` into a print popup and calls `window.print()`. `TabsContent value="epk"` uses `forceMount` so the document stays in the DOM for export from any tab.

**Canvas Builder (Phase 1+):** Route `/portal/epk-builder` (feature flag `artist.epk_builder`). Document JSON schema v2 lives in `src/lib/epk/schema/documentV2.ts` and is persisted on `artist_epks.epk_document` (JSONB) with `epk_document_version` and `epk_editor_mode` (`legacy` | `canvas`). Version history: `epk_versions` table. Custom fonts: `epk_fonts` table (R2 key `epk-fonts/{artistId}/`).

Migration: `src/lib/epk/migrate/legacyToDocumentV2.ts` converts legacy preset columns into positioned canvas elements on first access (`ensureMigratedEpkDocument` in `src/lib/api/epkDocument.ts`).

Server PDF: `POST /api/portal/epk/export` → `src/lib/epk/export/renderDocumentToPdf.ts` (pdf-lib + Sharp image compression). No Puppeteer.

Editor (Phase 2): `/portal/epk-builder` uses `EpkEditorProvider` + Zustand/Immer/zundo (`src/lib/epk/editor/store.ts`). UI: `EpkBuilderShell` (toolbar, `EpkCanvas` with Transformer, `EpkLayersPanel`, `EpkPropertiesPanel`). Autosave: `useEpkAutosave` (3s debounce → `PUT /api/portal/epk/document`). Read-only preview fallback: `EpkCanvasPreview.tsx`.

Editor (Phase 3): Multi-page UI (`EpkPagesPanel` — add/duplicate/delete/rename pages via store page CRUD). Asset library (`EpkAssetPicker` — inserts images from `artist_assets` + `POST /api/portal/upload-asset`). Version history (`EpkVersionHistoryPanel` — list/restore snapshots from `epk_versions`; manual snapshots via toolbar `create_version: true` on `PUT /api/portal/epk/document`).

Editor (Phase 4): Custom fonts (`EpkFontManager` + `EpkFontLoader` — upload WOFF2/WOFF/TTF/OTF to R2 `epk-fonts/{artistId}/`, register in `epk_fonts`, sync `document.fonts[]`). Font family picker in `EpkPropertiesPanel`. Server PDF embeds custom fonts via `embedDocumentFonts.ts` (fontkit + pdf-lib). Rider PDFs from `artist_epks.rider_*_url` are appended as extra pages in `appendPdfAttachments.ts` during `generateEpkPdfBytes()`.

API routes: `GET/PUT /api/portal/epk/document`, `GET /api/portal/epk/versions`, `POST /api/portal/epk/versions/[id]/restore`, `GET/POST/DELETE /api/portal/epk/fonts`, `GET/POST/DELETE /api/portal/epk/share` (Bearer auth + `resolvePortalArtist`). Export route uses `ipRateLimit` (10 req / 10 min per IP). DAL: `epkFonts.ts`, `epkShareLinks.ts`, `restoreEpkVersion()` in `epkDocument.ts`, `getEpkVersionById()` in `epkVersions.ts`.

Public (Phase 5): `getPublicArtistEpkByArtistId()` in `src/lib/api/publicArtistEpk.ts` reads safe columns from `artist_epks` (RLS: `artist_epks: public read visible`). Press artist page (`app/press/artists/[slug]`) renders `EpkPublicViewer` when `epk_editor_mode === 'canvas'`. Share links: table `epk_share_links`, public route `/epk/share/[token]`, API `GET/POST /api/epk/share/[token]` (service-role lookup + optional password). Group elements: `groupSelected`/`ungroupSelected` in editor store; `EpkGroupNode` + `flattenGroupElements()` for PDF. PDF bookmarks from page names via `addPdfBookmarksFromPages.ts` in `generateEpkPdfBytes()`.

Analytics & Templates (Phase 6): `epk_download_events` table logs PDF exports (`portal` | `share` | `press`) via fire-and-forget `recordEpkDownloadAsync()` (hashed IP, service-role insert). Press PDF: `GET /api/epk/press/[slug]/export` (rate-limited, logs `press` source) + download button on `ArtistEpkClient` when canvas EPK is shown. Portal stats: `GET /api/portal/epk/analytics`, UI `EpkDownloadStatsPanel` (count queries, not full-table scan). Share-link expiry presets in `EpkShareLinkPanel` (`expires_at` on create). Admin brand templates: `epk_templates` table, `EpkTemplatesManager` (Press Portal tab), `GET/POST/PATCH/DELETE /api/admin/epk-templates` (verifyAdmin + service-role client), artist picker `GET /api/portal/epk/templates` (portal Bearer auth) + `EpkTemplatePicker` (`applyDocument` clears custom fonts + undo history).

Portal Bearer auth: ALL portal Route Handlers that verify a Bearer JWT MUST use `authenticatePortalBearer()` or `authenticatePortalBearerWithArtist()` from `src/lib/portal/bearerAuth.ts` — not just `/api/portal/epk/*`. These helpers return a Supabase client from `createBearerAuthSupabaseClient(token)` so RLS sees `auth.uid()` correctly; do not use `createServerSupabaseClient()` (cookie session) for DB operations after Bearer verification.

Profile save (`PUT /api/portal/profile`): artist photo lives on `artists.image_url` (not `artist_epks`). Route handlers that verify Bearer tokens MUST use `createBearerAuthSupabaseClient(token)` for subsequent RLS writes — cookie session alone may be stale.

## Journalist Dashboard

Journalist Dashboard
Protected routes live at `/press/dashboard/*` with dedicated `/press/login`.
Middleware enforces auth and role (`journalist` or `admin`) before access.
Feature-flag-gated modules: promo pool, press kit, press releases, accreditation, download history.

## Press & Media Ecosystem

Press & Media Ecosystem
Press assets SSOT: `assets` table (upload via `/api/upload` or portal `/api/portal/upload-asset`) + `press_kit_items` curation. Public/journalist reads use `getPressKitForArtist()` / `getJournalistPressKit()` from `src/lib/api/pressKit.ts`. Legacy `press_photos` table is retained in schema for idempotent backfill only.
Artist EPK: `app/press/artists/[slug]/page.tsx` fetches curated kit items via `getPressKitForArtist()`. `ArtistEpkClient` renders a `PressPhotoLightbox` slider (Framer Motion, WCAG) for image assets.
Journalist press kit dashboard: `app/press/dashboard/press-kit/page.tsx` uses `getJournalistPressKit()` + `PressKitList` with the same lightbox.
Public press landing: `app/press/page.tsx` (Server Component) fetches artists and press releases — per-artist EPK photos come from the artist slug route above.
Promo Pool: `/promo-pool/*` is a dual-gated journalist-only area.
  - Gate 1 (Edge Middleware): unauthenticated users are redirected to `/promo-pool/login`.
  - Gate 2 (Layout Server Component): authenticated users without role `journalist` or `admin` see `PromoPoolAccessGate` (shows application status or application form).
Anti-leak audio: `promo_tracks` stores only the R2 object key — NO public URL. The `getPromoTrackStreamUrl(r2Key)` Server Action in `src/actions/promoTrack.ts` verifies the journalist/admin role and returns a 15-minute presigned GET URL. The URL is only generated on explicit user click, never in initial HTML.
Admin EPK upload: `getEpkUploadUrl(category, filename, contentType)` in `src/actions/epkUpload.ts` generates a 15-minute presigned PUT URL for direct browser-to-R2 upload, bypassing Vercel's 4.5 MB limit. Categories: `press-photos` | `promo-tracks`.
Journalist applications: `journalist_applications` table; `POST /api/journalist-applications` lets anyone submit. `PATCH /api/journalist-applications/[id]` (admin-only) approves/rejects. Admin UI is in `src/components/admin/PressManager.tsx` (Press Portal page).
Application schema: `journalist_applications` has separate `website_url TEXT` and `reason TEXT` columns for structured storage — do NOT concatenate them into the legacy `message` column. The `submitPressApplication` Server Action in `app/press/apply/_actions/apply.ts` writes `website_url` and `reason` individually.
Transaction safety in `apply.ts`: After `supabase.auth.signUp`, if the `journalist_applications` INSERT fails the action immediately calls `serviceRole.auth.admin.deleteUser()` to roll back the orphaned auth account before returning an error.
Role assignment trigger: The DB trigger `trg_journalist_application_status_change` (function `handle_journalist_application_status_change`, SECURITY DEFINER) automatically sets `users.role = 'journalist'` on approval and `users.role = 'user'` on rejection. The `PATCH /api/journalist-applications/[id]` route handler therefore only calls `updateApplicationStatus()` — it does NOT need a separate manual role update.
DAL: `src/lib/api/pressKit.ts` (primary), `src/lib/api/promoTracks.ts`, `src/lib/api/journalistApplications.ts` — each with Vitest tests. `journalist_downloads.asset_id` optionally links downloads to `assets.id`.
user_role enum: includes `journalist`, `artist` in addition to `admin`, `editor`, `user`. The `UserProfile` type in `src/types/index.ts` reflects all five values.
DB: All tables for journalist role, `press_kit_items`, `assets` press columns, promo_tracks, and journalist_applications are defined in `supabase/reset.sql` (the only schema source of truth).

## PWA

PWA (Progressive Web App)
The site is a fully installable PWA powered by @serwist/next (v9) + serwist.
Service Worker: `app/sw.ts` — compiled by serwist's Next.js plugin into `public/sw.js` (gitignored). Uses `CacheFirst` for static assets and wsrv.nl images (30-day TTL), `StaleWhileRevalidate` for R2 assets, `NetworkFirst` for HTML pages, and serves `app/offline/page.tsx` as a document fallback when offline.
next.config.ts is wrapped with `withSerwistInit` from `@serwist/next`. The `exclude` list prevents the service worker from intercepting `/api/*`, `/admin/*`, `/portal/*`, `/press/*`, `/promo-pool/*` routes.
Manifest: `app/manifest.ts` (Next.js 15 `MetadataRoute.Manifest`) — served at `/manifest.webmanifest`. `display: 'standalone'`, `background_color / theme_color: '#101010'`. Requires icon files in `public/icons/` (see `public/icons/README.md`).
Apple PWA meta tags (theme-color, apple-mobile-web-app-capable, apple-touch-icon) are injected in `app/layout.tsx`.
Custom install prompt: `src/components/PWAInstallPrompt.tsx` — listens for `beforeinstallprompt` (Android/Chrome) and shows an on-brand banner after 3 seconds. iOS users see a manual "Share → Add to Home Screen" hint. Dismissal is persisted in localStorage (`pwa-install-dismissed`). Mounted once in `app/_components/Providers.tsx`.
NEVER add a second `PWAInstallPrompt` instance. NEVER intercept admin/portal/press routes in the service worker.

