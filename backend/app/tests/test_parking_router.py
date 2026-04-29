"""Router tests for parking prediction endpoint."""

from fastapi.testclient import TestClient

from app.main import app
from app.routers import parking as parking_router


def test_predicted_occupancy_attaches_melbourne_zone_for_naive_arrival() -> None:
    captured = {}

    async def fake_predict(arrival):
        captured["arrival"] = arrival
        return {
            "predicted_occupancy_pct": 67.4,
            "sample_count": 12,
            "basis": "historical_sensor_data",
        }

    original = parking_router.predict_occupancy_for_arrival
    parking_router.predict_occupancy_for_arrival = fake_predict
    try:
        client = TestClient(app)
        response = client.get(
            "/api/parking/predicted-occupancy",
            params={"arrival_iso": "2026-05-01T10:30:00"},
        )
    finally:
        parking_router.predict_occupancy_for_arrival = original

    assert response.status_code == 200
    payload = response.json()
    assert payload["predicted_occupancy_pct"] == 67.4
    assert payload["sample_count"] == 12
    assert payload["basis"] == "historical_sensor_data"
    assert captured["arrival"].tzinfo is not None
    assert captured["arrival"].tzinfo.key == "Australia/Melbourne"


def test_predicted_occupancy_rejects_invalid_arrival_iso() -> None:
    client = TestClient(app)
    response = client.get(
        "/api/parking/predicted-occupancy",
        params={"arrival_iso": "not-a-datetime"},
    )
    assert response.status_code == 422


def test_predicted_zone_pressure_returns_zone_warning_levels() -> None:
    async def fake_predict_zone(arrival):
        return [
            {
                "zone_id": "nw",
                "predicted_occupancy_pct": 82.1,
                "predicted_pressure_level": "high",
                "basis": "historical_sensor_data",
            },
            {
                "zone_id": "nc",
                "predicted_occupancy_pct": 44.2,
                "predicted_pressure_level": "moderate",
                "basis": "historical_sensor_data",
            },
        ]

    original = parking_router.predict_zone_pressure_for_arrival
    parking_router.predict_zone_pressure_for_arrival = fake_predict_zone
    try:
        client = TestClient(app)
        response = client.get(
            "/api/parking/predicted-zone-pressure",
            params={"arrival_iso": "2026-05-01T10:30:00"},
        )
    finally:
        parking_router.predict_zone_pressure_for_arrival = original

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload["zones"], list)
    assert payload["zones"][0]["zone_id"] == "nw"
    assert payload["zones"][0]["predicted_pressure_level"] == "high"
