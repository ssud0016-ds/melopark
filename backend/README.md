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

Health endpoint:
- `GET http://localhost:8000/health`

Interactive API docs:
- `http://localhost:8000/docs`
- `http://localhost:8000/redoc`

## Run tests

```bash
pytest
```

## Environment variables

Create `backend/.env` from `backend/.env.example` and set:
- `DATABASE_URL`
- `ENVIRONMENT`
- Optional: `CORS_ORIGINS`

## AWS Lambda

`lambda_handler.py` is the AWS Lambda entrypoint and wraps the FastAPI app using Mangum.

