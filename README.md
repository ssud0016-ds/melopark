# MelOPark - Melbourne Parking Intelligence

A parking decision-support platform for drivers unfamiliar with Melbourne CBD. Built for FIT5120 Industry Experience Studio (S1 2026) by Team FlaminGO.

MelOPark joins three City of Melbourne open datasets (live bay sensors, parking restrictions, and bay geometry) into a single interface that answers: **"Can I park there, right now, legally, for how long, and at what cost?"**

## What it does

- **Live Parking Map** - real-time bay availability from ~5,000 in-ground sensors
- **Restriction Translator** - tap any bay for plain English parking rules personalised to your arrival time
- **Trap Detector** - warns if a clearway or tow zone kicks in during your stay
- **Accessibility Mode** (Iteration 2) - live disability bay status with extended time calculations

## Tech stack


| Layer             | Tech                                     | Why                                                                |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| Frontend          | React + Vite + Tailwind CSS + Leaflet.js | Fast dev server, mobile-first styling, free map tiles (no API key) |
| Backend           | Python FastAPI + Mangum                  | API framework with Lambda-ready adapter                            |
| Data pipeline     | Pandas (+ DuckDB in later iterations)    | Handles cleaning and transformation                                |
| Database          | PostgreSQL (Supabase) (Gold layer)       | Static data store for restrictions + geometry/meter data           |
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
│   │   ├── routers/       # API routers (currently health)
│   │   └── tests/         # Backend tests
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

### 4. Data pipeline (optional, to populate Gold tables in Postgres)

The app works without this step because sensors are fetched live from the City of Melbourne (CoM) APIs. If you want to run the full medallion pipeline and store static data in Postgres:

Make sure `backend/.env` has a valid `DATABASE_URL` before running this.

```bash
cd scripts

# Step 1: Fetch raw data into bronze/
python fetch_bronze.py

# Step 2: Clean into silver/
python clean_to_silver.py

# Step 3: Build Gold tables in Postgres
python build_gold.py
```

## API endpoints (scaffold)


| Method | Endpoint  | Description  |
| ------ | --------- | ------------ |
| GET    | `/health` | Health check |


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