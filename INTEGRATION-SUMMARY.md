# Integration Summary — darkTunes Music Group

Living product-status snapshot. Architecture and agent rules: `AGENTS.md` + `docs/agent/`. User guides: `README.md`, `ADMIN.md`, `DEPLOYMENT.md`.

**Stack:** Next.js 15 · React 19 · Supabase · Cloudflare R2 · Vercel · Tailwind v4  
**Schema:** `supabase/reset.sql` only (no migrations) · **PRD:** [PRD.md](PRD.md)

---

## Public website

| Area | Status |
|------|--------|
| Home (hero, releases, artists, videos, news, tour, player) | ✅ RSC + ISR 60s, WCAG AA |
| Artist / release / news detail pages | ✅ ISR + `generateStaticParams` |
| i18n (EN/DE) | ✅ Dictionary prop injection |
| Legal, consent, newsletter DOI | ✅ |
| PWA (Serwist) | ✅ |
| Page tracking | ✅ Consent-gated `page_events` |

## Admin (`/admin`)

| Area | Status |
|------|--------|
| CMS (artists, releases, news, videos, assets, events) | ✅ |
| Messages, promo log, submissions, artist feedback, accreditations | ✅ |
| Users, roles, feature flags, API keys | ✅ |
| **Accounting** | ✅ Guided workflow (Upload → Review → Publish), Abrechnungszentrale, bronze CSV server-proxy, Save to Portal |
| Label analytics hub | ✅ |
| System (health, logs, maintenance) | ✅ |
| Press kit curation | ✅ `assets` + `press_kit_items` |

## Artist portal (`/portal`)

| Area | Status |
|------|--------|
| Profile, EPK (legacy + canvas builder), onboarding | ✅ |
| Analytics (11 tabs + intelligence) | ✅ |
| Statements, billing, invoices | ✅ SOS-linked + free PDF generator |
| **Inline billing** | ✅ `InlineBillingProfileStep` on invoices, analytics earnings, statements |
| Releases, tour, calendar, marketing, documents | ✅ |
| Messages, interviews, help, settings | ✅ |
| **Product feedback** | ✅ `/portal/feedback` form + history; admin `/admin/feedback` inbox |
| Multi-tenant RLS + `portal_feature_flags` | ✅ |

## Press & journalist

| Area | Status |
|------|--------|
| Public press + artist EPK pages | ✅ |
| Journalist dashboard + promo pool | ✅ Dual-gate auth |
| Applications + accreditation | ✅ DB trigger on approve |
| Secure downloads + logging | ✅ Presigned URLs only on click |

## Platform services

| Area | Key paths |
|------|-----------|
| DAL | `src/lib/api/*` — `SupabaseClient` first arg |
| Sync | `src/lib/sync/` — iTunes, Spotify, Discogs, Songkick, Bandsintown, Odesli; `sync_queue` + cron |
| Upload | `app/api/upload` (admin), portal upload routes |
| SOS PDF | `uploadStatement` Server Action |
| Settlement | `settlementPeriods`, `settlementLedger`, `settlementRegister`, `useSettlementCenter` |
| Errors | `withErrorHandler`, `ApiError` |
| Images | `imageUtils.ts` (wsrv.nl), `r2Utils.ts` |
| Health | `GET /api/health`, `/admin/system` |

---

## Entry-point files

| File | Purpose |
|------|---------|
| `PRD.md` | Product requirements (surfaces, modules, NFRs) |
| `README.md` | Quick start, scripts, env overview |
| `DEPLOYMENT.md` | Vercel, Supabase, R2 setup |
| `ADMIN.md` | Admin + portal operator guide |
| `AGENTS.md` | Agent index + mandatory checks |
| `docs/agent/*.md` | Topic-specific coding rules |
| `supabase/reset.sql` | Canonical DB schema |
| `src/types/database.ts` | TypeScript DB types (sync with reset.sql) |
| `.env.example` | Env var template |

## Dead code candidates (audit 2026-08-05)

Verified with knip + manual import search. **Do not delete without a second pass** (dynamic import, Serwist, Supabase Edge Functions, CLI scripts, and shadcn primitives are often false positives).

### High confidence — no runtime importers found

| Path | Why likely dead | Risk if deleted |
|------|-----------------|-----------------|
| `src/components/SpotifyPlayer.tsx` | Home uses `SpotifyMultiPlayer` | Low |
| `src/components/TacticalModal.tsx` | No imports | Low |
| `src/components/ReleasePreviewModal.tsx` | No imports | Low |
| `src/components/LoadingSpinner.tsx` | No imports (skeletons used instead) | Low |
| `src/components/Artists.tsx` | Roster uses page-level grid, not this component | Medium — confirm no dynamic import |
| `src/components/admin/AdminApp.tsx` | Superseded by `app/admin` layout + routes | Medium — historical SPA shell |
| `src/components/admin/LoginForm.tsx` | Only wired via unused wrappers; login is `/login` | Medium |
| `app/admin/_components/LoginPageWrapper.tsx` | Not referenced by any page | Low |
| `app/portal/_components/PortalLoginForm.tsx` | Superseded by central `/login` | Low |
| `app/portal/messages/_components/MessagesInbox.tsx` | Replaced by `PortalMailbox` | Medium — check `_actions` together |
| `app/portal/messages/_actions/*` | Knip unused; mailbox uses API routes | Medium |
| `app/portal/analytics/_components/ListenersChart.tsx` (+ `ListenersChartInner`) | Analytics hub uses `SpotifyPresencePanel` | Medium — may be intentional spare |
| `app/admin/promo-log/_components/PromoLogAdmin.tsx` | Page uses `PromoLogManager` instead | Low |
| `app/admin/accounting/_actions/persistSosAnalytics.ts` | Thin re-export; callers import `@/lib/sos/persistSosAnalyticsAction` directly | Low |
| `src/lib/mockData.ts`, `src/lib/artistsData.ts` | Static fixtures, no imports | Low |
| `src/lib/supabase/performance.ts` + `lib/supabase/performance.ts` | Re-export loop; no consumers | Low |
| `src/workers/imageProcessor.worker.ts` (+ `createImageProcessorWorker`) | Documented only; never imported in app | Low–medium |
| `src/actions/admin/users.ts`, `src/actions/epkUpload.ts` | No callers found | Medium |
| `src/lib/publicContentMaintenance.ts` | Never called — orphan maintenance entry | **High product risk** if intended to run on public reads |
| `src/lib/emojiCleanup.ts`, `src/lib/heroFeaturedEnforcement.ts` | Only used by unused `publicContentMaintenance` | Same chain |
| `src/config/effectDescriptors.ts` | No imports found | Low |
| `src/lib/api/index.ts` barrel | Nothing imports `@/lib/api` root | Low (keep for DX if desired) |

### False positives / keep

| Path | Why keep |
|------|----------|
| `app/sw.ts` | Serwist service worker entry |
| `scripts/*` | Manual / CI maintenance scripts |
| `supabase/functions/*` | Deployed separately from Next imports |
| Most `src/components/ui/*` unused exports | shadcn primitives for future composition |
| `src/lib/supabase/replica.ts` | Optional env-gated reads |
| Knip “unused exports” on DAL helpers | Used via named imports; knip under-detects |

### Follow-up recommendation

1. Decide whether `runPublicContentMaintenance` should be wired into public RSC paths (if yes → not dead).  
2. Delete high-confidence UI leftovers in a dedicated cleanup PR after CI green.  
3. Do **not** bulk-delete knip “unused files” without human review.

## Quick start

```bash
cp .env.example .env.local   # fill Supabase + R2 vars
npm ci && npm run dev
# http://localhost:3000 · /admin · /portal
```