# Build from the repository root (not the backend/ folder only), e.g.:
#   docker build -f backend/Dockerfile .
# DigitalOcean: set the app "Source directory" to the repo root and Dockerfile path
# to backend/Dockerfile so `data/gold` and `data/silver` are in the build context.
FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/certs ./certs

# With app code under /app/app, services resolve ROOT to "/" and read /data/gold, /data/silver.
RUN mkdir -p /data/gold /data/silver
COPY data/gold /data/gold
COPY data/silver /data/silver
COPY data/sensor_to_segment_lookup.csv /data/sensor_to_segment_lookup.csv

ENV PYTHONUNBUFFERED=1
EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
