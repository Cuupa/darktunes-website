#!/usr/bin/env bash
# =============================================================================
# scripts/vercel-install.sh
# Vercel install hook for darkTunes Music Group.
#
# Vercel runs this script instead of plain `npm install` (see vercel.json).
# It installs npm dependencies and validates that all required environment
# variables are present in the Vercel project settings.
#
# Required env vars are documented in DEPLOYMENT.md.
# Missing variables produce a WARNING but do NOT abort the build, because
# some variables (e.g. Cloudflare R2 keys) may only be needed at runtime.
# =============================================================================
set -euo pipefail

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║    darkTunes Music Group — Vercel Install Script     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# -----------------------------------------------------------------------------
# 1. Install Node.js dependencies
# npm ci uses package-lock.json exactly → faster, reproducible CI installs.
# -----------------------------------------------------------------------------
echo "▶  Installing npm dependencies (npm ci)..."
npm ci
echo "✔  Dependencies installed."
echo ""

# -----------------------------------------------------------------------------
# 2. Environment variable validation
# Warns about missing variables. Does NOT fail the build so that preview
# deployments without all secrets still compile.
# -----------------------------------------------------------------------------
MISSING=0

require_env() {
  local var_name="$1"
  local description="$2"
  if [ -z "${!var_name:-}" ]; then
    echo "  ⚠  MISSING: ${var_name}  (${description})"
    MISSING=$((MISSING + 1))
  else
    echo "  ✔  ${var_name}"
  fi
}

echo "▶  Checking environment variables..."
echo ""
echo "  — Supabase (client-side, prefixed NEXT_PUBLIC_) —"
require_env "NEXT_PUBLIC_SUPABASE_URL"       "Supabase project URL"
require_env "NEXT_PUBLIC_SUPABASE_ANON_KEY"  "Supabase anonymous public key"
echo ""
echo "  — Supabase (server-side, NOT prefixed) —"
require_env "SUPABASE_SERVICE_ROLE_KEY" "Supabase service-role key (used by /api/upload to verify auth tokens)"
echo ""
echo "  — Cloudflare R2 (server-side, NOT prefixed) —"
require_env "CLOUDFLARE_R2_ACCOUNT_ID"        "Cloudflare account ID"
require_env "CLOUDFLARE_R2_ACCESS_KEY_ID"     "R2 API access key ID"
require_env "CLOUDFLARE_R2_SECRET_ACCESS_KEY" "R2 API secret access key"
require_env "CLOUDFLARE_R2_BUCKET_NAME"       "R2 bucket name"
require_env "CLOUDFLARE_R2_PUBLIC_URL"        "R2 public CDN base URL (e.g. https://cdn.darktunes.com)"
echo ""

echo "  — External API keys (optional — artist auto-sync) —"
require_env "SPOTIFY_CLIENT_ID"     "Spotify app client ID (sync: releases by Spotify Artist ID)"
require_env "SPOTIFY_CLIENT_SECRET" "Spotify app client secret"
require_env "DISCOGS_TOKEN"         "Discogs personal access token (sync: releases by Discogs Artist ID)"
require_env "SONGKICK_API_KEY"      "Songkick API key (sync: tour dates by Songkick Artist ID)"
echo ""

echo "  — Newsletter (optional — DOI email delivery via Resend Edge Function) —"
require_env "RESEND_API_KEY"     "Resend API key (set as Supabase Edge Function secret, not Vercel)"
require_env "NEXT_PUBLIC_SITE_URL" "Public site URL used to build confirmation links (e.g. https://darktunes.com)"
echo ""

echo "  — Newsletter (optional — MailerLite sync after DOI confirmation) —"
require_env "MAILERLITE_API_KEY" "MailerLite API key (newsletter subscriber sync after verification)"
require_env "MAILERLITE_GROUP_ID" "MailerLite group ID for verified newsletter subscribers"
echo ""

echo "  — Cache revalidation webhook (optional but recommended) —"
require_env "REVALIDATE_SECRET" "Shared secret for POST /api/revalidate Supabase webhooks"
echo ""

echo "  — SOS webhook (optional — required for Statement of Sales PDF upload) —"
require_env "SOS_WEBHOOK_SECRET" "API key for POST /api/webhooks/sos from the SOS PDF generator"
echo ""

if [ "$MISSING" -gt 0 ]; then
  echo "  ⚠  ${MISSING} variable(s) not set."
  echo "  → Configure them in Vercel Dashboard → Project → Settings → Environment Variables."
  echo "  → See DEPLOYMENT.md for a full description of each variable."
else
  echo "  ✔  All required environment variables are present."
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║    Install complete. Proceeding to build…            ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

