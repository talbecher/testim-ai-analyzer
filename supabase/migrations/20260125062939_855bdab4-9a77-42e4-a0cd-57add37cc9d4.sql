-- Add regression_bucket as source of truth for filtering
ALTER TABLE analysis_reports 
ADD COLUMN IF NOT EXISTS regression_bucket TEXT;

-- Backfill existing data from run_name for records that look like regression buckets
UPDATE analysis_reports 
SET regression_bucket = run_name 
WHERE regression_bucket IS NULL 
  AND run_name SIMILAR TO 'Regression [1-8]';

-- Add index for fast filtering by regression bucket
CREATE INDEX IF NOT EXISTS idx_reports_regression_bucket 
ON analysis_reports(regression_bucket);

-- Track P0 overrides for validation metrics
ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS ai_priority_original TEXT,
ADD COLUMN IF NOT EXISTS was_downgraded BOOLEAN DEFAULT false;

-- Track time-to-stability per regression bucket
ALTER TABLE analysis_reports
ADD COLUMN IF NOT EXISTS classification_stability_score NUMERIC;