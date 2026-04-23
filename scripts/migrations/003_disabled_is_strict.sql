-- 003_disabled_is_strict.sql
-- Bug 7 fix: bring existing `disabled` rows in line with the updated
-- classify_rule() behaviour in scripts/build_gold.py. A non-permitted driver
-- occupying a disabled-only bay is illegally parked, so a mid-stay activation
-- of a disabled window must raise a strict warning.
--
-- Idempotent: matches only the rows the next pipeline re-run will overwrite
-- to the same value. Safe to re-run.
UPDATE bay_restrictions
SET is_strict = TRUE
WHERE rule_category = 'disabled'
  AND is_strict = FALSE;

-- Verification: should return 0 after the migration runs.
SELECT COUNT(*) AS disabled_not_strict
FROM bay_restrictions
WHERE rule_category = 'disabled'
  AND is_strict = FALSE;
