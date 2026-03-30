"""
Bays route - serves parking bay geometry for the map layer.

In production this would query the Gold SQLite database.
For the initial scaffold, it fetches from the CoM API directly.
Once the data pipeline is running, swap to the local DB.
"""

import requests
from flask import Blueprint, jsonify, request

bays_bp = Blueprint("bays", __name__)

COM_BAYS_URL = (
    "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"
    "/on-street-parking-bays/records"
)


@bays_bp.route("/")
def list_bays():
    """
    Return parking bay geometry and metadata.

    Query params:
        limit (int): max records (default 500)
        offset (int): pagination offset
    """
    limit = request.args.get("limit", 500, type=int)
    offset = request.args.get("offset", 0, type=int)

    try:
        params = {
            "limit": min(limit, 1000),
            "offset": offset,
            "select": "marker_id,bay_id,geo_shape,rd_seg_id,last_edit_date",
        }
        resp = requests.get(COM_BAYS_URL, params=params, timeout=30)
        resp.raise_for_status()
        raw = resp.json()

        records = raw.get("results", [])

        bays = []
        for r in records:
            bays.append({
                "marker_id": r.get("marker_id"),
                "bay_id": r.get("bay_id"),
                "geometry": r.get("geo_shape"),
                "road_segment_id": r.get("rd_seg_id"),
            })

        return jsonify({
            "count": len(bays),
            "data": bays,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 503


@bays_bp.route("/<string:marker_id>")
def get_bay(marker_id):
    """Return a single bay by marker_id."""
    try:
        params = {
            "limit": 1,
            "where": f'marker_id="{marker_id}"',
        }
        resp = requests.get(COM_BAYS_URL, params=params, timeout=30)
        resp.raise_for_status()
        raw = resp.json()

        records = raw.get("results", [])
        if not records:
            return jsonify({"error": f"Bay {marker_id} not found"}), 404

        r = records[0]
        return jsonify({
            "marker_id": r.get("marker_id"),
            "bay_id": r.get("bay_id"),
            "geometry": r.get("geo_shape"),
            "road_segment_id": r.get("rd_seg_id"),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 503
