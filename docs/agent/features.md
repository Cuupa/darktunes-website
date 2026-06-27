# Portal, Press & Product Features

## Artist Portal (`/portal/*`)

| Topic | Rule |
|-------|------|
| Auth | Edge middleware + Supabase session; membership via `hasPortalArtistMembership()` (`artist_members`), not JWT metadata |
| Tenancy | `resolvePortalArtist(db, userId, artistId)` with `?artistId=`; `getArtistByUserId()` deprecated for portal |
| IoC | RSC pages fetch data; `"use client"` leaves receive props — no direct `fetch`/Supabase in leaves |
| Nav | `portal_feature_flags` gates modules; Settings always visible; onboarding when profile incomplete |
| Presigned URLs | `src/lib/portal/presignedUrl.ts` — 5 min GET, 15 min PUT; wired in `statements/_actions/presignedUrl.ts` |
| Bearer auth | Portal route handlers use `authenticatePortalBearer()` from `src/lib/portal/bearerAuth.ts` |

**Billing & invoices:** `artist_billing_profiles` at `/portal/billing`. `isBillingProfileComplete()` required before PDF generation. `InlineBillingProfileStep` gates: `/portal/invoices` (`InvoiceForm`, `FreeInvoiceGenerator`), `/portal/analytics` (Earnings), `/portal/statements` (quick invoice). SOS-linked flow: `/portal/invoices?statement={id}` → `artist_invoice_number` + `sales_statements.status = 'invoiced'`.

**Key routes:** profile, analytics (11 tabs + intelligence), statements, billing, invoices, releases, tour (events), **tour-planner** (TRACK production), calendar, marketing, documents, messages, interviews, epk-builder, onboarding, help.

### TRACK Tour Planner (`/portal/tour-planner`)

Enterprise tour production module (ported from artist-tour-planner). **Distinct from** `/portal/events` + `concerts` — public events and Bandsintown/Songkick sync stay there; tour planner is optional production planning with a bridge via `tour_stops.concert_id`.

| Topic | Rule |
|-------|------|
| Flag | `artist.tour_planner` in `portal_feature_flags` (seed `supabase/reset.sql`) |
| Route | `/portal/tour-planner?artistId=` — gated in RSC + sidebar |
| Data | Parallel tables: `tours`, `tour_stops`, `tour_contacts`, `tour_tasks`, `tour_crew_members`, `tour_merch_items`, `tour_merch_settlements` |
| DAL | `src/lib/api/tours.ts`, `tourStops.ts`, `tourContacts.ts`, `tourTasks.ts`, `tourCrew.ts`, `tourMerch.ts`, `tourConcertBridge.ts` |
| APIs | `app/api/portal/tour-planner/*` — bearer + `?artistId=` via `authenticatePortalBearerWithArtist` |
| Offline | Dexie sync queue (`src/lib/tour-planner/offline/`) + TanStack Query persist (tour-planner keys only) |
| PDF | Day sheet, show settlement, merch settlement — `src/lib/tour-planner/pdf.ts` (jsPDF) |
| Admin | Read-only `/admin/tour-planner` — `AdminTourPlannerView`, RLS `"*: admin all"` |

**Concert bridge:** import event → stop (`stops/import-concert`); publish stop → concert (`publishConcert`); sync linked concert (`syncConcert` when `concertId` set). Logic in `tourConcertBridge.ts`.

**Portal API surface (representative):**

| Path | Methods |
|------|---------|
| `tours`, `tours/[id]` | GET/POST, PATCH/DELETE (archive, duplicate) |
| `stops`, `stops/[id]` | GET/POST (create, reorder), PATCH/DELETE |
| `stops/import-concert` | POST |
| `tasks`, `tasks/[id]` | GET/POST, PATCH/DELETE |
| `contacts`, `contacts/[id]` | GET/POST, PATCH/DELETE |
| `crew`, `crew/[id]` | GET/POST, PATCH/DELETE |
| `merch`, `merch/settlement` | GET/POST |
| `merch/[id]` | PATCH/DELETE |
| `route`, `geocode`, `import` | POST |

**Stop production UI:** per-diems, rooming, travel manifest, full finance deal fields, hotel geocode, merch count-in/out/sold per variant with comps, drag-reorder stops.

**Tour settings UI:** route settings (vehicle, planning mode, geocoding provider, fuel/tolls), budget JSONB line items + total, tech document PDF upload (`/api/portal/tour-planner/tech-documents/upload`).

## Settlement & Abrechnungszentrale

Enterprise SOS + invoice lifecycle. Workflow helpers: `src/lib/sos/statementWorkflow.ts`, UI: `statementWorkflowUi.tsx`.

**Admin accounting (`/admin/accounting`):** Default **Guided** mode (`AccountingGuidedWizard` in `AccountingPanel.tsx`) — Upload → Review → Publish (settlement). **Advanced** mode: all sub-tabs. Guided stepper is controlled (`activeStep` / `onActiveStepChange`); Review CTA opens settle step and scrolls to `#accounting-guided-settle-panel`.

| Module | Role |
|--------|------|
| `SettlementCenterPanel` | Shell: overview, toolbar, register, dialogs |
| `useSettlementCenter` | Register fetch, bulk actions, correction/payment/lock/archive |
| `SettlementWorkflowOverview` | Workflow + ledger mismatch warning (`settlementReconciliation`) |
| `SettlementActionToolbar`, `SettlementRegisterTable`, `SettlementCenterDialogs` | Actions + table + modals |
| `settlementCenterModel.ts` | Types, labels, `registerToMasterRow` |
| `useSosWorkspaceSync` | Period-keyed rules workspace auto-save |
| `settlementReconciliation.ts` | Pure ledger invariant checks |
| `trackAssignmentSplits.ts` | Multi-owner revenue splits in `data-processor.ts` |
| `runPersistSosAnalytics.ts` | Client wrapper for portal analytics persist |

**7-step workflow:** review → draft upload → label approve → artist viewed → invoice created → received → paid.

**Tables:** `settlement_periods`, `artist_settlement_ledger`, `period_carry_forwards`, `financial_audit_events`; extended `sales_statements`, `artist_invoices`.

**DAL:** `settlementPeriods.ts`, `settlementLedger.ts`, `settlementRegister.ts`, `financialAudit.ts`; extended `salesStatements.ts`, `artistInvoices.ts`.

**Admin APIs:** `GET /api/admin/settlements/register`, periods lock/archive, bulk-approve, correction, invoice received/payment.

**Bronze CSV:** Never browser `fetch()` to presigned R2. Upload ≤45 MB via `…/upload`; 45–200 MB via `…/multipart/*`; download via `…/download`. Limits: `bronzeUploadLimits.ts`. UI: `ImportBatchesPanel`.

## Document vault

`/portal/documents` — PDF/DOCX to `artist-documents/{artistId}/`. Upload `POST /api/portal/documents/upload` (20 MB). Download via presigned Server Action. Component: `DocumentVault.tsx`.

## Video submission

`/portal/releases/videos/new` → `videos` row `is_visible=false`. Admin: `/admin/video-submissions`. APIs: `POST /api/portal/submit-video`, `PATCH /api/admin/video-submissions/[id]`.

## Portal access gate

`PortalAccessGate` for unlinked roles. Onboarding: `shouldRedirectToOnboarding()` → `/portal/onboarding?artistId=…`.

## EPK

- **Legacy:** browser print via `printEpkDocument.ts` / `EPKPreview` (`forceMount` on EPK tab)
- **Canvas builder:** `/portal/epk-builder` — JSON v2 on `artist_epks.epk_document`; server PDF `POST /api/portal/epk/export`; share links `/epk/share/[token]`; analytics `epk_download_events`

API surface: document, versions, fonts, share, templates, press export. DAL: `epkDocument.ts`, `epkFonts.ts`, `epkShareLinks.ts`.

## Journalist dashboard (`/press/dashboard/*`)

Role `journalist` or `admin`. Feature flags: `journalist.*` and `press.*`. Promo pool dual-gate (middleware + layout).

## Feature flags (admin `/admin/features`)

Two independent systems — do not conflate with **Settings → Roles** (`role_permissions`), which gates CRUD inside modules.

| System | Storage | Scope | Helpers |
|--------|---------|-------|---------|
| **Global toggles** | `site_settings.key = 'feature_toggles'` (JSON) | Whole roles / site areas | `src/lib/featureToggles.ts` — `getFeatureToggles()`, `parseFeatureTogglesJson()` |
| **Portal module flags** | `portal_feature_flags` table | Per sidebar module for `artist` / `journalist` | `getFeatureFlagsForRole()` in `src/lib/api/featureFlags.ts`; UI meta in `src/lib/portalFeatureFlagMeta.ts` |

**Global toggles**

| Key | Effect |
|-----|--------|
| `promoPool` | `/promo-pool`, `/press/dashboard/promo-pool`, journalist promo nav; SSOT via `isPromoPoolEnabled()` in `src/lib/pressAccess.ts` |
| `editorTools` | `/editor/*` and editor CMS paths; enforced in `middleware.ts` |

**Portal flags (seed in `supabase/reset.sql`)**

- **Artist:** `artist.analytics`, `artist.statements`, `artist.marketing`, `artist.invoices`, `artist.documents`, `artist.calendar`, `artist.epk_builder`, `artist.tour_planner`
- **Journalist:** `journalist.accreditation`, `press.applications`, `press.zip_download`, `press.audio_preview`, `press.contact`

**Press helpers** (`src/lib/pressAccess.ts`): `isPressApplicationsEnabled()`, `isPressZipDownloadEnabled()`, `isPressAudioPreviewEnabled()` — each reads `portal_feature_flags` for role `journalist`.

**Deprecated:** `press.promo_tracks` — replaced by global `promoPool`; hidden in admin UI (`DEPRECATED_PORTAL_FEATURE_FLAGS`), not seeded.

**Route-guard pattern:** RSC page (or server action) loads flags/toggles via DAL, returns disabled message or `notFound()`; nav hides links when flag is off. Examples: `app/portal/calendar/page.tsx` (`artist.calendar`), `app/press/apply/page.tsx` (`press.applications`), `app/press/dashboard/promo-pool/page.tsx` (global `promoPool`).

Admin UI: `AdminFeaturesWrapper` — section 1 `FeatureTogglesManager` (global, saved with site settings), section 2 `FeatureFlagsManager` (portal rows, immediate PATCH).

## Press ecosystem

SSOT: `assets` + `press_kit_items` via `pressKit.ts`. Promo audio: presigned stream only on click (`getPromoTrackStreamUrl`). Applications: `journalist_applications` + DB trigger for role assignment on approve.

## PWA

Serwist (`app/sw.ts`). SW excludes `/api/*`, `/admin/*`, `/portal/*`, `/press/*`, `/promo-pool/*`. Single `PWAInstallPrompt` in `Providers.tsx`.

## Website tracking

`PageTracker` when `darktunes_consent=accepted` → `POST /api/page-events`. Skips admin/portal/press/editor.

## Admin label analytics

`/admin/analytics` — roster health, `sos_period_summaries`, press CRM, `page_events`, `financial_audit_events`.