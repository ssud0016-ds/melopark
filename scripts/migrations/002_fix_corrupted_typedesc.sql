-- 002_fix_corrupted_typedesc.sql
-- Null out bay_restrictions.typedesc values that were corrupted by the
-- old clean_to_silver.py behaviour of sourcing typedesc from
-- description{N} instead of typedesc{N}.  CoM's descriptionN field
-- occasionally contained ISO-8601 strings (e.g. '0001-01-08T02:00:00+00:00').
--
-- Safe to re-run: idempotent — matches only rows still containing ISO-like
-- timestamps, so repeated runs are no-ops once the pipeline re-populates
-- the column with the correct typedesc{N} value.
UPDATE bay_restrictions
SET typedesc = NULL
WHERE typedesc ~ '^\d{4}-\d{2}-\d{2}T';
