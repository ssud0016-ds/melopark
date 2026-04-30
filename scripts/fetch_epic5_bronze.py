"""
fetch_epic5_bronze.py - Pulls raw inputs for Epic 5 (parking pressure map):

  1. Victorian traffic signal volume data (monthly ZIP, V00..V95 15-min bins per SCATS detector)
  2. Victorian traffic signal site geo (SCATS site number -> lat/lon/municipality)
  3. Eventfinda /api/v2/events near Melbourne CBD (requires Basic Auth)

Outputs (data/bronze/):
    epic5_traffic_signal_volume_raw.parquet
    epic5_scats_sites_raw.parquet
    epic5_events_raw.parquet
    epic5_fetch_metadata.json

Auth:
    EVENTFINDA_USER and EVENTFINDA_PASS environment variables. If missing,
    the events fetch is skipped and an empty parquet is written so downstream
    silver/gold builds still run.

Usage:
    python scripts/fetch_epic5_bronze.py
    python scripts/fetch_epic5_bronze.py --traffic-months 3
    python scripts/fetch_epic5_bronze.py --skip events
"""

from __future__ import annotations

import argparse
import io
import json
import logging
import os
import time
import zipfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pandas as pd
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("fetch_epic5_bronze")

ROOT = Path(__file__).resolve().parent.parent
BRONZE_DIR = ROOT / "data" / "bronze"

CKAN_BASE = "https://discover.data.vic.gov.au/api/3/action"
TRAFFIC_VOLUME_PACKAGE = "traffic-signal-volume-data"
SIGNALS_GEO_URL = (
    "https://opendata.transport.vic.gov.au/dataset/"
    "923af458-363d-469f-bc5e-84746a80b9a2/resource/"
    "d094415e-7b73-414a-88f5-6a3a6b5a903d/download/victorian_traffic_signals.csv"
)

EVENTFINDA_API = "https://api.eventfinda.com.au/v2/events.json"
EVENTFINDA_LOCATION_ID = 20   # Melbourne broad region (matches reference pipeline)
EVENTFINDA_ROWS_PER_PAGE = 20
EVENTFINDA_RATE_LIMIT_SEC = 1  # Eventfinda enforces max 1 req/sec
CBD_LAT = -37.8136
CBD_LON = 144.9631
CBD_RADIUS_KM = 3.0

# SCATS sites filter — Melbourne CBD bounding box (loose)
CBD_BBOX = {
    "lat_min": -37.83,
    "lat_max": -37.79,
    "lon_min": 144.94,
    "lon_max": 144.99,
}


# ─────────────────────────────────────────────────────────────────────────────
# 1) SCATS site geo
# ─────────────────────────────────────────────────────────────────────────────
def fetch_scats_sites() -> pd.DataFrame:
    """Pull statewide SCATS signal site list and filter to CBD bbox."""
    log.info("Fetching SCATS site geo …")
    resp = requests.get(SIGNALS_GEO_URL, timeout=120)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text))
    df.columns = [c.strip().lstrip("﻿") for c in df.columns]
    df = df.rename(columns={
        "SITE_NO": "site_no",
        "SITE_NAME": "site_name",
        "TYPE": "site_type",
        "MUNICIPALITY": "municipality",
        "LATITUDE": "lat",
        "LONGITUDE": "lon",
    })
    cbd = df[
        (df["lat"] >= CBD_BBOX["lat_min"]) & (df["lat"] <= CBD_BBOX["lat_max"]) &
        (df["lon"] >= CBD_BBOX["lon_min"]) & (df["lon"] <= CBD_BBOX["lon_max"])
    ].copy()
    log.info("  %d total sites, %d in CBD bbox", len(df), len(cbd))
    return cbd


# ─────────────────────────────────────────────────────────────────────────────
# 2) Traffic signal volume — monthly ZIPs
# ─────────────────────────────────────────────────────────────────────────────
def list_traffic_volume_resources() -> list[dict]:
    """Return monthly ZIP resources newest-first via CKAN package_show."""
    url = f"{CKAN_BASE}/package_show?id={TRAFFIC_VOLUME_PACKAGE}"
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    pkg = resp.json().get("result", {})
    monthly = [
        r for r in pkg.get("resources", [])
        if (r.get("format") or "").upper() == "ZIP"
        and "traffic_signal_volume_data" in (r.get("url") or "").lower()
        and r.get("url", "").endswith(".zip")
    ]
    monthly.sort(key=lambda r: r.get("created", ""), reverse=True)
    return monthly


def fetch_traffic_volume(months: int = 1, scats_filter: set[int] | None = None) -> pd.DataFrame:
    """Download `months` most recent ZIPs, concat CSVs, filter to CBD SCATS sites."""
    log.info("Fetching traffic signal volume (last %d month(s)) …", months)
    resources = list_traffic_volume_resources()[:months]
    frames: list[pd.DataFrame] = []

    for res in resources:
        url = res["url"]
        label = res.get("name", url.rsplit("/", 1)[-1])
        log.info("  %s", label)
        z_resp = requests.get(url, timeout=300)
        z_resp.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(z_resp.content)) as zf:
            for name in zf.namelist():
                if not name.lower().endswith(".csv"):
                    continue
                with zf.open(name) as fh:
                    df = pd.read_csv(fh)
                if scats_filter is not None and "NB_SCATS_SITE" in df.columns:
                    df = df[df["NB_SCATS_SITE"].isin(scats_filter)]
                df["source_resource"] = label
                frames.append(df)
                log.info("    %s -> %d rows (post-filter)", name, len(df))

    if not frames:
        return pd.DataFrame()
    out = pd.concat(frames, ignore_index=True)
    log.info("  Combined traffic volume rows: %d", len(out))
    return out


# ─────────────────────────────────────────────────────────────────────────────
# 3) Eventfinda events
# ─────────────────────────────────────────────────────────────────────────────
def _is_virtual(event: dict) -> bool:
    """Detect virtual/online events to exclude from spatial pressure."""
    virtual_terms = {"virtual", "online", "virtual location", "online virtual"}
    loc = event.get("location") or {}
    fields = [
        loc.get("name") or "",
        event.get("address") or "",
        event.get("location_summary") or "",
    ]
    combined = " ".join(fields).lower()
    return any(term in combined for term in virtual_terms)


def fetch_eventfinda_events(days_ahead: int = 30) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Pull events near Melbourne CBD. Returns (events_df, sessions_df).

    Uses location_id=20 (Melbourne region) + CBD bbox post-filter,
    matching the proven pattern from the team's reference pipeline.
    Skips gracefully if creds missing.
    """
    user = os.environ.get("EVENTFINDA_USER", "melopark")
    pwd = os.environ.get("EVENTFINDA_PASS", "jz45zbv6m7rc")

    log.info("Fetching Eventfinda events (next %d days, location_id=%d) …",
             days_ahead, EVENTFINDA_LOCATION_ID)
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=days_ahead)

    all_events: list[dict] = []
    offset = 0
    total: int | None = None

    while True:
        params = {
            "rows": EVENTFINDA_ROWS_PER_PAGE,
            "offset": offset,
            "location_id": EVENTFINDA_LOCATION_ID,
            "start_date": now.strftime("%Y-%m-%d"),
            "end_date": end.strftime("%Y-%m-%d"),
            "order": "date",
        }
        resp = requests.get(
            EVENTFINDA_API, params=params,
            auth=(user, pwd), timeout=60,
        )
        if resp.status_code == 401:
            log.error("  Eventfinda 401 unauthorized — check credentials.")
            break
        resp.raise_for_status()

        data = resp.json()
        events = data.get("events") or []

        if total is None:
            total = int(data.get("@attributes", {}).get("count", 0))
            log.info("  Total on API: %d events", total)

        if not events:
            break

        all_events.extend(events)
        offset += EVENTFINDA_ROWS_PER_PAGE

        if offset % 100 == 0 or offset >= (total or 0):
            log.info("  fetched %d / %d …", min(offset, total or 0), total or 0)

        if offset >= (total or 0):
            break

        time.sleep(EVENTFINDA_RATE_LIMIT_SEC)

    log.info("  Raw events fetched: %d", len(all_events))

    # Post-filter: drop virtual + outside CBD bbox
    event_rows: list[dict] = []
    session_rows: list[dict] = []
    virtual_count = 0
    outside_count = 0
    no_coords_count = 0

    for e in all_events:
        if _is_virtual(e):
            virtual_count += 1
            continue

        point = e.get("point") or {}
        lat = point.get("lat")
        lng = point.get("lng")

        if lat is None or lng is None:
            no_coords_count += 1
            continue

        lat, lng = float(lat), float(lng)
        if not (CBD_BBOX["lat_min"] <= lat <= CBD_BBOX["lat_max"] and
                CBD_BBOX["lon_min"] <= lng <= CBD_BBOX["lon_max"]):
            outside_count += 1
            continue

        loc = e.get("location") or {}
        cat = e.get("category") or {}
        category_name = (
            (cat.get("parent") or {}).get("name")
            or cat.get("name")
        )

        event_id = e.get("id")
        event_rows.append({
            "event_id": event_id,
            "event_name": e.get("name"),
            "event_url": e.get("url"),
            "description": e.get("description"),
            "datetime_summary": e.get("datetime_summary"),
            "start_datetime": e.get("datetime_start"),
            "end_datetime": e.get("datetime_end"),
            "lat": lat,
            "lon": lng,
            "location_summary": e.get("location_summary"),
            "address": e.get("address"),
            "venue_name": (loc.get("name") or "").strip(),
            "category_name": category_name,
            "is_free": bool(e.get("is_free")),
            "is_cancelled": bool(e.get("is_cancelled")),
        })

        # Extract per-session dates for temporal pressure matching
        raw_sessions = (e.get("sessions") or {}).get("sessions") or []
        for s in raw_sessions:
            session_rows.append({
                "event_id": event_id,
                "session_start": s.get("datetime_start"),
                "session_end": s.get("datetime_end"),
            })

    log.info("  CBD events: %d | virtual: %d | outside bbox: %d | no coords: %d",
             len(event_rows), virtual_count, outside_count, no_coords_count)

    df_events = pd.DataFrame(event_rows)
    df_sessions = pd.DataFrame(session_rows)

    return df_events, df_sessions


# ─────────────────────────────────────────────────────────────────────────────
# Driver
# ─────────────────────────────────────────────────────────────────────────────
def main(traffic_months: int, skip: set[str]) -> None:
    BRONZE_DIR.mkdir(parents=True, exist_ok=True)
    fetched_at = datetime.now(timezone.utc)
    log.info("Epic 5 bronze fetch starting at %s", fetched_at.isoformat())

    meta: dict = {
        "pipeline_stage": "bronze",
        "epic": "epic5",
        "fetched_at": fetched_at.isoformat(),
        "datasets": {},
        "sources": {
            "traffic_volume": (
                "https://discover.data.vic.gov.au/dataset/traffic-signal-volume-data/"
                "resource/91eaae07-5b49-4ce5-93c8-e922c4a688b3"
            ),
            "scats_sites": SIGNALS_GEO_URL,
            "events": "https://api.eventfinda.com.au/v2/events.json",
        },
        "notes": [
            "Traffic volume CSVs use SCATS site number NB_SCATS_SITE; join to scats_sites.site_no.",
            "Volume bins V00..V95 = 15-min counts across the day for the given QT_INTERVAL_COUNT date.",
            "Events fetch requires EVENTFINDA_USER / EVENTFINDA_PASS env vars.",
            "Traffic data is historical only — Epic 5 'pressure now' is a profile-based prediction.",
        ],
    }

    cbd_sites: set[int] | None = None

    if "scats" not in skip:
        try:
            df_sites = fetch_scats_sites()
            out = BRONZE_DIR / "epic5_scats_sites_raw.parquet"
            df_sites.to_parquet(out, index=False, engine="pyarrow")
            cbd_sites = set(df_sites["site_no"].dropna().astype(int).tolist())
            meta["datasets"]["scats_sites"] = {
                "output_file": str(out), "rows": len(df_sites),
                "columns": list(df_sites.columns),
            }
            log.info("  Saved %d sites -> %s", len(df_sites), out.name)
        except Exception as e:
            log.error("  ERROR fetching SCATS sites: %s", e)

    if "traffic" not in skip:
        try:
            df_traffic = fetch_traffic_volume(months=traffic_months, scats_filter=cbd_sites)
            out = BRONZE_DIR / "epic5_traffic_signal_volume_raw.parquet"
            df_traffic.to_parquet(out, index=False, engine="pyarrow")
            meta["datasets"]["traffic_volume"] = {
                "output_file": str(out), "rows": len(df_traffic),
                "columns": list(df_traffic.columns),
                "months_pulled": traffic_months,
            }
            log.info("  Saved %d traffic rows -> %s", len(df_traffic), out.name)
        except Exception as e:
            log.error("  ERROR fetching traffic volume: %s", e)

    if "events" not in skip:
        try:
            df_events, df_sessions = fetch_eventfinda_events()

            out_events = BRONZE_DIR / "epic5_events_raw.parquet"
            df_events.to_parquet(out_events, index=False, engine="pyarrow")
            meta["datasets"]["events"] = {
                "output_file": str(out_events), "rows": len(df_events),
                "columns": list(df_events.columns) if len(df_events) else [],
            }
            log.info("  Saved %d events -> %s", len(df_events), out_events.name)

            out_sessions = BRONZE_DIR / "epic5_event_sessions_raw.parquet"
            df_sessions.to_parquet(out_sessions, index=False, engine="pyarrow")
            meta["datasets"]["event_sessions"] = {
                "output_file": str(out_sessions), "rows": len(df_sessions),
                "columns": list(df_sessions.columns) if len(df_sessions) else [],
            }
            log.info("  Saved %d sessions -> %s", len(df_sessions), out_sessions.name)
        except Exception as e:
            log.error("  ERROR fetching events: %s", e)

    meta_path = BRONZE_DIR / "epic5_fetch_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    log.info("Epic 5 bronze fetch complete. Metadata -> %s", meta_path.name)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch Epic 5 bronze inputs.")
    parser.add_argument("--traffic-months", type=int, default=1,
                        help="How many recent monthly traffic ZIPs to download (default 1).")
    parser.add_argument("--skip", nargs="*", default=[],
                        choices=["scats", "traffic", "events"],
                        help="Skip one or more sub-fetches.")
    args = parser.parse_args()
    main(traffic_months=args.traffic_months, skip=set(args.skip))
