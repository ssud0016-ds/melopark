# Search Index Setup Guide

This guide adds real address/street/landmark search without changing live parking refresh behavior.

## 1) Fetch bronze datasets

Fetches sensors, restrictions, parking bays, and **street-addresses** (needed for search):

```bash
python scripts/fetch_bronze.py
```

To refresh only addresses (faster):

```bash
python scripts/fetch_bronze.py --dataset addresses
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

With `DATABASE_URL` set in `backend/.env` (same as the FastAPI app):

```bash
python scripts/load_search_index.py
```

This applies `docs/search_index_schema.sql`, truncates `search_index`, and loads `data/gold/search_index.csv`.

Alternatively, import `data/gold/search_index.csv` manually into table `search_index` (e.g. Supabase SQL editor or `psql \\copy`).

## 6) Backend + frontend

- Backend exposes `GET /api/search?q=...&limit=...`
- Frontend search bar calls this API with debounce and falls back to local landmarks if the API fails.

## 7) Verify search

With the API running (`uvicorn` per `backend/README.md`):

```bash
curl -s "http://127.0.0.1:8000/api/search?q=swan&limit=5" | python -m json.tool
```

You should see JSON rows with `name`, `sub`, `category`, `lat`, `lng`. Queries must be at least 2 characters.

## Important

Live parking data remains unchanged:

- `/api/parking` still comes from live CoM sensor/restriction refresh services.
