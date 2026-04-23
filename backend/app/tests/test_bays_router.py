"""Router tests for bay evaluation timezone handling."""

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
