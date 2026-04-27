# Data pipeline and features

This note describes how MeloPark’s data flows and which features each layer powers. For setup and repo layout, see the root [README](../README.md).

## Sources

| Source | City of Melbourne dataset (concept) | What the app uses it for |
|--------|-------------------------------------|---------------------------|
| **Sensors** | On-street parking bay sensors | Live **free / occupied**, **map coordinates**, **street name** (`roadsegmentdescription`), **last updated** |
| **Restrictions (API)** | On-street car park bay restrictions | **Bay type** labels for the map (e.g. Timed, Loading Zone) and a **coarse legal fallback** when the database has no rule rows |
| **Postgres (gold)** | Same restriction logic, loaded offline | **Full rule evaluation**: time windows, max stay, clearway-style warnings, plain-English copy |

The live join between sensors and the restrictions **API** uses the same identifier on both sides: sensor **`kerbsideid`** equals restrictions **`deviceid`**. (Restrictions **`bayid`** is a different internal namespace and is not used for that join.)

## Runtime (what users hit)

1. **`GET /api/parking`**  
   Reads a **sensor cache** (short TTL) and a **restrictions lookup cache** (longer refresh). Each sensor row is turned into a bay with `bay_id` = `kerbsideid`, then enriched with `bay_type` / `has_restriction_data` from the restrictions lookup. **No SQL join**—merge happens in application code.

2. **`GET /api/bays/{id}/evaluate`** (and bulk evaluate)  
   **Primary:** `bays` + `bay_restrictions` in Postgres for time-aware verdicts.  
   **Fallback:** if the bay exists but has no restriction rows, the same **restrictions API cache** can supply a coarse category-only answer (`data_source: api_fallback`).  
   If the bay is missing from the DB entirely, the API returns **unknown** and points users to on-street signage.

The frontend follows that split: map dots and occupancy come from `/api/parking`; rule text and yes/no/unknown come from the evaluate endpoints (see `frontend/src/services/apiBays.js`).

## Offline (medallion → database)

Scripts under `scripts/` implement the medallion flow:

- **Bronze** — raw API dumps.  
- **Silver** — cleaned tables; sensors and restrictions aligned on the shared device/kerbside id and restrictions melted from wide “slot” columns into long form.  
- **Gold** — loaded into Postgres for production-style evaluation.

Running this pipeline keeps **evaluate** accurate and detailed; the live restrictions cache mainly supports **map typing** and **degraded** evaluation when gold rows are missing.

## Mental model

```text
CoM sensors ──► cache ──┐
                        ├──► merged bays (/api/parking) ──► map: position, occupancy, bay type
CoM restrictions API ──► cache ──┘

Gold (Postgres) ─────────────────────────────► /api/bays/.../evaluate ──► legal copy, max stay, warnings
```

If Postgres is empty or a bay has no restriction rows, behaviour gracefully steps down to API-derived categories only, never to guessed rules on the client.
