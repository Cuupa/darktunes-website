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

optional_env() {
  local var_name="$1"
  local description="$2"
  if [ -z "${!var_name:-}" ]; then
    echo "  ℹ  OPTIONAL: ${var_name} not set  (${description})"
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
optional_env "SPOTIFY_CLIENT_ID"     "Spotify app client ID (sync: releases by Spotify Artist ID)"
optional_env "SPOTIFY_CLIENT_SECRET" "Spotify app client secret"
optional_env "DISCOGS_TOKEN"         "Discogs personal access token (sync: releases by Discogs Artist ID)"
optional_env "SONGKICK_API_KEY"      "Songkick API key (sync: tour dates by Songkick Artist ID)"
optional_env "BANDSINTOWN_API_KEY"   "Bandsintown API key (sync: tour dates by Bandsintown artist name/id)"
echo ""

echo "  — Newsletter / email delivery (optional) —"
optional_env "RESEND_API_KEY"      "Resend API key (used by contact mail + newsletter DOI flow)"
optional_env "RESEND_FROM_EMAIL"   "Verified sender email for Resend-powered emails"
optional_env "LABEL_NOTIFICATION_EMAIL" "Label inbox for artist submission notifications (release/video)"
optional_env "NEXT_PUBLIC_SITE_URL" "Public site URL used to build confirmation links (e.g. https://darktunes.com)"
echo ""

echo "  — Newsletter (optional — MailerLite sync after DOI confirmation) —"
optional_env "MAILERLITE_API_KEY"  "MailerLite API key (newsletter subscriber sync after verification)"
optional_env "MAILERLITE_GROUP_ID" "MailerLite group ID for verified newsletter subscribers"
echo ""

echo "  — Cache revalidation webhook (optional but recommended) —"
optional_env "REVALIDATE_SECRET" "Shared secret for POST /api/revalidate Supabase webhooks"
echo ""

echo "  — Contact form (optional — email delivery via Resend) —"
optional_env "CONTACT_EMAIL" "Email recipient for POST /api/contact form submissions"
echo ""

echo "  — YouTube video sync (optional — YouTube Data API v3) —"
optional_env "YOUTUBE_API_KEY"    "Google API key with YouTube Data API v3 (used by POST /api/sync-youtube)"
optional_env "YOUTUBE_CHANNEL_ID" "YouTube channel ID (starts with UC)"
optional_env "CRON_SECRET"        "Shared secret for /api/sync, /api/sync-youtube, /api/sync-api and trigger-sync Edge Function"
optional_env "SUPABASE_REPLICA_URL"      "Supabase read-replica connection URL (Pro plan — for analytics queries)"
optional_env "SUPABASE_REPLICA_ANON_KEY" "Anon key for the read replica"
echo ""

if [ "$MISSING" -gt 0 ]; then
  echo "  ⚠  ${MISSING} required build/runtime variable(s) not set."
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
