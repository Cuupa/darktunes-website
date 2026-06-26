# Backend, Admin & Sync

## Admin route auth

Use `src/lib/adminAuth.ts`: `extractBearerToken`, `verifyAdminOrEditor`, `verifyAdmin`, `verifyPermission`. All admin routes wrap `withErrorHandler`.

`RolePermissionKey`: `can_publish_news`, `can_edit_news`, `can_manage_artists`, `can_manage_releases`, `can_manage_videos`, `can_view_admin_panel`.

## Rate limiting

External API calls: `withExponentialBackoff()` + `HttpError` from `src/lib/rateLimiter.ts`.

## Sync service

Logic in `src/lib/sync/` with injected `SyncDeps`. `syncSingleArtist` / `syncAll` never throw — errors in `SyncResult.errors`. Each run → `sync_logs`.

**Cron (`vercel.json`):** `/api/sync` (enqueue + */5 execute), `/api/sync-youtube` (06:00 UTC). Auth: `CRON_SECRET` + `timingSafeEqual`. Edge alternative: `supabase/functions/trigger-sync`.

**Queue:** `sync_queue` DAL in `syncQueue.ts` — enqueue, claim, done/failed, recover stuck, requeue.

## API credentials

Encrypted in `api_credentials` (AES-256-GCM). Admin: `/admin/api-keys`. Resolver: `getExternalCredentials.ts`. Bootstrap secrets stay in env.

## Admin assets

SSOT: `assets` table + `asset_folders`. Upload: `POST /api/upload`. Explorer APIs: `/api/admin/assets/*`. Press curation: `press_kit_items` + `PressKitBuilder`. Deletes: R2 first, then DB.

## Admin accounting (`/admin/accounting`)

Admin/editor only. **Guided** default: `AccountingGuidedWizard` (Upload → Review → Publish). **Advanced:** SOS upload, reporting, Abrechnungszentrale (`SettlementCenterPanel`), portal persist, SEPA, trends, rules.

- SOS PDF upload: `uploadStatement` Server Action (same as portal flow)
- Bronze CSV: server-proxy upload/download — see `features.md`
- Save to Portal: `persistSosAnalytics` → gold tables (`territory_metrics`, `merch_orders`, etc.)
- Settlement register, corrections, period lock/archive — see `features.md`

## Bronze CSV import

Client: `bronzeUpload.ts`. Multipart: `bronzeMultipartUpload.ts`. Limits: `bronzeUploadLimits.ts`. Decision tree in `AGENTS.md` / `features.md`.

## SOS upload (portal + admin)

`uploadStatement` in `statements/_actions/uploadStatement.ts`: session auth → presigned PUT → `createSalesStatement` (service role) → `sendStatementNotification` (non-blocking). PDF as Base64 in Server Action.

## Submission notifications

Release/video submit → `editor_notifications` + `sendSubmissionNotificationEmail()` (fire-and-forget).

## Admin system (`/admin/system`)

Health (`buildHealthSnapshot`), sync logs, app errors, maintenance routes. Cron heartbeats + optional alert webhook.

## Scheduled news publishing

No Vercel Cron. Due posts (`status = scheduled`, `published_at <= now`) are promoted to `published` when `getCachedPublicNews()` revalidates (public homepage, `/news`, etc.). Admin saves trigger `revalidateTag('news')` via `useNews`.

## Emoji-free public text (a11y)

User-facing text is stripped of emoji characters via `src/lib/stripEmojis.ts` on read (DAL mappers), write (DAL sanitizers), HTML display (`sanitizeHtml`), admin paste (TipTap + plain inputs), and a one-time `persistEmojiCleanup()` pass during public cache revalidation. Theme preset emoji pickers in admin are excluded.

## Hero featured limits

Releases and news posts support `featured_until` and `featured_removed_reason`. The hero carousel shows at most 10 eligible featured items (`src/lib/heroFeatured.ts`). `enforceHeroFeaturedLimits()` runs during public cache revalidation; enabling an 11th feature in admin prompts a confirmation modal and bumps the oldest active hero item.

## Newsletter DOI

`subscribeToNewsletter` Server Action → pending row → Edge Function email → `GET /api/newsletter/verify`.

## Password recovery email

Public: `POST /api/auth/forgot-password` (rate-limited, enumeration-safe). Admin: `POST /api/admin/users/:id/reset-password`.

Both use `requestPasswordReset()` in `src/lib/auth/requestPasswordReset.ts`:

1. **Resend configured** (Admin → API Keys): `auth.admin.generateLink({ type: 'recovery' })` → branded HTML via `sendPasswordResetEmail()` with impressum footer from `site_settings`.
2. **Resend not configured or send fails**: falls back to `auth.resetPasswordForEmail()` (Supabase built-in template).

Recovery landing page unchanged: `/login?type=recovery`.

## Admin users & feature flags

Users tab: `users.ts` DAL + `/api/admin/users/*` (admin only). Two flag systems: `site_settings.feature_toggles` (global) + `portal_feature_flags` (per-module).

## Public rate limits (`ipRateLimit.ts`)

| Route | Limit |
|-------|-------|
| `/api/contact` | 5 / 10 min |
| `/api/auth/forgot-password` | 3 / 10 min |
| `/api/newsletter` | 3 / 10 min |
| `/api/journalist-applications` | 3 / 30 min |
| `/api/page-events` | 120 / 10 min |

## robots.txt & llms.txt

`app/robots.ts` — block private prefixes in `disallow`. `app/llms.txt/route.ts` — dynamic from Supabase (revalidate 300s); never list admin/portal routes.

## Vercel deployment

`scripts/vercel-install.sh` — `npm ci` + env validation. Required: `NEXT_PUBLIC_SUPABASE_*`, R2 vars, `API_CREDENTIALS_ENCRYPTION_KEY`. Integrations in Admin API Keys. See `DEPLOYMENT.md`.

## Error logging

Non-fatal errors → `app_logs` (service role). Visible in Admin System tab.