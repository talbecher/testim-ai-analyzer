ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS ai_priority_reason text;

COMMENT ON COLUMN public.analysis_results.ai_priority_reason IS
  'Full AI priorityReason / signals text at save time';
