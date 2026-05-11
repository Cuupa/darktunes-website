-- Migration: add founded_year column to artists table
-- Applied: 2026-05-11

ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS founded_year SMALLINT;
