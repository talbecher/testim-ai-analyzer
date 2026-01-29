-- Create regression_buckets table
CREATE TABLE public.regression_buckets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.regression_buckets ENABLE ROW LEVEL SECURITY;

-- RLS Policies - public access
CREATE POLICY "Regression buckets are publicly readable"
  ON public.regression_buckets FOR SELECT
  USING (true);

CREATE POLICY "Regression buckets can be created"
  ON public.regression_buckets FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Regression buckets can be updated"
  ON public.regression_buckets FOR UPDATE
  USING (true);

CREATE POLICY "Regression buckets can be deleted"
  ON public.regression_buckets FOR DELETE
  USING (true);

-- Seed initial data
INSERT INTO public.regression_buckets (name, sort_order) VALUES
  ('Regression 1', 1),
  ('Regression 2', 2),
  ('Regression 3', 3),
  ('Regression 4', 4),
  ('Regression 5', 5),
  ('Regression 6', 6),
  ('Regression 7', 7),
  ('Regression 8', 8);