-- Migration 006: Add street_name column to bays table
--
-- The parking_bays bronze dataset provides a RoadSegmentDescription per
-- KerbsideID. Persisting it on the bays table lets the API return a street
-- name for every bay, not just the ~2k with live sensor feeds.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE bays ADD COLUMN IF NOT EXISTS street_name TEXT;
