# Deployment Guide - darkTunes Music Group

## 🚀 Vercel Deployment

### Prerequisites
1. A Vercel account (https://vercel.com)
2. Vercel CLI installed: `npm i -g vercel`

### Steps to Deploy
1. **Connect to Vercel**
   ```bash
   vercel login
   ```

2. **Link Project** (first time only)
   ```bash
   vercel link
   ```

3. **Set Environment Variables** (in Vercel Dashboard)
   - Go to your project settings
   - Navigate to Environment Variables
   - Add all variables from `.env.example`

4. **Deploy**
   ```bash
   # Preview deployment
   vercel
   
   # Production deployment
   vercel --prod
   ```

### Automatic Deployments
- Push to `main` branch for automatic production deployment
- Push to any branch for automatic preview deployment

---

## 🗄️ Supabase Setup

### 1. Create Supabase Project
1. Go to https://supabase.com
2. Create a new project
3. Note your project URL and anon key

### 2. Database Schema

> ⚠️ **The schema script is fully idempotent** — safe to run on a fresh database
> **and** on an existing one with live data. Tables are created with
> `IF NOT EXISTS`; columns with `ADD COLUMN IF NOT EXISTS`; policies and
> triggers are dropped and recreated. **Existing row data is never deleted.**

Copy the entire contents of **`supabase/reset.sql`** from the repository root
and paste it into the **Supabase SQL Editor**, then click **Run**.

The script sets up the complete schema in one shot, including all tables,
indexes, triggers, RLS policies, and default seed data.

### 3. Create First Admin User

> **Note:** The script above contains a backfill at the end that automatically
> syncs every existing `auth.users` row into `public.profiles`.
> You can run the entire script on an already-live database without losing data.

#### Step A — Register the user
Sign up through your app's login page or via the Supabase Dashboard:
**Authentication → Users → Invite user**.

#### Step B — Verify the profile row exists
```sql
SELECT id, email, role
FROM public.profiles
WHERE email = 'your-email@example.com';
```
You should see exactly one row. If not, re-run the full schema script above —
the backfill `INSERT … ON CONFLICT DO NOTHING` at the bottom will add it.

#### Step C — Promote to admin
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'your-email@example.com'
  LIMIT 1
);
```
> ⚠️ Replace `your-email@example.com` with the actual address.
> `UPDATE 0 rows` means the profile row is still missing — re-run Step B first.

---

## ☁️ Cloudflare R2 Setup

### 1. Create R2 Bucket
1. Go to Cloudflare Dashboard
2. Navigate to R2 Object Storage
3. Create a new bucket: `darktunes-assets`
4. Enable public access if needed

### 2. Get API Credentials
1. Go to R2 > Manage R2 API Tokens
2. Create API token with read/write permissions
3. Note your Account ID, Access Key ID, and Secret Access Key

### 3. Configure CORS (if needed)
```json
[
  {
    "AllowedOrigins": ["https://your-domain.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

### 4. File Uploads via Next.js Route Handler

File uploads are handled server-side at Next.js Route Handlers (`app/api/upload/route.ts` for admin uploads, plus portal routes like `app/api/portal/upload-photo/route.ts`, `app/api/portal/upload-release-cover/route.ts`, and `app/api/portal/upload-asset/route.ts`).
This eliminates CORS issues that arise from client-side direct uploads. No Supabase Edge Functions are needed for uploads.

The Route Handler:
1. Verifies the Bearer token and requires an `admin` or `editor` role
2. Parses multipart `FormData` on the server (including optional `folderId` / `artistId` metadata)
3. Computes a SHA-256 hash and short-circuits duplicate uploads to the existing asset record
4. Uploads new files to R2 using the AWS SDK v3
5. Creates the `assets` table row server-side and returns the stored asset metadata plus public CDN URL

---

## 🔐 Environment Variables

Set these in your Vercel project settings (Dashboard → Project → Settings → Environment Variables):

### Supabase (client-side — `NEXT_PUBLIC_` prefix, browser-safe)
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL *(required at build time for Next.js)*
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon/public key *(required at build time for Next.js)*

### Supabase (server-side — never exposed to browser)
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service-role key *(server-side only)*
  - Found at: Supabase Dashboard → Project Settings → API → `service_role` key
  - Used by: `app/api/upload/route.ts` (Next.js Route Handler) to verify Bearer auth tokens before accepting R2 uploads

### Cloudflare R2 (server-side — Next.js Route Handlers only)
- `CLOUDFLARE_R2_ACCOUNT_ID`: Your Cloudflare account ID
- `CLOUDFLARE_R2_ACCESS_KEY_ID`: R2 API token access key ID
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`: R2 API token secret access key
- `CLOUDFLARE_R2_BUCKET_NAME`: R2 bucket name (e.g. `darktunes-assets`)
- `CLOUDFLARE_R2_PUBLIC_URL`: R2 public CDN base URL (e.g. `https://cdn.darktunes.com`)

### External API Keys (optional — Artist Auto-Sync)
These are used by `POST /api/sync-artist` to enrich artist profiles. iTunes sync works without any key; the others require keys from the respective developer portals.
- `SPOTIFY_CLIENT_ID`: Spotify app client ID (https://developer.spotify.com/dashboard → Create App)
- `SPOTIFY_CLIENT_SECRET`: Spotify app client secret
- `DISCOGS_TOKEN`: Discogs personal access token (https://www.discogs.com/settings/developers)
- `SONGKICK_API_KEY`: Songkick API key (https://www.songkick.com/developer → Request API key)
- `BANDSINTOWN_API_KEY`: Bandsintown API key (https://www.bandsintown.com/api/app_id → Request access)

### SOS Webhook (optional — Statement of Sales PDF upload from external generator)
- `SOS_WEBHOOK_SECRET`: A random, high-entropy string shared between this app and the SOS PDF generator service. Used to authenticate server-to-server calls to `POST /api/webhooks/sos` and `POST /api/webhooks/sos/confirm`. Generate with `openssl rand -hex 32`.

### Contact Form (optional — email delivery)
- `CONTACT_EMAIL`: The email address that receives contact form submissions from `POST /api/contact`. Defaults to `info@darktunes.com` if not set. Use a monitored inbox.

### YouTube Video Sync (optional — sync channel videos)
- `YOUTUBE_API_KEY`: Google Cloud API key with YouTube Data API v3 enabled. See https://console.developers.google.com → Enable YouTube Data API v3.
- `YOUTUBE_CHANNEL_ID`: Your YouTube channel ID (starts with `UC`). Used by `POST /api/sync-youtube` to fetch and upsert the latest videos.
- `CRON_SECRET`: Optional Bearer token for Vercel cron calls to `POST /api/sync-youtube`. If set, cron requests must send `Authorization: Bearer <CRON_SECRET>`.

### Newsletter Double Opt-In (optional — confirmation email delivery)
These variables are shared between the **Supabase Edge Function** (`newsletter-confirm`) and the Next.js app. Configure `RESEND_*` both as Supabase Edge Function secrets (for DOI emails) and in Vercel when you want the contact form Route Handler to send mail.
- `RESEND_API_KEY`: API key from https://resend.com — used to send DOI confirmation emails and contact-form emails.
- `RESEND_FROM_EMAIL`: Verified sender address, e.g. `noreply@darktunes.com`. Must be a domain verified in Resend.
- `NEXT_PUBLIC_SITE_URL`: The public site URL without trailing slash (e.g. `https://darktunes.com`) — used to build the confirmation link inside the email. Also set this as a Vercel env var (with the `NEXT_PUBLIC_` prefix) so the confirmation page can be rendered.

### Newsletter — MailerLite sync (optional — marketing list)
After DOI confirmation, verified subscribers are pushed to MailerLite server-to-server via `GET /api/newsletter/verify`. Both vars are optional — omit to store subscribers in Supabase only.
- `MAILERLITE_API_KEY`: MailerLite API key from https://app.mailerlite.com/integrations/api/
- `MAILERLITE_GROUP_ID`: MailerLite group/segment ID to add subscribers to.

> ⚠️ **Important for Next.js:** `NEXT_PUBLIC_*` variables must be set in the Vercel project settings for **both** the Production and Preview environments before the first build. Next.js embeds these at compile time. Missing variables will cause the Supabase client to fall back to a placeholder and Supabase features will be disabled at runtime.

---

## 📝 Post-Deployment Checklist

- [ ] Supabase project created and configured
- [ ] Database schema applied: copy `supabase/reset.sql` into Supabase SQL Editor and run
- [ ] First admin user registered **after** schema was applied
- [ ] Admin role confirmed via `SELECT role FROM public.profiles WHERE email = '...'`
- [ ] Artist users registered and linked: `UPDATE artists SET user_id = (SELECT id FROM auth.users WHERE email = 'artist@...') WHERE slug = 'my-artist'`
- [ ] R2 bucket created and configured
- [ ] Environment variables set in Vercel
- [ ] Domain configured in Vercel
- [ ] SSL certificate active
- [ ] Test admin login
- [ ] Test artist portal login at `/portal`
- [ ] Test file upload
- [ ] Test artist "Sync Now" button (iTunes releases import)
- [ ] Check sync_logs table for any errors
- [ ] Test iTunes sync
- [ ] Verify all sections load correctly

---

## 🛠️ Maintenance

### Database Backups
Supabase provides automatic daily backups. Additional backups can be configured in project settings.

### Monitoring
- Check Vercel Analytics for performance metrics
- Monitor Supabase dashboard for database health
- Review R2 usage in Cloudflare dashboard

### Updates
```bash
# Update dependencies
npm update

# Deploy updates
vercel --prod
```
