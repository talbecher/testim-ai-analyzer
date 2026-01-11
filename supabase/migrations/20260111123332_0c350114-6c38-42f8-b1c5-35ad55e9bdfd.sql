-- Add columns for user notes pattern analysis
ALTER TABLE public.learning_patterns 
ADD COLUMN IF NOT EXISTS user_notes_pattern TEXT,
ADD COLUMN IF NOT EXISTS extracted_keywords TEXT[];

-- Add index for keyword searches
CREATE INDEX IF NOT EXISTS idx_learning_patterns_keywords ON public.learning_patterns USING GIN(extracted_keywords);