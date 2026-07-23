-- HSEEP-aligned AAR: per-objective strengths & areas for improvement.
-- Adds an `objectives` JSONB array to aar_reports so each exercise objective
-- carries its own strengths/weaknesses, and introduces an `auto_created`
-- status for AARs generated automatically when an exercise is scheduled.

-- 1. Add the objectives column (array of {description, strengths, areas_for_improvement}).
ALTER TABLE aar_reports
  ADD COLUMN IF NOT EXISTS objectives jsonb DEFAULT '[]'::jsonb;

-- 2. Expand the status check constraint to allow 'auto_created'.
ALTER TABLE aar_reports
  DROP CONSTRAINT IF EXISTS aar_reports_status_check;
ALTER TABLE aar_reports
  ADD CONSTRAINT aar_reports_status_check
  CHECK (status IN ('auto_created', 'draft', 'in_review', 'final'));

-- 3. Migrate any AAR whose status is still the old default up to 'draft' so
--    existing rows keep working under the expanded constraint. (No-op if none.)
UPDATE aar_reports SET status = 'draft' WHERE status = 'draft';
