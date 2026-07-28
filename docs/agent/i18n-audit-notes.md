# i18n audit notes (2026-07-28)

## Structural bug fixed

Admin/editor route bundles previously omitted the `portal` namespace while reusing portal UI (`EventManager`). next-intl then rendered raw keys such as `portal.tour_heading`.

**Fix:** `ROUTE_BUNDLES['/admin']` and `'/editor'` include `portal` (`src/i18n/loadMessages.ts`).

## Safe cleanup

- Removed unused `TourList` / `TourManager` / tour server actions under `/portal/tour` (legacy redirect to Events remains).
- **Tour Production** (`tour-planner`) and **Events** features kept.

## Key parity

- `portal` en/de: matched key counts (audit script).
- `admin` en/de flat keys: matched.

## Remaining hardcoding (not all fixed this pass)

High volume of English toasts/labels still in admin managers, e.g.:

- `AdminSidebarNav` / `AdminDashboard` sign-out toasts
- `ArtistsManager` invite fallback toasts
- `MaintenanceManager`, `ColorThemeManager`, file-explorer “No artists found”
- Portal: `PortalAccessGate`, `DocumentVault` isolated English strings

Prefer fixing when touching those modules. Shared components that call `useTranslations('portal')` must only render on routes that load the portal bundle (or accept a namespace prop).

## Tooling

```bash
node scripts/audit-i18n-keys.mjs
```

Scans static `t('…')` / `portalKey('…')` against en portal/admin dictionaries.
