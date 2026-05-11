-- Add bandsintown_id to artists (the artist identifier/name used in Bandsintown API)
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS bandsintown_id TEXT;

-- Add bandsintown_id to concerts (unique event ID from Bandsintown)
ALTER TABLE public.concerts ADD COLUMN IF NOT EXISTS bandsintown_id TEXT UNIQUE;
