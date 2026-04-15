# Search Index Setup Guide

This guide adds real address/street/landmark search without changing live parking refresh behavior.

## 1) Fetch bronze datasets

```bash
python scripts/fetch_bronze.py --dataset addresses
```

If you need a full refresh:

```bash
python scripts/fetch_bronze.py
```

## 2) Build silver outputs

```bash
python scripts/clean_to_silver.py --verbose
```

This now produces:

- `data/silver/addresses_clean.parquet`
- `data/silver/streets_clean.parquet`

## 3) Build gold outputs

```bash
python scripts/build_gold.py --export-csv --verbose
```

Or only search outputs:

```bash
python scripts/build_gold.py --search-only --export-csv --verbose
```

This now produces:

- `data/gold/search_index.parquet`
- `data/gold/search_index.csv`
- `data/gold/search_index_metadata.json`

## 4) Create table in database

Run SQL from:

- `docs/search_index_schema.sql`

## 5) Load data into DB

Import:

- `data/gold/search_index.csv`

into table:

- `search_index`

## 6) Backend + frontend

- Backend now exposes `GET /api/search?q=...&limit=...`
- Frontend search bar calls this API with debounce and falls back to local landmarks if DB is not ready.

## Important

Live parking data remains unchanged:

- `/api/parking` still comes from live CoM sensor/restriction refresh services.
