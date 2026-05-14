# darkTunes Admin Panel & Artist Portal

## Admin Panel

Access the admin panel at `/admin`. Authentication is enforced at the edge by **Next.js Middleware** (`middleware.ts`) — unauthenticated requests are redirected to `/admin/login` before any page content is served.

## Artist Portal

Access the artist portal at `/portal`. Artists sign in with their own Supabase Auth account. The same Edge Middleware enforces auth: unauthenticated requests are redirected to `/portal/login`.

Portal features:
- **EPK Profile Editor** (`/portal/profile`) — artists edit bio, genres, social links, press quote, and upload a profile photo. The photo upload goes server-side via `/api/portal/upload-photo` (no CORS issues).
- **EPK PDF Export** (`/portal/profile`) — artists can generate a print-ready EPK using the "Download EPK as PDF" action (browser print-to-PDF flow).
- **Streaming Analytics** (`/portal/analytics`) — artists view their monthly platform stream counts in a Recharts bar chart. Admins manage the underlying `streaming_stats` data.
- **Royalty Statements** (`/portal/statements`) — artists download their royalty PDFs via short-lived (5 min) presigned R2 URLs. The Server Action generates the URL; the raw R2 object key and credentials never reach the browser.
- **Tour Manager** (`/portal/tour`) — artists can create/delete their own concert entries (announced/confirmed/cancelled).
- **Release Submission** (`/portal/releases/new`) — artists can submit new releases for admin review (`is_visible=false` until approved), including optional cover upload via `/api/portal/upload-release-cover`.
- **Marketing Assets** (`/portal/marketing`) — artists can download assigned assets via short-lived presigned URLs and upload/delete their own assets via `/api/portal/upload-asset`.
- **Label Inbox** (`/portal/messages`) — artists can read label messages, mark them as read, and send replies (stored in `artist_replies`).
- **Account Settings** (`/portal/settings`) — artists can update their password and switch locale (EN/DE).
- **Feature-flag gating** — portal modules are controlled by `portal_feature_flags` (artist.* keys) and hidden/blocked when disabled.

To link an artist to a portal user, use the **Users** tab in the Admin Dashboard:
1. Open `/admin` and go to the **Users** tab (admin-only).
2. Find the user row and click the **Link Band** icon (🔗).
3. Select the artist from the dropdown and confirm.

Alternatively, you can still run SQL directly:
```sql
UPDATE public.artists
SET user_id = (SELECT id FROM auth.users WHERE email = 'artist@email.com')
WHERE slug = 'artist-slug';
```

## Admin Features

- **User Authentication**: Secure login/logout via Supabase Auth + `@supabase/ssr` cookie-based sessions
- **Role-Based Access Control**: Admin and Editor roles with different permissions
- **User Management** *(admin-only)*: View all registered users, change their roles (admin / editor / journalist / user), ban/unban accounts, delete users, and link/unlink artists — no raw SQL required. Accessible via the **Users** tab (only visible to admins).
- **Artists Management**: Create, read, update, and delete artist profiles. The artist form now includes five additional URL fields: **Facebook**, **Twitter/X**, **TikTok**, **Bandcamp**, and a **Shop URL** (Darkmerch or Shopify link). These appear as clickable icons in the public artist cards and in artist modals.
- **Releases Management**: Manage music releases with iTunes API integration
- **News Management**: Create and publish news posts and announcements
- **Feature Flags (admin-only)**: New **Feature Flags** tab to toggle Artist + Journalist dashboard modules (`portal_feature_flags` table, API: `PATCH /api/admin/feature-flags/[id]`)
- **Messages (admin-only)**: New **Messages** tab to send label messages to artists (`label_messages`)
- **Accreditations (admin-only)**: New **Accreditations** tab to review and approve/reject journalist accreditation requests (`accreditation_requests`)
- **Videos Management**: Manage music videos and YouTube content
- **Assets Management**: Upload and organize media files via Cloudflare R2 (server-side upload)
- **Site Settings**: Configure all global site content (social links, SEO metadata, hero text, etc.) without code changes
- **Visual Effects**: Configure the three dark-industrial overlay effects (noise/grain opacity, CRT scanlines toggle, vignette intensity) from the **Visual Effects** tab — changes go live immediately via ISR cache revalidation.
- **Legal / DSGVO (New)**: Configure Impressum (§ 5 TMG fields: company name, legal form, VAT-ID, etc.) and Datenschutzerklärung content from the admin panel's "Legal / DSGVO" tab. Also configure the R2 placeholder image shown to users before they consent to external media.

## Setup

### 1. Configure Supabase

Follow the instructions in `DEPLOYMENT.md` to:
- Create a Supabase project
- Set up the database schema
- Configure environment variables

### 2. Create First Admin User

After signing up through the app at `/admin/login`, run this SQL in Supabase:

```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

### 3. Access Admin Panel

Navigate to `/admin`. If not authenticated, you will be redirected to `/admin/login` by the Edge Middleware. Log in, and the middleware will redirect you back to `/admin`.

## Usage

### Artists
- Add new artists with their bio, genres, social links, and **external API IDs** (Spotify, Discogs, Songkick)
- Update artist information
- Mark artists as featured
- **"Sync Now"** button per artist — triggers `POST /api/sync-artist` to fetch the latest iTunes releases, cache cover art in Cloudflare R2, and upsert releases to Supabase. The button shows a spinner while syncing; success/error is reported via toast notification.
- Skeleton loading states — the artist table shows animated placeholder rows (avatar + text skeletons) while data is fetching, preventing layout shift.
- View "Last Synced" date for each artist
- Delete artists (cascades to their releases)

### Releases
- Manually add releases or sync from iTunes API
- Edit release metadata (title, date, type, cover art)
- Add streaming links (Spotify, Apple Music, YouTube)
- Feature releases on the homepage

### News
- Create news posts with markdown support
- Add featured images
- Schedule or publish immediately
- Edit or delete existing posts
- Toggle **Press-only** visibility (`is_press_only`) for journalist dashboard content

### Journalist Dashboard
- Login at `/press/login`
- Protected dashboard at `/press/dashboard/*` for roles `journalist` and `admin`
- Feature-flagged modules: Promo Pool, Press Kit, Press Releases, Accreditation, Download History
- Downloads are tracked in `journalist_downloads`

### Videos
- Add music videos by YouTube ID
- Organize video gallery
- Set thumbnails and metadata
- Trigger `POST /api/sync-youtube` to import the latest label-channel videos; synced rows are auto-linked to visible artists via title matching (`videos.artist_id`) and default to `is_visible=true`, so public sections and artist profile pages render them immediately.

### Assets
- Upload images and media files to Cloudflare R2 (upload goes via the secure Next.js Route Handler `app/api/upload/route.ts` — credentials never exposed to browser)
- Browse uploaded assets
- Copy public URLs for use in content
- Delete unused assets

### Site Settings
Manage all global site content from the **Settings** tab — no code changes needed:
- **Global**: Label name, tagline, contact email, privacy policy URL, terms URL
- **Social Links**: Instagram, YouTube, Spotify profile URLs (leave blank to hide the icon)
- **Homepage**: Hero badge text, hero description, Spotify playlist URI, and multi-playlist entries (label + URI) for instant tab-based player swaps on the homepage
- **SEO / Meta**: Page title, meta description, Open Graph title and description
- **Visual Effects**: Noise/grain opacity (0–1 slider), CRT scanlines toggle, vignette intensity (0–1 slider)

Changes are saved to the `site_settings` Supabase table. The Admin CMS immediately calls `POST /api/revalidate-site-settings` to bust the Next.js ISR cache so the public site reflects the update within seconds.

## Permissions

- **Admin**: Full access to all features, user management
- **Editor**: Can manage content (artists, releases, news, videos, assets)
- **User**: Read-only access (default for new signups)

## Development

To run the admin panel locally with Supabase:

1. Copy `.env.example` to `.env.local`
2. Fill in your Supabase and R2 credentials
3. Run `npm run dev` — Next.js dev server starts on `http://localhost:3000`
4. Navigate to `http://localhost:3000/admin`

- **Artist Auto-Sync**: A "Sync Now" button appears next to each artist. Clicking it calls `POST /api/sync-artist`, which fetches releases from the iTunes API, downloads cover art and stores it in Cloudflare R2, and upserts releases to Supabase. All sync operations are logged in the `sync_logs` table for audit purposes.
- **Skeleton Loading**: The Artists table shows skeleton placeholder rows (avatar circle + text lines) while data is loading, avoiding cumulative layout shift (CLS).

## Integration Notes

The admin panel is an integrated part of the Next.js App Router — it lives at the `/admin` route segment. All data is stored in Supabase and shared between the public site and admin panel.

Admin pages are always dynamically rendered (`force-dynamic`) so auth cookies are always checked server-side on every request.
