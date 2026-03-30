"""
Sensors route - proxies the City of Melbourne live bay sensor API.

The CoM API returns ~5000 bay records with occupancy status.
We cache responses briefly to avoid hammering their server and
to stay well within any rate limits.
"""

import time
from flask import Blueprint, jsonify, request
from app.services.sensor_service import get_live_sensors

sensors_bp = Blueprint("sensors", __name__)


@sensors_bp.route("/")
def list_sensors():
    """
    Return live sensor data for all bays.

    Query params:
        lat (float): centre latitude for bounding box filter
        lon (float): centre longitude for bounding box filter
        radius (float): radius in metres (default 500)
        status (str): filter by "Unoccupied" or "Present"
    """
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    radius = request.args.get("radius", 500, type=float)
    status_filter = request.args.get("status")

    sensors = get_live_sensors()

    if sensors is None:
        return jsonify({"error": "Could not fetch sensor data"}), 503

    # Filter by status if requested
    if status_filter:
        sensors = [s for s in sensors if s.get("status") == status_filter]

    # Filter by bounding box if lat/lon provided
    if lat is not None and lon is not None:
        sensors = _filter_by_distance(sensors, lat, lon, radius)

    return jsonify({
        "count": len(sensors),
        "data": sensors,
    })


@sensors_bp.route("/<string:bay_id>")
def get_sensor(bay_id):
    """Return sensor data for a single bay."""
    sensors = get_live_sensors()

    if sensors is None:
        return jsonify({"error": "Could not fetch sensor data"}), 503

    match = [s for s in sensors if s.get("bay_id") == bay_id]

    if not match:
        return jsonify({"error": f"Bay {bay_id} not found"}), 404

    return jsonify(match[0])


def _filter_by_distance(sensors, centre_lat, centre_lon, radius_m):
    """
    Rough bounding box filter. Not geodesic-accurate but good enough
    for filtering a few hundred metres in Melbourne's latitude.
    1 degree lat ~ 111,000m, 1 degree lon ~ 82,000m at -37.8
    """
    lat_offset = radius_m / 111_000
    lon_offset = radius_m / 82_000

    return [
        s for s in sensors
        if s.get("lat") is not None
        and s.get("lon") is not None
        and abs(s["lat"] - centre_lat) <= lat_offset
        and abs(s["lon"] - centre_lon) <= lon_offset
    ]
