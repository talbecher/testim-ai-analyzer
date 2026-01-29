-- Create regression_buckets table for dynamic regression bucket management
CREATE TABLE public.regression_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.regression_buckets ENABLE ROW LEVEL SECURITY;

-- Public read access for regression buckets
CREATE POLICY "Allow public read access on regression_buckets"
ON public.regression_buckets
FOR SELECT
USING (true);

-- Public insert access for regression buckets
CREATE POLICY "Allow public insert access on regression_buckets"
ON public.regression_buckets
FOR INSERT
WITH CHECK (true);

-- Public update access for regression buckets
CREATE POLICY "Allow public update access on regression_buckets"
ON public.regression_buckets
FOR UPDATE
USING (true);

-- Public delete access for regression buckets
CREATE POLICY "Allow public delete access on regression_buckets"
ON public.regression_buckets
FOR DELETE
USING (true);

-- Seed with existing values (Regression 1..8)
INSERT INTO public.regression_buckets (name, sort_order) VALUES
  ('Regression 1', 1),
  ('Regression 2', 2),
  ('Regression 3', 3),
  ('Regression 4', 4),
  ('Regression 5', 5),
  ('Regression 6', 6),
  ('Regression 7', 7),
  ('Regression 8', 8);
