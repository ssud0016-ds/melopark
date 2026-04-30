"""Accessibility router: unavailable data returns 503 without leaking paths."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.routers import accessibility as accessibility_module


def test_accessibility_nearby_503_when_parquet_missing() -> None:
    with patch.object(
        accessibility_module,
        "find_nearby_disability_bays",
        side_effect=FileNotFoundError("Missing /secret/path/gold_accessibility_bays.parquet"),
    ):
        client = TestClient(app)
        response = client.get(
            "/api/accessibility/nearby",
            params={"lat": -37.81, "lon": 144.96},
        )

    assert response.status_code == 503
    body = response.json()
    assert body["detail"] == "Accessibility data unavailable"
    assert "gold_accessibility" not in body["detail"]
    assert "parquet" not in body["detail"].lower()


def test_accessibility_points_503_when_parquet_missing() -> None:
    with patch.object(
        accessibility_module,
        "get_accessibility_points",
        side_effect=FileNotFoundError("E:\\MelPark\\data\\silver\\missing.parquet"),
    ):
        client = TestClient(app)
        response = client.get("/api/accessibility/points", params={"top_n": 100})

    assert response.status_code == 503
    body = response.json()
    assert body["detail"] == "Accessibility data unavailable"
    assert "MelPark" not in body["detail"]
    assert ".parquet" not in body["detail"]
