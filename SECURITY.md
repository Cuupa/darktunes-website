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
- **Environment variables** containing secrets (`SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, etc.) are never prefixed with `NEXT_PUBLIC_` and are therefore never exposed to the browser. Client-safe variables use the `NEXT_PUBLIC_` prefix.
- **Supabase anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) is intentionally public (client-side) but is scoped by RLS policies.
- **File uploads** go through the Next.js Route Handler `app/api/upload/route.ts` — R2 credentials are never accessible from the browser. The handler validates the caller's `Authorization: Bearer <token>` via `supabase.auth.getUser()` using the service-role key before accepting any upload.
- **Service-role key** (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS — it is used exclusively in `app/api/upload/route.ts` for token verification and must never be exposed to the client.
- **Admin route protection** is enforced by Next.js Edge Middleware (`middleware.ts`). Auth checks happen server-side at the edge before any page HTML is rendered, preventing client-side flicker attacks.
- Dependencies are kept up to date. Run `npm audit` before adding new packages.
