-- Add columns for passed locally reason tracking
ALTER TABLE public.analysis_results 
ADD COLUMN passed_locally_reason text DEFAULT NULL,
ADD COLUMN passed_locally_notes text DEFAULT NULL;