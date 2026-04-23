-- Bug 8 runbook: reload bay restrictions after dedup fix.
-- No schema change in this migration file; this is an operational checklist.

-- 1) Reload data using the actual CLI flag supported by scripts/build_gold.py:
--    python scripts/build_gold.py --write-db

-- 2) Verify bay_restrictions row volume gate (> 16,000).
SELECT COUNT(*) AS bay_restrictions_rows
FROM bay_restrictions;

-- 3) Verify weekend-only bay count gate (<= 700).
-- CoM day convention: 0=Sun, 1=Mon, ... 6=Sat
WITH per_bay AS (
  SELECT
    bay_id,
    BOOL_OR(fromday = 1 AND today = 5) AS has_weekday_1_to_5,
    BOOL_OR(fromday = 6 AND today = 0) AS has_weekend_6_to_0
  FROM bay_restrictions
  GROUP BY bay_id
)
SELECT COUNT(*) AS weekend_only_bays
FROM per_bay
WHERE has_weekend_6_to_0
  AND NOT has_weekday_1_to_5;

-- 4) Spot check bay 57923 coverage after reload.
SELECT
  bay_id,
  slot_num,
  typedesc,
  fromday,
  today,
  starttime,
  endtime
FROM bay_restrictions
WHERE bay_id = '57923'
ORDER BY slot_num, fromday, starttime;

-- 5) Optional: quick neighborhood sanity check for segment peers.
SELECT
  bay_id,
  COUNT(*) AS restriction_rows
FROM bay_restrictions
WHERE bay_id IN ('57921','57922','57923','57924','57925','57926','57927')
GROUP BY bay_id
ORDER BY bay_id;
