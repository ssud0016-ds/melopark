# MelOPark - Melbourne Parking Intelligence

MelOPark is a parking decision-support platform for Melbourne CBD drivers, built for FIT5120 Industry Experience Studio (S1 2026) by Team FlaminGO.

It combines live occupancy data with restriction-aware legality checks to answer:
**Can I park here now, for my planned stay, and what rules apply?**

## What it does

- Live map of on-street bay occupancy from City of Melbourne sensor feeds
- Rule-aware bay evaluation at a selected arrival time and duration
- Trap detection for stricter rules starting during a planned stay
- Bulk map recoloring for "show all bays at this planned time"
- Search suggestions for landmarks/streets/addresses

## Architecture at a glance

MelOPark uses a hybrid architecture:

1. **Live path (real-time occupancy):**
   - Frontend calls `GET /api/parking`
   - Backend fetches and caches live City of Melbourne sensor records
2. **Rules path (legality and search):**
   - Data pipeline builds curated tables (`bays`, `bay_restrictions`, `search_index`)
   - Backend evaluates legality from PostgreSQL and serves search results

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React + Vite + Tailwind CSS + Leaflet |
| Backend API | FastAPI + SQLAlchemy + uvicorn |
| Backend hosting | DigitalOcean App Platform (Docker, Sydney region) |
| Frontend hosting | Vercel |
| Data pipeline | Python + Pandas (+ optional DuckDB in scripts) |
| Database | PostgreSQL (AWS RDS, `ap-southeast-2`) |
| Data design | Medallion-style Bronze -> Silver -> Gold pipeline |

### Deployment topology

```
            ┌────────────────┐         ┌────────────────────────┐
 Browser ──▶│ Vercel (CDN)   │──fetch─▶│ DO App Platform (SYD)  │
            │  React SPA     │  HTTPS  │  FastAPI + uvicorn     │
            └────────────────┘         │  Docker (python:3.12)  │
                                       │  In-memory caches:     │
                                       │   - sensor (5 min)     │
                                       │   - restriction (1 hr) │
                                       │   - street name (10 m) │
                                       └───────────┬────────────┘
                                                   │ SSL verify-full
                                                   ▼
                                       ┌────────────────────────┐
                                       │ AWS RDS PostgreSQL     │
                                       │  bays, bay_restrictions│
                                       │  search_index          │
                                       └────────────────────────┘
                                                   ▲
                                                   │
                                       ┌───────────┴────────────┐
                                       │ Data pipeline (local)  │
                                       │ Bronze → Silver → Gold │
                                       └────────────────────────┘

 City of Melbourne Open Data API ─── pulled live by backend (sensors,
 restrictions) and offline by pipeline (geometry, addresses, rules).
```

The backend runs as a single long-lived container so background refresh
loops keep upstream caches warm across requests, eliminating the
cold-start 503 cascades that occurred under the previous AWS Lambda
deployment.

## Repository structure

```text
melopark/
├── frontend/                    # React app (map UI, bay details, planner, search)
│   ├── src/components/
│   ├── src/hooks/
│   ├── src/services/apiBays.js  # Frontend API client
│   └── .env.example
├── backend/
│   ├── app/main.py              # FastAPI app + CORS + router mounting
│   ├── app/routers/             # health, db_test, parking, bays, search
│   ├── app/services/            # live fetch/cache + restriction evaluator logic
│   ├── app/models/              # SQLAlchemy models for bays + restrictions
│   ├── app/tests/               # evaluator and API health tests
│   ├── certs/global-bundle.pem  # AWS RDS public CA bundle (SSL verify-full)
│   ├── Dockerfile               # python:3.12-slim image for App Platform
│   ├── .dockerignore
│   └── .env.example
├── scripts/
│   ├── fetch_bronze.py
│   ├── clean_to_silver.py
│   ├── build_gold.py
│   ├── load_search_index.py
│   ├── diagnostics/             # API/data quality diagnostics
│   └── migrations/
├── docs/
│   ├── search_index_schema.sql
│   └── search_index_setup.md
└── README.md
```

## Backend architecture

### App startup and routing

- `backend/app/main.py` creates the FastAPI app, configures CORS, and mounts routers.
- The lifespan hook starts two background refresh tasks on container boot:
  - `start_background_refresh()` — refreshes the live sensor cache every 5 minutes
  - `start_background_restrictions_refresh()` — refreshes the restriction lookup cache every hour
- Caches are in-process (per container). The Basic App Platform plan runs a
  single container, so cache state is consistent without an external store.
  If the deployment is scaled to multiple containers, add a shared cache
  (e.g. managed Redis) before enabling autoscale.

### API routers

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Health status and environment |
| GET | `/db-test` | DB connectivity smoke check |
| GET | `/api/parking` | Frontend-ready live parking bay payload |
| GET | `/api/parking/raw` | Raw upstream parking feed passthrough |
| GET | `/api/bays/{bay_id}/evaluate` | Evaluate one bay for arrival/duration |
| GET | `/api/bays/evaluate-bulk` | Evaluate bays in viewport (`bbox`) |
| GET | `/api/search` | Search landmarks/addresses/streets |

Interactive docs:
- [http://localhost:8000/docs](http://localhost:8000/docs)
- [http://localhost:8000/redoc](http://localhost:8000/redoc)

### Service layer responsibilities

- `parking_service.py`: fetches live sensor data, normalizes response shape, and applies cache strategy
- `restriction_lookup_service.py`: builds cached `deviceid -> bay_type` lookup from restrictions API
- `restriction_evaluator.py`: core legality engine used by single and bulk evaluation endpoints, including:
  - day/time window checks
  - strictest-rule precedence when multiple restrictions are active
  - timed-duration overstay checks
  - warnings when stricter rules begin during planned stay

### Data models and DB access

- `backend/app/models/bay.py` defines `Bay` and `BayRestriction` ORM models
- `backend/app/core/db.py` configures SQLAlchemy engine/session via `DATABASE_URL`
- Search uses the `search_index` table (schema in `docs/search_index_schema.sql`)

## Frontend architecture

### UI composition

- `frontend/src/App.jsx` is the app shell and page switcher (`map`, `about`, `attribution`, `terms`)
- `MapPage` orchestrates map interactions, selected bay state, planner state, and bulk map evaluation mode
- `ParkingMap` renders bay markers and emits selection/bounds events
- `BayDetailSheet` evaluates a selected bay for "now" or a planned arrival/time
- `SearchBar` calls `/api/search` and supports landmark fallback data

### Frontend data flow

- Live map load: `useBays` -> `fetchParkingBays()` -> `GET /api/parking`
- Selected bay panel: `fetchBayEvaluation()` -> `GET /api/bays/{bay_id}/evaluate`
- Planned-time map recolor: `fetchEvaluateBulk()` -> `GET /api/bays/evaluate-bulk`

Planner time contract:
- Planner date/time input is Melbourne-local by product contract.
- Naive `arrival_iso` (no offset) is interpreted by backend as Melbourne time.
- Offset-aware `arrival_iso` (e.g. `+10:00`, `+11:00`) is respected as exact instant.

## Data pipeline architecture

Pipeline scripts are in `scripts/` and follow Bronze -> Silver -> Gold stages:

1. `fetch_bronze.py`  
   Pull raw City of Melbourne datasets into Bronze artifacts.
2. `clean_to_silver.py`  
   Clean/normalize IDs and reshape restrictions into Silver datasets.
3. `build_gold.py`  
   Build app-ready outputs and optionally write `bays` + `bay_restrictions` tables.
4. `load_search_index.py`  
   Apply search schema and load `search_index` into PostgreSQL.

Supporting docs:
- `docs/search_index_setup.md`
- `docs/search_index_schema.sql`

## Configuration

### Backend (`backend/.env`)

Required:
- `DATABASE_URL`
- `ENVIRONMENT`

Common optional:
- `CORS_ORIGINS` (comma-separated origins, or `*`)
- `CORS_ORIGIN_REGEX` (regex matched against the `Origin` header; useful for
  Vercel preview deploys where the subdomain hash changes per build,
  e.g. `https://(.*\.)?vercel\.app`)

### Frontend (`frontend/.env`)

Optional:
- `VITE_API_URL`  
  Leave empty in local dev to use Vite `/api` proxy to `http://127.0.0.1:8000`.

## Local setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- Git

### 1) Start backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Check:

```bash
curl http://localhost:8000/health
```

### 2) Start frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at [http://localhost:5173](http://localhost:5173).

### 3) Run tests

```bash
cd backend
pytest
```

## Deployment

### Backend (DigitalOcean App Platform)

The backend is shipped as a Docker image built from `backend/Dockerfile`:

- Base image: `python:3.12-slim`
- Build context: the `backend/` directory (set as the App Platform source dir)
- Run command: `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}`
- Health check path: `/health`
- Region: Sydney (`syd1`) — co-located with the AWS RDS instance in
  `ap-southeast-2` to keep DB latency low
- Plan: Basic ($5/mo, 1 container, no autoscale)

Required env vars on App Platform:

| Key | Notes |
| --- | --- |
| `DATABASE_URL` | Full Postgres URL with `sslmode=verify-full&sslrootcert=./certs/global-bundle.pem` (encrypt) |
| `ENVIRONMENT` | `production` (hides `/docs` and `/redoc`) |
| `CORS_ORIGINS` | Comma-separated list of exact origins, e.g. the Vercel production URL |
| `CORS_ORIGIN_REGEX` | Regex for dynamic origins, e.g. `https://(.*\.)?vercel\.app` |

The AWS RDS public CA bundle (`backend/certs/global-bundle.pem`) is committed
to the repo so the Docker build context can include it. The bundle contains
only public root CAs — no secrets — and is published by AWS at
`https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`.

Auto-deploy on push is enabled for the migration branch; pushes to the
configured branch trigger a fresh App Platform build.

### Frontend (Vercel)

- Build: `vite build` (default Vercel React preset)
- Env var: `VITE_API_URL` set to the App Platform URL
  (e.g. `https://melopark-app-hcdwq.ondigitalocean.app`) for both
  Preview and Production scopes
- Security headers (CSP, HSTS, X-Frame-Options, etc.) are set in
  `frontend/vercel.json`. The CSP `connect-src` directive must list the
  backend host explicitly.

## Data refresh workflow (when datasets change)

```bash
cd scripts
python fetch_bronze.py
python clean_to_silver.py
python build_gold.py --write-db
python load_search_index.py
```

If you only need local file exports:

```bash
python build_gold.py --export-csv
```

## Data sources

Primary data comes from the [City of Melbourne Open Data Portal](https://data.melbourne.vic.gov.au/) (CC BY).

Used datasets include:
- On-street Parking Bay Sensors (real-time occupancy)
- On-street Parking Bays (geometry/reference)
- On-street Car Park Bay Restrictions (legal rules)
- Address/street sources used for search index building

## Team

Team FlaminGO - Monash University FIT5120 S1 2026