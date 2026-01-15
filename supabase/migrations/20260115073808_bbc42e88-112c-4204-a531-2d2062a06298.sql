-- Add feature rollout flag to analysis_reports table
ALTER TABLE public.analysis_reports 
ADD COLUMN is_feature_rollout BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.analysis_reports.is_feature_rollout IS 'When true, feedback from this run is excluded from AI learning (expected failures from new features)';