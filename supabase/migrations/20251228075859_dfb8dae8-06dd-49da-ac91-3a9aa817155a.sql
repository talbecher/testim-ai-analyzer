-- Add mode field to analysis_reports
ALTER TABLE public.analysis_reports 
ADD COLUMN mode TEXT NOT NULL DEFAULT 'production';

-- Add constraint for valid mode values
ALTER TABLE public.analysis_reports
ADD CONSTRAINT analysis_reports_mode_check 
CHECK (mode IN ('learning', 'production'));

-- Add is_in_flaky_kb field to analysis_results
ALTER TABLE public.analysis_results 
ADD COLUMN is_in_flaky_kb BOOLEAN DEFAULT false;