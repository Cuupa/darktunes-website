# Backend, Admin & Sync

## Admin Route Auth

Admin Route Auth Pattern
All admin API routes MUST use the shared auth helpers from `src/lib/adminAuth.ts`:
  - `extractBearerToken(authHeader)` — extracts the JWT from `Authorization: Bearer <token>`, throws ApiError(401) if missing.
  - `verifyAdminOrEditor(token)` — verifies the token and asserts `admin` or `editor` role. Throws ApiError(401) for invalid tokens, ApiError(403) for insufficient role.
  - `verifyAdmin(token)` — like `verifyAdminOrEditor` but requires the `admin` role specifically. Use for admin-only mutations (e.g. modifying role permissions).
  - `verifyPermission(token, permission)` — verifies the token and checks a specific permission column in the `role_permissions` table. Admin role always passes. Use this instead of `verifyAdminOrEditor` for content-specific routes so granular permissions are enforced end-to-end.

Available `RolePermissionKey` values: `can_publish_news`, `can_edit_news`, `can_manage_artists`, `can_manage_releases`, `can_manage_videos`, `can_view_admin_panel`.

Route → permission mapping:
  - fetch-artist-image, prefill-artist*, enrich-artist-discogs → `can_manage_artists`
  - resolve-release-smart-link → `can_manage_releases`
  - fetch-youtube-info → `can_manage_videos`
  - `/api/admin/assets/*`, `/api/admin/media/*` → `can_view_admin_panel`
  - `/api/admin/roles/permissions` GET → `verifyAdminOrEditor`, PATCH → `verifyAdmin`

Do NOT duplicate `verifyTokenAndRole` inline in individual route files — use the shared helper.
Every admin route MUST be wrapped with `withErrorHandler` from `src/lib/errors.ts` for uniform error responses.

## Rate Limiting (external APIs)

Server-side external API calls MUST use `withExponentialBackoff()` from `src/lib/rateLimiter.ts`.
Throw `HttpError(status, message)` for HTTP errors to distinguish retryable (429, 5xx) from non-retryable failures.
Non-HTTP errors (e.g. network errors) are not retried — they fail immediately.

## Sync Service

Sync Service Pattern
Complex sync logic lives in `src/lib/sync/` with a dependency-injected `SyncDeps` interface (db, fetch, uploadToR2).
The HTTP handler in `app/api/sync/artist/route.ts` wires deps and calls `syncSingleArtist(artistId, 'full', deps)` so manual per-artist sync runs the full multi-API pipeline (iTunes via internal `syncArtist()`, plus Spotify/Discogs/concerts/Odesli when env vars and artist IDs are set). Tests mock all deps.
`syncArtist()` processes iTunes releases with bounded concurrency (`mapWithConcurrency` from `src/lib/mapWithConcurrency.ts`, limit 5): upsert release first (external cover URL fallback), then upload cover to R2 and update `cover_art`.
Sync functions MUST NOT throw — capture all errors in `SyncResult.errors` and return gracefully.
Every sync run writes a `sync_logs` entry with status 'success', 'partial', or 'error'.
`sync_logs` also records `api_source` (itunes | spotify | discogs | songkick | bandsintown | odesli | all) and `rate_limited` (boolean) per run.
The full multi-API orchestrator lives in `src/lib/sync/syncAll.ts` (SyncAllDeps extends SyncDeps with optional spotify/discogsToken/songkickApiKey/bandsintownApiKey). Called by `POST /api/sync`.
Release deduplication: `src/lib/sync/deduplication.ts` merges Spotify + Discogs releases using ISRC → barcode/UPC → normalised title + year precedence.
`syncAllReleases()` in `useReleases.ts` returns the full `SyncAllResult` (typed import from `src/lib/sync/syncAll.ts`). `ReleasesManager` parses the result: on success shows a toast with total items synced; on errors shows a warning toast and a "View Errors" button that opens a dialog with per-API error details.

Cron Jobs (Vercel):
  Three cron jobs can be configured in `vercel.json`:
  - `/api/sync-youtube` — daily at 06:00 UTC: fetches latest YouTube channel videos.
  - `/api/sync` — daily at 03:00 UTC: enqueues async sync jobs for all artists into `sync_queue` and returns immediately.
  - `/api/sync` — every 5 minutes: claims pending `sync_queue` jobs (50s budget per invocation, multiple jobs), runs `syncSingleArtist` per job, marks done/failed. maxDuration: 300s.
  - `/api/sync/queue` — enqueues one `full` job per artist (called by daily `/api/sync` cron or admin bulk sync).
  All routes accept either a ****** (manual trigger), a Vercel cron call (`x-vercel-cron: 1` header),
  or a CRON_SECRET ****** (from a Supabase Edge Function or external scheduler) — all require `CRON_SECRET` env var (mandatory).
  The `isValidCronSecret` helper uses `timingSafeEqual` to prevent timing attacks.

Supabase Sync Triggers (`supabase/functions/trigger-sync/index.ts`):
  The `trigger-sync` Supabase Edge Function is an alternative to Vercel Cron Jobs.
  It accepts a `type` query parameter or JSON body field with one of these values:
  `all`, `youtube`, `itunes`, `spotify`, `discogs`, `songkick`, `bandsintown`, `odesli`.
  It then calls the corresponding Next.js sync route using `CRON_SECRET` authentication.
  Required Edge Function secrets: `SITE_URL` (Next.js app URL) and `CRON_SECRET` (must match Vercel env var).
  Can be scheduled via Supabase Cron (Dashboard → Database → Cron Jobs) or triggered by a Database Webhook.
  Deploy with: `supabase functions deploy trigger-sync --project-ref <ref>`

Async Sync Queue (`sync_queue` table):
  `POST /api/sync` enqueues one row per artist with `status='pending'` — it does NOT run the sync inline.
  `POST /api/sync` claims jobs atomically (UPDATE to `status='running'` with optimistic lock) to prevent double-processing.
  Failed jobs are retried up to 3 times (`attempt_count`) with exponential backoff managed in `markSyncJobFailed()`.
  DAL: `src/lib/api/syncQueue.ts` exports `enqueueArtistSyncJobs`, `claimNextSyncJob`, `markSyncJobDone`, `markSyncJobFailed`, `recoverStuckSyncJobs`, `requeueFailedSyncJobs`, `getSyncQueueStats`, `getRecentSyncJobs`.
  The Admin Health tab shows queue progress via `getSyncQueueStats()`.

Idempotency Keys (`idempotency_keys` table):
  Financial and submission endpoints accept an optional `idempotencyKey` (UUID) in the request body.
  DAL: `src/lib/api/idempotency.ts` exports `checkAndClaimIdempotencyKey(db, key, resourceType)` (atomic INSERT ... ON CONFLICT DO NOTHING) and `updateIdempotencyKeyResourceId(db, key, id)`.
  Applied to: `/api/portal/submit-release`.
  Keys older than 24h are cleaned up on each check. Only service-role client can access this table (no public RLS).

Spotify Sync Notes:
  `fetchSpotifyArtistReleases` builds the URL as a manual template literal to avoid `URLSearchParams` encoding commas in `include_groups` as `%2C`, which Spotify rejects with HTTP 400.
  `deriveFormat` in `discogsApi.ts` accepts `string | undefined | null` and returns `'other'` for missing format fields (prevents TypeError on undefined Discogs releases).

Odesli Sync Notes:
  The Odesli batch in `syncAll.ts` tracks `artistsProcessed` (counts release attempts) and captures API errors per-release into `odesliResult.errors`. Rate-limit errors (HTTP 429) set `rateLimited = true`. 404/no-match responses are silently skipped (expected for unlisted tracks).

## API Credentials (encrypted in Supabase)

External integration keys (Spotify, Discogs, Resend, YouTube, MailerLite, health webhook) are stored in `api_credentials` as AES-256-GCM ciphertext. Admin manages them at `/admin/api-keys` (admin-only). API routes: `GET/PUT /api/admin/api-credentials`, `DELETE /api/admin/api-credentials/[key]`, one-time `POST /api/admin/api-credentials/import-env`.

- SSOT key list: `src/lib/secrets/credentialKeys.ts`
- Encrypt/decrypt: `src/lib/secrets/credentialCrypto.ts` (envelope `v1:<iv>:<tag>:<data>`)
- DAL: `src/lib/api/apiCredentials.ts` — pass `SupabaseClient` as first arg
- Runtime resolver: `src/lib/secrets/getExternalCredentials.ts` — 60s in-memory cache; call `invalidateCredentialCache()` after admin writes
- Sync routes wire credentials via `getSyncCredentials(db)` instead of `process.env`
- Supabase/Cloudflare bootstrap secrets and `CRON_SECRET` / `REVALIDATE_SECRET` remain in env
- Edge Function `newsletter-confirm` still uses Supabase Edge Secrets for Resend (not yet migrated)

## Admin Utility Routes

Admin Utility Routes (admin/editor auth required):
  `POST /api/admin/cleanup-orphaned-releases` — deletes all releases where `artist_id IS NULL` (uses service-role client). Returns `{ deleted: number }`. Triggered by the "Clean Orphaned" button in ReleasesManager.
  `POST /api/admin/fetch-youtube-info` — resolves a YouTube URL or video ID to `{ videoId, title, channelTitle, thumbnailUrl }` via YouTube oEmbed (no API key needed). Called by the "Fetch Info" button in VideoForm.
  `DELETE /api/admin/assets/[id]` — permanently deletes an asset record from Supabase AND its corresponding object from Cloudflare R2 via `deleteObjectFromR2()` from `src/lib/r2Utils.ts`. The R2 object is deleted first; if that fails the DB record remains. Returns `{ success: true }`.

## Admin Asset Explorer

Admin Asset Explorer (Single Source of Truth for media)
The admin Assets tab is the sole media manager — the legacy `media_files` / `/api/admin/media` system is deprecated and removed. All press photos, logos, and label media live in the `assets` table with optional press metadata (`is_press_approved`, `press_suggested`, `press_category`, `alt_text`, etc.).
Curated journalist/public press kits use the `press_kit_items` junction table (per-artist or label-wide scope). Admin curation: `PressKitBuilder` in `/admin/press` (Press Kit tab) + bulk press actions in the Asset Explorer toolbar. API: `/api/admin/press-kit/*`, `/api/admin/assets/bulk-press`.
The explorer is folder-based, backed by `asset_folders` and the enriched `assets` schema (`folder_id`, `artist_id`, `tags`, `sha256_hash`, `original_filename`).
`app/api/upload/route.ts` is the single admin upload entry point: it verifies admin/editor auth, computes a SHA-256 hash, returns the existing asset on duplicate upload, uploads new files to R2, and inserts the asset row server-side.
Folder/list/search/batch mutations live under `app/api/admin/assets/*`; destructive deletes must remove the R2 object(s) before deleting database rows.
`src/hooks/useFileExplorer.ts` is the client-side orchestration hook for the explorer, and `src/components/admin/file-explorer/AssetPicker.tsx` is the reusable selector used by `ArtistForm` and `PressKitBuilder`.
Artist portal uploads (`POST /api/portal/upload-asset`) also insert into `assets`; artists can check "Suggest for press kit review" (`press_suggested`) which creates `editor_notifications` for admins/editors.

## Video Admin UX

Video Admin UX:
  VideoForm accepts full YouTube URLs (watch?v=, youtu.be/, /shorts/, /embed/) and auto-extracts the 11-char video ID on input.
  "Fetch Info" button calls `/api/admin/fetch-youtube-info` to auto-fill title, channel name, and thumbnail.
  VideosManager has a "Sync YouTube Channel" button that calls `POST /api/sync-youtube` and shows synced count in toast.

## Artist Import

Artist Import (Spotify + Apple Music):
  ArtistForm has a single Spotify URL field (no duplicated quick-import field) with an "Import" button that pre-fills name, image, genres, spotifyId, and spotifyUrl via `POST /api/admin/prefill-artist`.
  ArtistForm also has an Apple Music URL field with an "Import" button that pre-fills name, image, genres, and appleMusicUrl via `POST /api/admin/prefill-artist-itunes`.

## Cascade Deletes

Cascade Deletes:
  `releases.artist_id` uses `ON DELETE CASCADE`. When an artist is deleted, all their releases are automatically deleted by the DB.
  The delete confirmation dialog in ArtistsManager explicitly states this to the user.

## Discogs Enrichment

Discogs Artist Enrichment (manual):
  `src/lib/sync/discogsApi.ts` exports two functions:
    - `fetchDiscogsArtistReleases(id, token, fetch)` — paginated release list (used by syncAll).
    - `fetchDiscogsArtistProfile(id, token, fetch)` — fetches artist bio, primary image, and URLs from `GET /artists/{id}`. Token is optional (higher rate limit when provided).
  `cleanDiscogsMarkup(text)` strips Discogs wiki markup ([a=Name], [l=Label], [url=…][/url], etc.) and is exported for standalone use and testing.
  Admin route `POST /api/admin/enrich-artist-discogs` (body: `{ discogsId }`) verifies admin/editor role, calls `fetchDiscogsArtistProfile`, and returns `{ name, bio, imageUrl, urls }`. It does NOT write to the DB — the admin UI applies the data via the normal artist update flow.
  The "Enrich from Discogs" button in `ArtistForm` only fills empty fields (bio, imageUrl) — it never overwrites data the admin has already entered.

## Odesli Smart Links

Odesli (song.link) Smart Links:
  `src/lib/sync/odesliApi.ts` exports `resolveOdesliSmartLink(musicUrl, fetch)` which resolves any streaming URL to a universal smart link page.
  During the full `syncAll` run, Odesli is called for every newly synced release to populate `releases.smart_url`.
  Admin route `POST /api/admin/resolve-release-smart-link` (body: `{ releaseId }`) lets editors manually resolve the Odesli link for a single release and persists it to `releases.smart_url`.
  The "Resolve Smart Link" (link icon) button in ReleasesManager triggers this route. The button is disabled when the release has no Spotify or Apple Music URL.
  On the public release detail page (`app/releases/[id]`), a "Listen Everywhere" button links to `release.smartUrl` when populated (shown first, above platform-specific links).

## R2 Image Caching

R2 Image Caching
When syncing external content, always download cover/artwork images and upload to Cloudflare R2 via `uploadUrlToR2()` from `src/lib/r2Utils.ts`. Sync uploads use SHA-256 content hashes as object keys (`cover-art/{hash}.{ext}`) and skip `PutObject` when `HeadObject` finds an existing object — preventing duplicate R2 objects on repeated syncs. Upsert the DB row first (with external URL as `cover_art` fallback), then upload to R2 and update `cover_art` only after a successful upsert.
`src/lib/r2Utils.ts` also exports `createR2Client()` and `deleteObjectFromR2(r2Key, s3, bucket)` — use `deleteObjectFromR2` whenever a DB record that carries an `r2_key` is deleted, to keep R2 storage in sync.
Store the R2 public URL (not the external URL) in the database. The public website reads only from Supabase + R2.
If R2 upload fails during sync, fall back to the external URL and log the error — do not abort the sync.

## Idempotency Keys

Idempotency Keys (`idempotency_keys` table):
  Financial and submission endpoints accept an optional `idempotencyKey` (UUID) in the request body.
  DAL: `src/lib/api/idempotency.ts` exports `checkAndClaimIdempotencyKey(db, key, resourceType)` (atomic INSERT ... ON CONFLICT DO NOTHING) and `updateIdempotencyKeyResourceId(db, key, id)`.
  Applied to: `/api/portal/submit-release`.
  Keys older than 24h are cleaned up on each check. Only service-role client can access this table (no public RLS).

## Admin Accounting

Admin Accounting Tab
`/admin/accounting` — admin-only route with two tabs:
  - **SOS Generator**: Upload royalty statement PDFs for any artist directly from the admin panel. Runs the `uploadStatement` Server Action (same action as the portal flow). Requires admin/editor session.
  - **Statement History**: Read-only table of all `sales_statements` rows (same data as `StatementsManager` in the admin dashboard), sorted newest-first. Shows artist name, period, amount (EUR), filename, and status.

## Admin System Tab

Admin System Tab (Health, Logs, Maintenance)
`/admin/system` — admin-only route with multiple sub-sections:
  - **Health dashboard** (`SystemHealthWidget`): enterprise monitoring via `src/lib/health/healthSnapshot.ts` (`buildHealthSnapshot`) + pure derivations in `apiStatus.ts` / `alerts.ts` / `cronHeartbeat.ts`. `GET /api/health` returns health score (0–100), KPI summary, sorted actionable alerts (critical/warning/info), per-API 24h SLA stats, DB latency tiers (online/slow/critical/offline), cron scheduler heartbeats (`site_settings.health_heartbeats`), and speakable operational states. **Proactive alerts:** `GET|POST /api/health/alert` (Vercel cron every 10 min) evaluates critical alerts, deduplicates via `site_settings.health_alert_state` (30 min cooldown per fingerprint), and dispatches email (`sendHealthAlertNotification` → `LABEL_NOTIFICATION_EMAIL`) plus optional `HEALTH_ALERT_WEBHOOK_URL`. Cron routes record heartbeats: `sync_execute`, `sync_queue`, `sync_youtube`, `health_alert`. `vercel.json` crons: execute */5, alert */10, queue 03:00 UTC, youtube 06:00 UTC (all require `Authorization: Bearer <CRON_SECRET>`).
  - **Audit Log**: all `sync_logs` entries with full-text search, `api_source` filter, and `status` filter.
  - **Error Log**: failed and partial sync runs (`sync_logs.status IN ('error','partial')`).
  - **App Errors**: `app_logs` entries with `level = 'error'` or `level = 'warn'`.
  - **Maintenance panel** (`MaintenanceManager.tsx`): destructive one-shot admin operations:
      - `POST /api/admin/maintenance/clear-logs` — truncates `sync_logs` older than N days.
      - `POST /api/admin/maintenance/purge-releases` — deletes orphaned releases (`artist_id IS NULL`).
      - `POST /api/admin/maintenance/reset-checklists` — deletes all `release_checklists` rows for a given artist.
      - `POST /api/admin/maintenance/clear-accreditations` — deletes pending `accreditation_requests` older than N days.
      - `POST /api/admin/maintenance/reset-accreditations` — resets a journalist's accreditation status.
      - `POST /api/admin/maintenance/clear-stats` — deletes `streaming_stats` rows for a given artist + period.
      - `POST /api/sync/requeue` — resets `sync_queue` rows with `status='failed'` back to `pending` (admin Maintenance tab).
  All maintenance routes require admin auth via `verifyAdmin`. All are wrapped with `withErrorHandler`.

## SOS Upload

SOS (Statement of Sales) — Direct Server Action Upload
Statement-of-Sales PDFs are uploaded directly via the `uploadStatement` Server Action in `app/portal/statements/_actions/uploadStatement.ts`. Authentication is via the caller’s Supabase session (admin or editor role required) — no external webhook or shared secret is needed.
The Server Action: (1) verifies admin/editor role via `createServerSupabaseClient` + `getUserRoleWithClient`, (2) generates an R2 key (`statements/{artistId}/{uuid}_{filename}`), (3) generates a 15-minute presigned R2 PUT URL via `generatePresignedUploadUrl`, (4) uploads the PDF blob (received as Base64) directly to R2, (5) calls `createSalesStatement()` with the service-role client to bypass RLS, (6) calls `sendStatementNotification()` non-blocking.
DAL: `createSalesStatement(db, data)` in `src/lib/api/salesStatements.ts` inserts the record. MUST be called with a service-role client to bypass RLS.
PDF encoding: The client hook (`useSosExports`) converts the PDF Blob to Base64 via `blobToBase64()` (uses `blob.arrayBuffer()` + `btoa`) before calling the Server Action — Server Actions do not support raw Blob transfer.
Validation helpers: `isValidArtistId` and `isValidPeriod` live in `src/lib/sos/validation.ts`.
Email notification: After a successful `sales_statements` insert, the Server Action calls `sendStatementNotification()` from `src/lib/email/sendStatementNotification.ts`. Failure is logged but does NOT block the response (graceful degradation). Skipped silently when Resend is not configured in Admin → API Keys.
Admin statements overview: `StatementsManager` component (`src/components/admin/StatementsManager.tsx`) provides a read-only table in the Admin dashboard (Statements tab, admin-only) showing all `sales_statements` rows joined with `artists.name`. Columns: Artist Name, Period, Amount (EUR), Filename (monospace), Created At. Sorted newest first.

## Submission Notifications

Submission Notifications (artist portal → admin)
When an artist submits a release or video, two notification paths are triggered in parallel:
1. In-app bell: `editor_notifications` rows are inserted for every user with role `admin` or `editor` (query uses `.in('role', ['admin', 'editor'])`). The `EditorNotificationBell` component in `AdminSidebarNav` highlights unread notifications — it is shown in both the desktop sidebar brand header and the mobile header.
2. Email: `sendSubmissionNotificationEmail()` in `src/lib/email/sendSubmissionNotificationEmail.ts` sends an HTML notification via Resend to `LABEL_NOTIFICATION_EMAIL`. Follows the same non-throwing, fire-and-forget pattern as `sendStatementNotification.ts` — failure is logged but never blocks the portal response. Silently skipped when Resend (Admin → API Keys) or `LABEL_NOTIFICATION_EMAIL` are unset.
The `sendSubmissionNotificationEmail` function is dependency-injected (`SendSubmissionEmailDeps`) to remain fully testable without network calls. 7 unit tests in `src/lib/email/sendSubmissionNotificationEmail.test.ts`.

## Admin Live Shows

Admin Live Shows (EventManager in admin context)
`EventManager` (`app/portal/events/_components/EventManager.tsx`) accepts two optional props:
  - `concertsApiPath?: string` (default: `/api/portal/concerts`) — the API base URL for CRUD operations. Set to `/api/admin/concerts` in the admin context.
  - `hideIcsExport?: boolean` (default: `false`) — hides the ICS export button (portal-specific, not applicable in admin).
`AdminConcertsManager` (`src/components/admin/AdminConcertsManager.tsx`) wraps `EventManager` with an artist-selector dropdown so admins can manage concerts for any artist. It is rendered under the **Events** tab of `AdminDashboard` (Calendar icon, visible to both admins and editors).
Admin concerts API (`app/api/admin/concerts/route.ts`) uses `verifyAdminOrEditor` + `extractBearerToken`. POST requires `artistId` in the request body (unlike the portal route which resolves the artist from the session cookie). The concerts table RLS already allows admins and editors to insert/update/delete any row — no schema changes were needed.

## Vercel Deployment

Vercel Deployment
Install script: scripts/vercel-install.sh runs npm ci and validates all required environment variables.
Required env vars are split into two groups:
  - Client-side (must have NEXT_PUBLIC_ prefix to be exposed to the browser):
      NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
  - Server-side (never exposed to the browser; used only in Vercel Route Handlers / Edge Functions):
      SUPABASE_SERVICE_ROLE_KEY,
      CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID,
      CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME,
      CLOUDFLARE_R2_PUBLIC_URL
  - Required (API credentials encryption):
      API_CREDENTIALS_ENCRYPTION_KEY (64-char hex; `openssl rand -hex 32`)
  - External integrations (Spotify, Discogs, Resend, YouTube, MailerLite, etc.):
      configured in Admin → API Keys (`api_credentials` table), not Vercel env vars
  - Optional (cron / infra):
      CRON_SECRET, REVALIDATE_SECRET, NEXT_PUBLIC_SITE_URL, LABEL_NOTIFICATION_EMAIL, CONTACT_EMAIL
  - Optional (ISR webhook revalidation — required for Supabase webhook-triggered cache busting):
     REVALIDATE_SECRET
  - Optional (Supabase Read Replica — Supabase Pro plan; routes heavy analytics reads off the primary DB):
     SUPABASE_REPLICA_URL, SUPABASE_REPLICA_ANON_KEY
Configure all variables in Vercel Dashboard → Project → Settings → Environment Variables.
See DEPLOYMENT.md for full variable descriptions and setup instructions.

## Newsletter DOI

Newsletter Double Opt-In (DOI) Flow
newsletter_subscribers stores each signup with status='pending' and a UUID verification_token until the user confirms.
Subscription entry point: `subscribeToNewsletter(formData)` Server Action in `src/actions/newsletter.ts`. The form in `NewsletterSection.tsx` calls this via React 19 Server Action invocation (no fetch, no route handler).
Email delivery: a Supabase Edge Function (`supabase/functions/newsletter-confirm/index.ts`, Deno runtime) is triggered by a Database Webhook on INSERT to `newsletter_subscribers`. It sends the DOI confirmation email via the Resend API.
Verification: `GET /api/newsletter/verify?token=<uuid>` looks up the pending row, flips status to 'subscribed', optionally syncs to MailerLite, and redirects to `/newsletter/confirmed`.
Anti-enumeration: duplicate email submissions return a silent success — the user is never told whether the address is already registered.
Legacy REST fallback: `POST /api/newsletter` (Route Handler) still accepts subscriptions for server-to-server integrations and testing; it follows the same pending+token pattern.
DAL: `createPendingSubscriber(db, email, token, name?)` and `verifySubscriberToken(db, token)` in `src/lib/api/newsletter.ts`. Both require a service-role client to bypass RLS.
Edge Function secrets (set in Supabase Dashboard → Edge Functions → Secrets):
  - `newsletter-confirm`: RESEND_API_KEY, RESEND_FROM_EMAIL, NEXT_PUBLIC_SITE_URL.
  - `trigger-sync`: SITE_URL (your Next.js production URL), CRON_SECRET (must match Vercel env var).

## Admin User Management

Admin User Management
The **Users** tab in the AdminDashboard (`src/components/admin/AdminDashboard.tsx`) is only visible when `profile.role === 'admin'`. It renders `<UsersManager />`.
The **Features** tab is also admin-only — it renders `<FeatureTogglesManager />` to toggle `promoPool`, `sosStatements`, and `editorTools` globally.
Editor restriction: Editors (`role === 'editor'`) see only artists, releases, news, and videos tabs in the admin dashboard. Admin-only tabs (assets, settings, health, media, users, features) are hidden for editors. If `editorTools` feature toggle is disabled, editors are blocked from admin entirely with an "Editor Tools Disabled" gate.
Types: `UserRole` and `UserWithProfile` are in `src/types/users.ts`.
DAL: `src/lib/api/users.ts` exports `listUsersWithProfiles`, `updateUserRole`, `banUser`, `deleteUser`, `linkArtistToUser`, `unlinkArtistFromUser`. All functions accept a service-role `SupabaseClient`. Supabase Auth Admin API methods (`listUsers`, `updateUserById`, `deleteUser`) are called via the `adminClient.auth.admin` namespace.
Hook: `src/hooks/useUsers.ts` fetches from `GET /api/admin/users` and exposes `updateRole`, `toggleBan`, `deleteUser`, `linkArtist`, `unlinkArtist` with optimistic updates and toast notifications.
API Routes (all admin-only, use service-role client):
  - `GET /api/admin/users` — lists all users merged with profile roles and linked artist names.
  - `PATCH /api/admin/users/[id]` — updates `role` and/or `ban` status; rejects self-modification.
  - `DELETE /api/admin/users/[id]` — deletes user from Auth; profiles cascade. Rejects self-deletion.
  - `PATCH /api/admin/users/[id]/link-artist` — links or unlinks (`artistId: null`) an artist to a user. Validates no double-linking.
Security: Every route verifies `profiles.role = 'admin'` server-side via `createServerSupabaseClient()` before using the service-role client. The service-role key never reaches the browser.

## Feature Toggles

Feature Toggles
There are now two feature-flag systems:
1) Global JSON toggles in `site_settings` key `feature_toggles` (`promoPool`, `sosStatements`, `editorTools`) managed by `FeatureTogglesManager`.
2) Role-targeted portal/journalist module flags in `portal_feature_flags` (e.g. `artist.tour`, `journalist.press_kit`) managed by `FeatureFlagsManager` and `PATCH /api/admin/feature-flags/[id]`.
Enforcement: Portal and press dashboard nav/routes read `portal_feature_flags`; legacy promo-pool/editor gates still read `site_settings.feature_toggles`.

## robots.txt & llms.txt

robots.txt & llms.txt Maintenance
Two auto-generated discovery files are served by Next.js at build/request time — no static files to edit manually:

`app/robots.ts` — generates `/robots.txt` via the Next.js Metadata API.
  - To BLOCK a new private route prefix (e.g. `/members/`): add `'/members/'` to the `disallow` array in the `rules[0]` entry.
  - To BLOCK an additional AI training crawler: add its user-agent string to the `userAgent` array in the second rules entry.
  - To add a NEW sitemap URL: add the full URL to the `sitemap` property.
  - ⛔ Never add allow rules for routes protected by middleware — middleware already blocks them; allow rules would be misleading.

`app/llms.txt/route.ts` — generates `/llms.txt` dynamically from live Supabase data (ISR revalidate: 300 s).
  - New artists and releases appear automatically — no manual update needed.
  - To ADD a new public section (e.g. `/merch`): add a line to the `## Sections` block inside `buildLlmsTxt()`.
  - To REMOVE a section: delete its line from the `## Sections` block and its corresponding data fetch/render block.
  - To ADD extra metadata (e.g. label social links): add it to the header block in `buildLlmsTxt()`.
  - ⛔ Never list admin, portal, press, or promo-pool routes in `llms.txt` — those are restricted by robots.txt.
  - Cache tags: the route uses `artists` and `releases` tags — it is automatically refreshed when those caches are invalidated by the sync cron jobs.

## Application Error Logging

## Application Error Logging (app_logs table)

Log to `app_logs` for errors that need admin visibility but are non-fatal:
- Failed email deliveries (SOS notification, newsletter DOI)
- Failed R2 upload/delete operations during sync
- External API timeouts that fall back to cached data

Use the service-role client; never expose app_logs to anon/public.
Schema: { level: 'error'|'warn'|'info', message: string, context: JSONB, created_at }
Visible in Admin → Logs tab (AppErrors sub-view).

## Public Endpoint Rate Limiting (IP)

In-memory sliding-window limiter: `src/lib/ipRateLimit.ts` (`checkRateLimit`, `getClientIp`).

| Route | Limit | Window | Auth |
|---|---|---|---|
| `/api/contact` | 5 | 10 min | Public |
| `/api/newsletter` | 3 | 10 min | Public |
| `/api/journalist-applications` | 3 | 30 min | Public POST |
| `/api/page-events` | 120 | 10 min | Public (consent-gated client); service-role insert |

`POST /api/page-events` resolves `/artists/[slug]` and `/news/[slug]` to UUIDs, hashes session IDs, and inserts into `page_events`. No Bearer token — abuse mitigation is IP rate limiting only. See `SECURITY.md` for privacy notes.

SOS analytics persist (`persistSosAnalytics` server action) requires admin/editor JWT; delegates to `persistSosAnalyticsCore` with service-role client for gold-layer upserts including `merch_orders`.

