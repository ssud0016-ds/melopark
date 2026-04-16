-- MeloPark search_index schema
-- Use this in Supabase/RDS before loading data/gold/search_index.csv

CREATE TABLE IF NOT EXISTS search_index (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    sub TEXT,
    category TEXT NOT NULL CHECK (category IN ('landmark', 'street', 'address')),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_name_lower ON search_index (lower(name));
CREATE INDEX IF NOT EXISTS idx_search_sub_lower ON search_index (lower(sub));
CREATE INDEX IF NOT EXISTS idx_search_category ON search_index (category);
