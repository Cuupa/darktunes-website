# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **SOS webhook removed**: `POST /api/webhooks/sos` and `POST /api/webhooks/sos/confirm` deleted. Statement-of-Sales PDFs are now uploaded via a direct `uploadStatement` Server Action (`app/portal/statements/_actions/uploadStatement.ts`) authenticated by the admin's Supabase session. `SOS_WEBHOOK_SECRET` env var is no longer needed.
- `isValidArtistId` and `isValidPeriod` moved from the deleted `src/lib/sos/sosWebhook.ts` into the new `src/lib/sos/validation.ts`.

## [1.1.0] — 2026-06-06

### Added
- **Statement of Sales Email Notifications**: Artists receive an automatic email via Resend when a new statement is uploaded. Email includes period, optional amount, and link to `/portal/statements` for secure download.
- **Admin Statements Manager**: New read-only tab in Admin dashboard to monitor all uploaded statements across all artists.

### Changed
- `sendStatementNotification()` is called after every successful `sales_statements` insert (non-blocking).
