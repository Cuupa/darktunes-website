# Security Policy — darkTunes Music Group

## Supported Versions

| Version | Supported |
|---|---|
| `main` branch | ✅ |
| Older branches | ❌ |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues by emailing the maintainers directly (see repository contacts) or via [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability).

Include as much detail as possible:

- Type of vulnerability (e.g. XSS, SQL injection, broken auth)
- Affected file(s) and line numbers
- Steps to reproduce
- Potential impact

We will respond within 72 hours and coordinate a fix before any public disclosure.

## Security Practices

- **Row-Level Security (RLS)** is enabled on all Supabase tables. Only authenticated users with the `admin` or `editor` role can write data.
- **Environment variables** containing secrets (`SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, etc.) are never prefixed with `VITE_` and are therefore never exposed to the browser.
- **Supabase anon key** is intentionally public (client-side) but is scoped by RLS policies.
- **File uploads** go through the Vercel Serverless Function `api/upload.ts` — R2 credentials are never accessible from the browser. The function validates the caller's `Authorization: Bearer <token>` via `supabase.auth.getUser()` using the service-role key before accepting any upload.
- **Service-role key** (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS — it is used exclusively in `api/upload.ts` for token verification and must never be exposed to the client.
- Dependencies are kept up to date. Run `npm audit` before adding new packages.
