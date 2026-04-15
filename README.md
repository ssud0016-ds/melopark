# MelOPark - Melbourne Parking Intelligence

A parking decision-support platform for drivers unfamiliar with Melbourne CBD. Built for FIT5120 Industry Experience Studio (S1 2026) by Team FlaminGO.

MelOPark joins three City of Melbourne open datasets (live bay sensors, parking restrictions, and bay geometry) into a single interface that answers: **"Can I park there, right now, legally, for how long, and at what cost?"**

## What it does

- **Live Parking Map** - real-time bay availability from ~5,000 in-ground sensors
- **Restriction Translator** — raw signage-style codes (for example, 2P Meter 8–18 Mon–Fri) are turned into plain language (for example, 2-hour parking, Mon–Fri 8 am–6 pm, pay by meter). Tap any bay for rules aligned to your arrival time. Kerbside signs are easy to misread; MeloPark decodes them so drivers do not have to.
- **Trap Detector** - warns if a clearway or tow zone kicks in during your stay
- **Accessibility Mode** (Iteration 2) - live disability bay status with extended time calculations

## Tech stack


| Layer             | Tech                                     | Why                                                                |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| Frontend          | React + Vite + Tailwind CSS + Leaflet.js | Fast dev server, mobile-first styling, free map tiles (no API key) |
| Backend           | Python FastAPI + Mangum                  | API framework with Lambda-ready adapter                            |
| Data pipeline     | Pandas (+ DuckDB in later iterations)    | Handles cleaning and transformation                                |
| Database          | PostgreSQL (AWS RDS)                     | Static data store for restrictions + bay geometry                  |
| Data architecture | Medallion (Bronze/Silver/Gold)           | Traceability from raw API to app-ready tables                      |


## Project structure

```
melopark/
├── frontend/              # React + Vite app
│   ├── src/
│   │   ├── components/    # ParkingMap, BayDetail, SearchBar, StatusBar
│   │   ├── hooks/         # useSensors, useRestrictionTranslator
│   │   ├── services/      # API client
│   │   └── App.jsx        # Main app component
│   └── package.json
│
├── backend/               # FastAPI REST API
│   ├── app/
│   │   ├── core/          # Settings + SQLAlchemy setup
│   │   ├── models/        # SQLAlchemy models (Bay, BayRestriction)
│   │   ├── routers/       # API routers (health, parking, bays)
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   ├── services/      # Business logic (evaluator, parking, restrictions)
│   │   └── tests/         # Backend tests (31 tests)
│   ├── lambda_handler.py  # AWS Lambda entrypoint (Mangum)
│   ├── requirements.txt
│   └── README.md
│
├── data/                  # Medallion architecture
│   ├── bronze/            # Raw API dumps (gitignored)
│   ├── silver/            # Cleaned CSVs (committed)
│   └── gold/              # Optional local artifacts (runtime reads from Postgres)
│
├── scripts/               # Data pipeline
│   ├── fetch_bronze.py    # Pull raw data from CoM APIs
│   ├── clean_to_silver.py # Bronze -> Silver transforms
│   ├── build_gold.py      # Silver -> Gold (Postgres via DATABASE_URL)
│   ├── migrations/        # SQL migration scripts
│   └── notebooks/         # Jupyter notebooks for exploration
│
├── backend/.env.example
├── .gitignore
└── README.md
```

## Setup (10 minutes)

### Prerequisites

- Python 3.10+ ([download](https://www.python.org/downloads/))
- Node.js 18+ ([download](https://nodejs.org/))
- Git

### 1. Clone the repo

```bash
git clone https://github.com/your-org/melopark.git
cd melopark
```

### 2. Backend setup

```bash
# Create a virtual environment
cd backend
python -m venv venv

# Activate it
# Mac/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create your .env file
cp ./.env.example .env

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```

The API should now be running at [http://localhost:8000](http://localhost:8000). Test it:

```bash
curl http://localhost:8000/health
# Should return: {"status":"ok","environment":"development"}
```

Run backend tests:

```bash
pytest
```

API docs:

- [http://localhost:8000/docs](http://localhost:8000/docs)
- [http://localhost:8000/redoc](http://localhost:8000/redoc)

### 3. Frontend setup

Open a **new terminal** (keep the backend running):

```bash
cd frontend
npm install
npm run dev
```

The app should now be running at [http://localhost:5173](http://localhost:5173). Open it in your browser and you should see a map of Melbourne CBD with coloured dots for parking bays.

### 4. Data pipeline (only needed to refresh restriction data)

The `bays` and `bay_restrictions` tables are already populated in the shared RDS instance. You do **not** need to run the pipeline to use the bay evaluation endpoints — just make sure your `backend/.env` has the team's `DATABASE_URL`.

If you need to refresh the data (e.g. after a new CoM data release):

```bash
cd scripts

# Step 1: Fetch raw data into bronze/
python fetch_bronze.py

# Step 2: Clean into silver/
python clean_to_silver.py

# Step 3: Build Gold layer + write to Postgres
python build_gold.py --write-db

# Or just build local Parquet/CSV (no DB required):
python build_gold.py --export-csv
```

## API endpoints


| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/health` | Health check |
| GET | `/api/parking` | Live sensor data (bay occupancy) |
| GET | `/api/parking/raw` | Raw upstream sensor data |
| GET | `/api/bays/{bay_id}/evaluate` | Evaluate parking legality for a single bay |
| GET | `/api/bays/evaluate-bulk` | Bulk-evaluate all bays in a bounding box |

### Bay evaluation (Epic 2)

**Single bay** — `GET /api/bays/{bay_id}/evaluate`

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| `arrival_iso` | string (ISO-8601) | now | When you plan to arrive |
| `duration_mins` | int (1–1440) | 60 | How long you plan to stay |

Returns `{ bay_id, verdict, reason, active_restriction, warning }` where `verdict` is `"yes"`, `"no"`, or `"unknown"`.

```bash
# Is bay 6754 legal next Tuesday at 10:30 for 90 minutes?
curl "http://localhost:8000/api/bays/6754/evaluate?arrival_iso=2026-04-14T10:30:00&duration_mins=90"
```

**Bulk (map recolour)** — `GET /api/bays/evaluate-bulk`

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| `bbox` | string | required | `south,west,north,east` |
| `arrival_iso` | string (ISO-8601) | now | Arrival time |
| `duration_mins` | int | 60 | Planned stay |

Returns `[{ bay_id, lat, lon, verdict }]` for all bays in the viewport.

```bash
curl "http://localhost:8000/api/bays/evaluate-bulk?bbox=-37.82,144.95,-37.80,144.97&arrival_iso=2026-04-14T10:30:00"
```

For deployment on AWS Lambda, use `backend/lambda_handler.py` as the function entrypoint.

## Data sources

All data from [City of Melbourne Open Data Portal](https://data.melbourne.vic.gov.au/) under CC BY licence.


| Dataset                                    | Type      | Use               |
| ------------------------------------------ | --------- | ----------------- |
| On-street Parking Bay Sensors              | Real-time | Live occupancy    |
| On-street Parking Bays                     | Static    | Bay geometry      |
| On-street Car Park Bay Restrictions        | Static    | Restriction rules |
| On-street Car Parking Meters with Location | Static    | Pricing + payment |


## How datasets join

```
Sensors --(marker_id)--> Parking Bays (geometry)
Sensors --(bay_id)-----> Bay Restrictions (rules)
Bays and Restrictions do NOT join directly. Go through Sensors.
```

## Team

Team FlaminGO - Monash University FIT5120 S1 2026

## Branching

- `main` - always working, deploy-ready
- `feat/feature-name` - feature branches (e.g. `feat/live-map`, `feat/restriction-parser`)
- No develop branch. Keep it simple.

When your feature is done, open a pull request to main. Get one teammate to review it.