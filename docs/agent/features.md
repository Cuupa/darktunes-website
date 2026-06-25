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

**Key routes:** profile, analytics (11 tabs + intelligence), statements, billing, invoices, releases, tour, calendar, marketing, documents, messages, interviews, epk-builder, onboarding, help.

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

Role `journalist` or `admin`. Feature flags: `journalist.*`. Promo pool dual-gate (middleware + layout).

## Press ecosystem

SSOT: `assets` + `press_kit_items` via `pressKit.ts`. Promo audio: presigned stream only on click (`getPromoTrackStreamUrl`). Applications: `journalist_applications` + DB trigger for role assignment on approve.

## PWA

Serwist (`app/sw.ts`). SW excludes `/api/*`, `/admin/*`, `/portal/*`, `/press/*`, `/promo-pool/*`. Single `PWAInstallPrompt` in `Providers.tsx`.

## Website tracking

`PageTracker` when `darktunes_consent=accepted` → `POST /api/page-events`. Skips admin/portal/press/editor.

## Admin label analytics

`/admin/analytics` — roster health, `sos_period_summaries`, press CRM, `page_events`, `financial_audit_events`.