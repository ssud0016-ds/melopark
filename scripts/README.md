# MeloPark Data Pipeline - Scripts

**FIT5120 TE31 · Monash University · 2026**

---

## Overview

Three scripts implement the **Medallion Architecture** (Bronze -> Silver -> Gold)
for the MeloPark parking app.

```
CoM Open Data API
      │
fetch_bronze.py  --> data/bronze/   (raw, untouched)
      │
clean_to_silver.py  -->  data/silver/  (clean, joined)
      │
build_gold.py  -->  data/gold/  (enriched, API-ready)
      │
Flask API  --> React frontend
```

---

## Quick Start

```bash
# 1. Install dependencies
pip install requests pandas pyarrow tqdm

# 2. Run the full pipeline
python scripts/fetch_bronze.py
python scripts/clean_to_silver.py
python scripts/build_gold.py --export-csv
```

---

## Dataset Join Keys

```
sensors.bay_id <->  restrictions.bay_id    works
sensors.marker_id  <->  parking_bays.marker_id   works
restrictions.bay_id  <->  parking_bays   NO DIRECT JOIN
```

> **Critical:** The restrictions dataset has **no street name column**.
> `WHERE description LIKE '%Swanston%'` returns zero results.
> The correct flow is: `GPS lat/lon -> nearest sensor -> bay_id -> restrictions`

---

## Script Reference

| Script | Input | Output | Purpose |
|---|---|---|---|
| `fetch_bronze.py` | CoM API | `data/bronze/*.parquet` | Raw data ingest |
| `clean_to_silver.py` | `data/bronze/` | `data/silver/*.parquet` | Clean + join |
| `build_gold.py` | `data/silver/` | `data/gold/*.parquet` | Enrich + translate |

---

## Duration Parsing Rule

⚠ **Duration values in the CoM dataset are already in MINUTES.**

```python
# CORRECT
duration_mins = 120   # 2 hours already in minutes, keep as-is

# WRONG (old v1/v2 bug)
duration_mins = 120 * 60  # DO NOT DO THIS
```

---

## File Outputs

```
data/
├── bronze/
│   ├── sensors.parquet
│   ├── restrictions.parquet
│   ├── parking_bays.parquet
│   └── fetch_metadata.json
├── silver/
│   ├── sensors_clean.parquet
│   ├── merged.parquet
│   └── clean_metadata.json
└── gold/
    ├── gold_bay_restrictions.parquet  <- Flask API reads this
    ├── gold_bay_restrictions.csv      <- Upload to Supabase
    └── build_metadata.json
```

---

## Uploading to Supabase

```bash
# 1. Export CSV
python scripts/build_gold.py --export-csv

# 2. Go to Supabase -> Table Editor -> New Table -> gold_bay_restrictions
# 3. Import CSV -> select data/gold/gold_bay_restrictions.csv
# 4. Column types:
#    bay_id              text
#    lat, lon            float8
#    is_active_now       bool
#    duration_mins       int4
#    plain_english       text
```
