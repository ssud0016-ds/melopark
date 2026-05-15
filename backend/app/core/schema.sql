CREATE TABLE IF NOT EXISTS sensor_raw (
    marker_id    VARCHAR,
    status       VARCHAR,
    lat          DOUBLE,
    lon          DOUBLE,
    ingested_at  TIMESTAMP DEFAULT current_timestamp
);
CREATE TABLE IF NOT EXISTS bay_occupancy (
    bay_id       VARCHAR PRIMARY KEY,
    marker_id    VARCHAR,
    occ_pct      INTEGER,
    walk_m       INTEGER,
    hour_of_day  INTEGER,
    updated_at   TIMESTAMP DEFAULT current_timestamp
);
CREATE TABLE IF NOT EXISTS carbon_score (
    bay_id       VARCHAR PRIMARY KEY,
    saved_g      INTEGER,
    pct_avoided  INTEGER,
    score        INTEGER,
    scored_at    TIMESTAMP DEFAULT current_timestamp
);
