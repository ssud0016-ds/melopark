"""Service layer for Melbourne Open Data parking API."""

import httpx

# CoM migrated from Socrata to OpenDataSoft (ODS) API v2.1.
# Single-request limit is capped at 100; pagination via `offset` is required for full dataset.
COM_PARKING_URL = (
    "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"
    "/on-street-parking-bay-sensors/records"
)
ODS_PAGE_SIZE = 100   # ODS API hard cap per request
REQUEST_TIMEOUT = 15  # seconds per page request


async def fetch_raw_parking_bays(max_records: int = 5000) -> list[dict]:
    """Fetch parking bay sensor records from the City of Melbourne Open Data API.

    Paginates automatically until `max_records` are collected or the dataset is exhausted.

    Args:
        max_records: Upper bound on records to return (default 5000).

    Returns:
        A list of raw bay dictionaries as returned by the CoM API.

    Raises:
        httpx.HTTPStatusError: When the upstream API returns a non-2xx status.
        httpx.RequestError: When the request cannot be completed (network issues, timeout, etc.).
    """
    records: list[dict] = []
    offset = 0

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        while len(records) < max_records:
            batch_size = min(ODS_PAGE_SIZE, max_records - len(records))
            response = await client.get(
                COM_PARKING_URL,
                params={"limit": batch_size, "offset": offset},
            )
            response.raise_for_status()
            payload = response.json()
            batch = payload.get("results", [])
            if not batch:
                break
            records.extend(batch)
            offset += len(batch)
            # Stop if we've received all available records
            total = payload.get("total_count", 0)
            if offset >= total:
                break

    return records
