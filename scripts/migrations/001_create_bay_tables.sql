-- Epic 2: Create bays + bay_restrictions tables
-- Run against your RDS/Postgres instance:
--   psql "$DATABASE_URL" -f scripts/migrations/001_create_bay_tables.sql
--
-- Or if using build_gold.py --write-db, these tables are created automatically.
-- This script is provided as a manual alternative / reference.

BEGIN;

-- ── bays ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bays (
    bay_id              TEXT PRIMARY KEY,
    lat                 DOUBLE PRECISION,
    lon                 DOUBLE PRECISION,
    has_restriction_data BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── bay_restrictions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bay_restrictions (
    id                  SERIAL PRIMARY KEY,
    bay_id              TEXT NOT NULL REFERENCES bays(bay_id),
    slot_num            INTEGER NOT NULL,
    typedesc            TEXT,
    fromday             INTEGER NOT NULL,
    today               INTEGER NOT NULL,
    starttime           TIME NOT NULL,
    endtime             TIME NOT NULL,
    duration_mins       INTEGER,
    disabilityext_mins  INTEGER,
    exemption           TEXT,
    plain_english       TEXT NOT NULL,
    is_strict           BOOLEAN NOT NULL DEFAULT FALSE,
    rule_category       TEXT NOT NULL DEFAULT 'other'
);

CREATE INDEX IF NOT EXISTS idx_bay_restrictions_bay_id
    ON bay_restrictions(bay_id);

CREATE INDEX IF NOT EXISTS idx_bays_lat_lon
    ON bays(lat, lon);

COMMIT;
