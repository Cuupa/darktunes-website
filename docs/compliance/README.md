# Compliance-Plan — SOC 2 & ISO 27001:2022

**Status:** Plan festgehalten (noch keine Gap-Analyse durchgeführt)
**Scope:** Plattform + Infrastruktur (Repo, Supabase, Cloudflare R2, Vercel, CI/CD)
**Frameworks:** SOC 2 (Trust Services Criteria) + ISO/IEC 27001:2022 (ISMS + Annex A)
**Erstellt:** 2026-09-30

> **HIPAA: N/A.** Es werden keine Gesundheitsdaten (PHI) verarbeitet; darkTunes ist ein
> Musiklabel-Webauftritt. Wird nur als „nicht anwendbar“ begründet, nicht bewertet.

---

## 1. Ziel

Eine Gap-Analyse gegen **SOC 2** und **ISO 27001:2022** erstellen, die den Ist-Zustand
der Plattform mit Repo-belegbaren Nachweisen abbildet, Lücken priorisiert und einen
umsetzbaren Phasenplan (Roadmap) liefert — als Entscheidungsgrundlage für eine spätere
Readiness/Zertifizierung.

**Kein Bestandteil dieses Plans:** die eigentliche Zertifizierungsprüfung. Eine
Zertifizierung gilt für die **Rechtseinheit + alle Systeme/Prozesse**; das Repository ist
nur ein Teil des Scopes.

---

## 2. Ist-Zustand (im Repo verifiziert)

| Bereich | Vorhanden | Lücke |
|---|---|---|
| **Access Control** | Supabase Auth, RBAC (`role_permissions`, `user_roles`, Custom Roles), Route-Gates in `proxy.ts:93`, RLS auf allen Tabellen, Service-Role nur serverseitig (`src/lib/adminAuth.ts`) | **Kein MFA** (0 Treffer im Code), keine dokumentierten Access Reviews |
| **Change Management** | PR-Flow, CI-Gates (`.github/workflows/ci.yml`), Dependabot wöchentlich (`.github/dependabot.yml`), npm audit (`.github/workflows/security.yml`), PR-Template mit Security-Doku-Checkbox, Destructive-SQL-Guard | Branch Protection/Secret Scanning/CodeQL nicht aktiv (siehe §3) |
| **Kryptografie** | TLS (Vercel/Cloudflare), AES-256-GCM für API-Credentials, R2-Presign 5 min (`SECURITY.md`) | Keine dokumentierte Key-Rotation |
| **Logging/Audit** | `app_logs` (90 d, Redaction), `admin_audit_log`, `rbac_audit_log`, `financial_audit_events`, `cron_ticks` Dead-Man's-Switch, Zammad-Fehler-Tickets | Kein zentrales Security-Alerting/SIEM, keine Tamper-Evidence |
| **Backup/DR** | Supabase Daily Backups (`DEPLOYMENT.md`), R2-Versionierung (Empfehlung), SOS-Restore-Drill (`ADMIN.md`) | Kein BCP/DR-Plan, kein Restore-Test-Nachweis (Issue #630 offen) |
| **Vulnerability Mgmt** | npm audit + Dependabot | Kein Pentest/SAST/DAST; CSP `unsafe-inline` (bekanntes Restrisiko) |
| **Privacy/DSGVO** | Consent, Export/Löschung, 10-Jahre-Retention, VIES/IBAN lokal, Datenschutz/AGB/Impressum | Kein ROPA, keine DPIA, kein TOM-Dokument |
| **Vendor** | Supabase, Cloudflare, Vercel, Upstash, Resend, MailerLite, Zammad, wsrv.nl + externe APIs | Keine dokumentierten Vendor-Reviews/DPAs |
| **Organisation** | — | Policies, Risk Assessment, Training, HR-Security, Asset-Inventar, Internal Audit, Management Review komplett offen |

**Guter Seed:** `SECURITY.md` (Known residual risks) + `docs/agent/debt-inventory.md`.

---

## 3. Zusätzliche Befunde (GitHub-Settings, per `gh api`)

| Befund | Impact |
|---|---|
| `main` hat **keinen Branch Protection / keine Rulesets** | CI läuft, blockiert aber nichts; direkte Pushes und Merges ohne Review möglich |
| **Secret Scanning disabled** | Keine automatische Erkennung geleakter Secrets |
| **Push Protection disabled** | Secrets können committed werden |
| **Dependabot Alerts disabled** | `.github/dependabot.yml` macht nur Version-Updates, keine Security-Alerts |
| Repo ist **public** | Erhöhte Angriffsfläche für den Code selbst |

---

## 4. Geplante Deliverables (bei Umsetzung)

| Datei | Inhalt |
|---|---|
| `docs/compliance/README.md` | Scope, Methodik, Status-Legende (✅/⚠️/❌/N/A), Summary-Dashboard, Top-Gaps, Roadmap, Operator-Actions, Disclaimer |
| `docs/compliance/soc2-control-matrix.md` | TSC CC1–CC9 (Security) + optionale Kategorien A/C/PI/P als „Entscheidung nötig“; pro Control: Anforderung, Ist-Zustand mit Datei-/Zeilenbeleg, Status, Gap, Maßnahme, Aufwand |
| `docs/compliance/iso27001-annex-a-matrix.md` | ISMS-Clauses 4–10 + Annex A (37 org / 8 people / 14 physical / 34 tech); People/Physical als Org-Scope markiert |
| `docs/compliance/subprocessors.md` | Vendor-Inventar (Supabase, Cloudflare R2, Vercel, Upstash, Resend, MailerLite, Zammad, wsrv.nl, externe APIs) mit Datenkategorien, Transfer, DPA-Status |
| `docs/compliance/risk-register.md` | Seed aus `SECURITY.md` Restrisiken + `debt-inventory.md` + §3-Befunde; 5×5-Scoring, Owner, Frist |

**Methodik:** Jede Status-Aussage mit Datei-/Zeilenverweis; offene Punkte klar markiert.
Status-Legende: ✅ vorhanden · ⚠️ teilweise · ❌ fehlt · N/A.

---

## 5. Roadmap (priorisiert)

### Phase 1 — Quick Wins (0–4 Wochen)
- Branch Protection + Required Status Checks auf `main`
- Secret Scanning, Push Protection, Dependabot Alerts aktivieren
- MFA für Admin/Editor erzwingen (Supabase Auth MFA)
- IR-Plan + DSGVO-Art.-33-Meldekette (72 h)
- Access-Review-Prozess
- Restore-Test dokumentieren
- Subprocessor-Liste + Risk Register

### Phase 2 — Engineering (1–3 Monate)
- Zentrales Alerting (Vercel Log Drain / Sentry o. ä.)
- Backup-Restore-Drill mit RTO/RPO
- Key-Rotation-Verfahren
- Penetrationstest
- CSP-Nonce-Migration (`unsafe-inline` beseitigen)
- Vendor-DPAs einholen

### Phase 3 — ISMS/Organisation (2–6 Monate)
- ISMS-Scope + Risk-Assessment-Methodik
- Statement of Applicability (SoA)
- 12–15 Policies (IR, Access, BCP, Vendor, …)
- Security-Training, Onboarding/Offboarding
- Asset-Inventar
- Internal Audit + Management Review

### Phase 4 — Zertifizierung
- SOC 2 Type I Readiness → Type II (Beobachtungsfenster)
- ISO 27001 Stage 1/2 Audit

---

## 6. Repo-Closeout bei Umsetzung

- `AGENTS.md`: Tabellenzeile „Compliance / Zertifizierungs-Readiness“ → `docs/compliance/README.md`
- `README.md` / External-docs-Liste: Link ergänzen
- `SECURITY.md`: Querverweis auf Compliance-Doku
- Kein `CHANGELOG.md`/`QA_CHECKLIST.md` (kein Produktverhalten geändert)
- Kein `npm run ci` nötig (docs-only)

---

## 7. Nicht im Scope (als Gaps dokumentiert, aber org-level)

HR-Security, Security-Training, Physical Security, Verträge/DPAs, Management Review,
interne Audits sowie die eigentlichen Zertifizierungsaudits. Diese erfordern Workshops
und Interviews und lassen sich nicht aus dem Repository ableiten.

---

## 8. Offene Punkte / Annahmen

- Branch-Protection-Status wurde per `gh api` geprüft (Stand 2026-09-30); Änderungen an
  den GitHub-Settings sind Operator-Actions und nicht Teil des Repos.
- SOC 2 Trust-Service-Kategorien außer „Security“ (Availability, Confidentiality,
  Processing Integrity, Privacy) sind noch nicht entschieden.
- Dieses Dokument ist eine Planung, keine Rechts- oder Zertifizierungsberatung.
