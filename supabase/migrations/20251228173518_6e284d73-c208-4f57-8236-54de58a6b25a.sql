-- Add manual fix tracking columns to analysis_results table
ALTER TABLE public.analysis_results 
ADD COLUMN required_manual_fix boolean DEFAULT false,
ADD COLUMN manual_fix_type text,
ADD COLUMN manual_fix_notes text;