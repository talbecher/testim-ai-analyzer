-- Create learning_patterns table for aggregated AI learning data
CREATE TABLE public.learning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('correction', 'passed_locally', 'manual_fix')),
  error_pattern TEXT,
  test_name_pattern TEXT,
  ai_classification TEXT,
  correct_classification TEXT,
  occurrence_count INTEGER DEFAULT 1,
  importance TEXT DEFAULT 'normal' CHECK (importance IN ('critical', 'high', 'normal')),
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.learning_patterns ENABLE ROW LEVEL SECURITY;

-- Allow public read access (learning patterns are shared)
CREATE POLICY "Learning patterns are publicly readable"
ON public.learning_patterns
FOR SELECT
USING (true);

-- Allow public insert/update (for edge function)
CREATE POLICY "Learning patterns can be created"
ON public.learning_patterns
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Learning patterns can be updated"
ON public.learning_patterns
FOR UPDATE
USING (true);

-- Add index for faster lookups
CREATE INDEX idx_learning_patterns_importance ON public.learning_patterns(importance);
CREATE INDEX idx_learning_patterns_type ON public.learning_patterns(pattern_type);