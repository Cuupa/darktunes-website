-- Add image positioning fields to artists table.
-- These allow admins to set the focal point (x/y as percentage 0-100)
-- and zoom level (scale ≥ 1) for the artist portrait photo, so the
-- square crop always looks intentional regardless of the original framing.

ALTER TABLE artists
  ADD COLUMN IF NOT EXISTS image_position_x FLOAT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS image_position_y FLOAT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS image_scale      FLOAT DEFAULT 1;
