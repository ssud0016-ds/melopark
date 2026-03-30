"""
Restrictions route - serves parking restriction rules per bay
and the restriction translator (Epic 2).

The translator takes a bay_id and arrival time, evaluates which
restriction window is active, and returns a plain English verdict.
"""

import requests
from datetime import datetime
from flask import Blueprint, jsonify, request
from app.services.restriction_service import translate_restriction, get_bay_restrictions

restrictions_bp = Blueprint("restrictions", __name__)

COM_RESTRICTIONS_URL = (
    "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"
    "/on-street-car-park-bay-restrictions/records"
)


@restrictions_bp.route("/<string:bay_id>")
def get_restrictions(bay_id):
    """
    Return raw restriction data for a bay.
    """
    restrictions = get_bay_restrictions(bay_id)

    if restrictions is None:
        return jsonify({"error": "Could not fetch restriction data"}), 503

    if not restrictions:
        return jsonify({"error": f"No restrictions found for bay {bay_id}"}), 404

    return jsonify({
        "bay_id": bay_id,
        "restrictions": restrictions,
    })


@restrictions_bp.route("/<string:bay_id>/translate")
def translate(bay_id):
    """
    Restriction translator endpoint (Epic 2).

    Returns a plain English verdict for a given bay at a given time.

    Query params:
        arrival (str): ISO datetime of planned arrival.
                       Defaults to now if not provided.
        duration (int): planned stay in minutes (default 60).
    """
    arrival_str = request.args.get("arrival")
    duration_min = request.args.get("duration", 60, type=int)

    if arrival_str:
        try:
            arrival = datetime.fromisoformat(arrival_str)
        except ValueError:
            return jsonify({"error": "Invalid arrival format. Use ISO 8601."}), 400
    else:
        arrival = datetime.now()

    result = translate_restriction(bay_id, arrival, duration_min)

    if result is None:
        return jsonify({"error": "Could not process restriction data"}), 503

    return jsonify(result)
