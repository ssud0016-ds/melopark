# MelOPark Backend (FastAPI)

FastAPI scaffold for MelOPark, prepared for AWS Lambda deployment via Mangum and PostgreSQL via SQLAlchemy.

## Install dependencies

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

## Local development

Run the API locally:

```bash
uvicorn app.main:app --reload --port 8000
```

## Endpoints

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/health` | Health check |
| GET | `/api/parking` | Live sensor data (bay occupancy) |
| GET | `/api/parking/raw` | Raw upstream sensor data |
| GET | `/api/bays/{bay_id}/evaluate` | Evaluate parking legality for a single bay |
| GET | `/api/bays/evaluate-bulk` | Bulk-evaluate all bays in a bounding box |

Interactive API docs:
- `http://localhost:8000/docs`
- `http://localhost:8000/redoc`

## Run tests

```bash
pytest
# 31 tests: health + restriction evaluator (day matching, verdicts, warnings, edge cases)
```

## Environment variables

Create `backend/.env` from `backend/.env.example` and set:
- `DATABASE_URL`
- `ENVIRONMENT`
- Optional: `CORS_ORIGINS`

## AWS Lambda

`lambda_handler.py` is the AWS Lambda entrypoint and wraps the FastAPI app using Mangum.

