# darkTunes Admin Panel

Access the admin panel at `/admin`. Authentication is enforced at the edge by **Next.js Middleware** (`middleware.ts`) — unauthenticated requests are redirected to `/admin/login` before any page content is served.

## Features

- **User Authentication**: Secure login/logout via Supabase Auth + `@supabase/ssr` cookie-based sessions
- **Role-Based Access Control**: Admin and Editor roles with different permissions
- **Artists Management**: Create, read, update, and delete artist profiles
- **Releases Management**: Manage music releases with iTunes API integration
- **News Management**: Create and publish news posts and announcements
- **Videos Management**: Manage music videos and YouTube content
- **Assets Management**: Upload and organize media files via Cloudflare R2 (server-side upload)

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

### Videos
- Add music videos by YouTube ID
- Organize video gallery
- Set thumbnails and metadata

### Assets
- Upload images and media files to Cloudflare R2 (upload goes via the secure Next.js Route Handler `app/api/upload/route.ts` — credentials never exposed to browser)
- Browse uploaded assets
- Copy public URLs for use in content
- Delete unused assets

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
