-- 005_add_has_signage_gap.sql
-- Track A (Bug 9): add has_signage_gap flag to the bays table.
-- Bays on a parkingzone that carries an LZ/DP sign plate but whose
-- kerbsideid is outside CoM's bay-specific restrictions feed are flagged
-- TRUE. The evaluator uses this to emit data_coverage='partial_signage'
-- so the frontend can render a "check signage" banner.
--
-- Idempotent: IF NOT EXISTS guard means re-running is safe.
ALTER TABLE bays
  ADD COLUMN IF NOT EXISTS has_signage_gap BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill will happen on next pipeline re-run (build_gold.py --write-db).
-- After re-run, verify:
SELECT COUNT(*) AS flagged_bays FROM bays WHERE has_signage_gap = TRUE;
-- Expected: ~1,796
