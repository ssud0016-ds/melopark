"""Router tests for bay evaluation and Bug 3 ``arrival_iso`` parsing.

Covers: timezone-aware ISO, naive = Australia/Melbourne wall clock, Z/UTC,
and matching behaviour for ``evaluate`` vs ``evaluate-bulk``.
"""

from fastapi.testclient import TestClient

from app.core.db import get_db
from app.main import app
from app.routers import bays as bays_router


def _dummy_evaluation_payload(bay_id: str) -> dict:
    return {
        "bay_id": bay_id,
        "verdict": "unknown",
        "reason": "test",
        "active_restriction": None,
        "warning": None,
        "data_source": "unknown",
        "data_coverage": "none",
    }


def test_evaluate_bay_defaults_to_melbourne_now() -> None:
    captured = {}

    def fake_evaluate_bay_at(bay_id, arrival, duration_mins, db):
        captured["arrival"] = arrival
        captured["duration_mins"] = duration_mins
        return _dummy_evaluation_payload(bay_id)

    app.dependency_overrides[get_db] = lambda: object()
    try:
        original = bays_router.evaluate_bay_at
        bays_router.evaluate_bay_at = fake_evaluate_bay_at
        client = TestClient(app)
        response = client.get("/api/bays/1000/evaluate")
    finally:
        bays_router.evaluate_bay_at = original
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["duration_mins"] == 60
    assert captured["arrival"].tzinfo is not None
    assert captured["arrival"].tzinfo.key == "Australia/Melbourne"


def test_evaluate_bay_attaches_melbourne_zone_for_naive_arrival_iso() -> None:
    captured = {}

    def fake_evaluate_bay_at(bay_id, arrival, duration_mins, db):
        captured["arrival"] = arrival
        return _dummy_evaluation_payload(bay_id)

    app.dependency_overrides[get_db] = lambda: object()
    try:
        original = bays_router.evaluate_bay_at
        bays_router.evaluate_bay_at = fake_evaluate_bay_at
        client = TestClient(app)
        response = client.get(
            "/api/bays/1000/evaluate",
            params={"arrival_iso": "2026-04-14T12:00:00"},
        )
    finally:
        bays_router.evaluate_bay_at = original
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["arrival"].tzinfo is not None
    assert captured["arrival"].tzinfo.key == "Australia/Melbourne"
    assert captured["arrival"].hour == 12
    assert captured["arrival"].minute == 0


def test_evaluate_bay_accepts_timezone_aware_arrival_iso() -> None:
    captured = {}

    def fake_evaluate_bay_at(bay_id, arrival, duration_mins, db):
        captured["arrival"] = arrival
        return _dummy_evaluation_payload(bay_id)

    app.dependency_overrides[get_db] = lambda: object()
    try:
        original = bays_router.evaluate_bay_at
        bays_router.evaluate_bay_at = fake_evaluate_bay_at
        client = TestClient(app)
        response = client.get(
            "/api/bays/1000/evaluate",
            params={"arrival_iso": "2026-04-14T12:00:00+10:00"},
        )
    finally:
        bays_router.evaluate_bay_at = original
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["arrival"].tzinfo is not None
    assert captured["arrival"].hour == 12
    assert captured["arrival"].minute == 0
    assert captured["arrival"].utcoffset().total_seconds() == 10 * 3600


def test_evaluate_bay_parses_zulu_as_utc() -> None:
    captured = {}

    def fake_evaluate_bay_at(bay_id, arrival, duration_mins, db):
        captured["arrival"] = arrival
        return _dummy_evaluation_payload(bay_id)

    app.dependency_overrides[get_db] = lambda: object()
    try:
        original = bays_router.evaluate_bay_at
        bays_router.evaluate_bay_at = fake_evaluate_bay_at
        client = TestClient(app)
        response = client.get(
            "/api/bays/1000/evaluate",
            params={"arrival_iso": "2026-04-14T02:00:00Z"},
        )
    finally:
        bays_router.evaluate_bay_at = original
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["arrival"].tzinfo is not None
    assert captured["arrival"].hour == 2
    assert captured["arrival"].minute == 0


def test_evaluate_bulk_accepts_timezone_aware_arrival_iso() -> None:
    captured = {}

    def fake_evaluate_bays_in_bbox(south, west, north, east, arrival, duration_mins, db):
        captured["arrival"] = arrival
        return []

    app.dependency_overrides[get_db] = lambda: object()
    try:
        original = bays_router.evaluate_bays_in_bbox
        bays_router.evaluate_bays_in_bbox = fake_evaluate_bays_in_bbox
        client = TestClient(app)
        response = client.get(
            "/api/bays/evaluate-bulk",
            params={
                "bbox": "-37.82,144.95,-37.80,144.97",
                "arrival_iso": "2026-04-14T12:00:00+10:00",
            },
        )
    finally:
        bays_router.evaluate_bays_in_bbox = original
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["arrival"].hour == 12
    assert captured["arrival"].utcoffset().total_seconds() == 10 * 3600


def test_evaluate_bulk_naive_arrival_iso_is_melbourne_local() -> None:
    """Naive ``arrival_iso`` on bulk uses the same Melbourne interpretation as single evaluate."""
    captured = {}

    def fake_evaluate_bays_in_bbox(south, west, north, east, arrival, duration_mins, db):
        captured["arrival"] = arrival
        return []

    app.dependency_overrides[get_db] = lambda: object()
    try:
        original = bays_router.evaluate_bays_in_bbox
        bays_router.evaluate_bays_in_bbox = fake_evaluate_bays_in_bbox
        client = TestClient(app)
        response = client.get(
            "/api/bays/evaluate-bulk",
            params={
                "bbox": "-37.82,144.95,-37.80,144.97",
                "arrival_iso": "2026-04-14T12:00:00",
            },
        )
    finally:
        bays_router.evaluate_bays_in_bbox = original
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["arrival"].tzinfo is not None
    assert captured["arrival"].tzinfo.key == "Australia/Melbourne"
    assert captured["arrival"].hour == 12
    assert captured["arrival"].minute == 0


def test_evaluate_bulk_parses_zulu_same_as_single_evaluate() -> None:
    captured = {}

    def fake_evaluate_bays_in_bbox(south, west, north, east, arrival, duration_mins, db):
        captured["arrival"] = arrival
        return []

    app.dependency_overrides[get_db] = lambda: object()
    try:
        original = bays_router.evaluate_bays_in_bbox
        bays_router.evaluate_bays_in_bbox = fake_evaluate_bays_in_bbox
        client = TestClient(app)
        response = client.get(
            "/api/bays/evaluate-bulk",
            params={
                "bbox": "-37.82,144.95,-37.80,144.97",
                "arrival_iso": "2026-04-14T02:00:00Z",
            },
        )
    finally:
        bays_router.evaluate_bays_in_bbox = original
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert captured["arrival"].tzinfo is not None
    assert captured["arrival"].hour == 2
    assert captured["arrival"].minute == 0
