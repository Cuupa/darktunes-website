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
Run the following SQL in Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'editor', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artists table
CREATE TABLE public.artists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  bio TEXT,
  genres TEXT[] DEFAULT '{}',
  image_url TEXT,
  spotify_url TEXT,
  instagram_url TEXT,
  youtube_url TEXT,
  website_url TEXT,
  featured BOOLEAN DEFAULT false,
  country TEXT,
  email TEXT,
  vat_number TEXT,
  is_eu_non_german BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Releases table
CREATE TABLE public.releases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  artist_id UUID REFERENCES public.artists(id) ON DELETE CASCADE,
  artist_name TEXT NOT NULL,
  release_date DATE NOT NULL,
  cover_art TEXT,
  type TEXT NOT NULL CHECK (type IN ('album', 'ep', 'single')),
  spotify_url TEXT,
  apple_music_url TEXT,
  youtube_url TEXT,
  featured BOOLEAN DEFAULT false,
  itunes_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- News posts table
CREATE TABLE public.news_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  image_url TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Videos table
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assets table (for R2 metadata)
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Artists policies
CREATE POLICY "Artists are viewable by everyone" ON public.artists
  FOR SELECT USING (true);

CREATE POLICY "Only admins can insert artists" ON public.artists
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can update artists" ON public.artists
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "Only admins can delete artists" ON public.artists
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Releases policies (similar pattern)
CREATE POLICY "Releases are viewable by everyone" ON public.releases
  FOR SELECT USING (true);

CREATE POLICY "Only editors can manage releases" ON public.releases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

-- News policies
CREATE POLICY "News are viewable by everyone" ON public.news_posts
  FOR SELECT USING (true);

CREATE POLICY "Only editors can manage news" ON public.news_posts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

-- Videos policies
CREATE POLICY "Videos are viewable by everyone" ON public.videos
  FOR SELECT USING (true);

CREATE POLICY "Only editors can manage videos" ON public.videos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

-- Assets policies
CREATE POLICY "Assets are viewable by everyone" ON public.assets
  FOR SELECT USING (true);

CREATE POLICY "Only admins can upload assets" ON public.assets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_artists_updated_at BEFORE UPDATE ON public.artists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_releases_updated_at BEFORE UPDATE ON public.releases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_news_posts_updated_at BEFORE UPDATE ON public.news_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 3. Create First Admin User
1. Sign up through your app or Supabase dashboard
2. Run this SQL to make yourself admin:
```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

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

### 4. Supabase Edge Function for R2 Upload
Create a Supabase Edge Function to handle R2 uploads securely:

```typescript
// supabase/functions/upload-asset/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.0.0'

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${Deno.env.get('CLOUDFLARE_R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID')!,
    secretAccessKey: Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY')!,
  },
})

serve(async (req) => {
  // Authentication check
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Handle file upload
  const formData = await req.formData()
  const file = formData.get('file') as File
  
  if (!file) {
    return new Response('No file provided', { status: 400 })
  }

  const filename = `${Date.now()}-${file.name}`
  const buffer = await file.arrayBuffer()

  const command = new PutObjectCommand({
    Bucket: Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME'),
    Key: filename,
    Body: new Uint8Array(buffer),
    ContentType: file.type,
  })

  await s3Client.send(command)

  return new Response(
    JSON.stringify({
      success: true,
      url: `https://your-r2-domain.com/${filename}`,
      key: filename,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
```

---

## 🔐 Environment Variables

Set these in your Vercel project settings:

### Supabase
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon/public key

### Cloudflare R2 (server-side — Vercel Edge / Serverless Functions only)
- `CLOUDFLARE_R2_ACCOUNT_ID`: Your Cloudflare account ID
- `CLOUDFLARE_R2_ACCESS_KEY_ID`: R2 API token access key ID
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`: R2 API token secret access key
- `CLOUDFLARE_R2_BUCKET_NAME`: R2 bucket name (e.g. `darktunes-assets`)
- `CLOUDFLARE_R2_PUBLIC_URL`: R2 public CDN base URL (e.g. `https://cdn.darktunes.com`)

---

## 📝 Post-Deployment Checklist

- [ ] Supabase project created and configured
- [ ] Database schema applied
- [ ] First admin user created
- [ ] R2 bucket created and configured
- [ ] Environment variables set in Vercel
- [ ] Domain configured in Vercel
- [ ] SSL certificate active
- [ ] Test admin login
- [ ] Test file upload
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
