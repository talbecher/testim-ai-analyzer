-- Create bug_categories table for customizable bug types
CREATE TABLE public.bug_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bug_categories ENABLE ROW LEVEL SECURITY;

-- Public read access for bug categories
CREATE POLICY "Allow public read access on bug_categories"
ON public.bug_categories
FOR SELECT
USING (true);

-- Public insert access for bug categories
CREATE POLICY "Allow public insert access on bug_categories"
ON public.bug_categories
FOR INSERT
WITH CHECK (true);

-- Public update access for bug categories
CREATE POLICY "Allow public update access on bug_categories"
ON public.bug_categories
FOR UPDATE
USING (true);

-- Public delete access for bug categories
CREATE POLICY "Allow public delete access on bug_categories"
ON public.bug_categories
FOR DELETE
USING (true);

-- Insert default categories
INSERT INTO public.bug_categories (name, description, sort_order) VALUES
  ('Bug in app', 'Application bug that needs to be fixed', 1),
  ('Backend issue', 'Server or API related issue', 2),
  ('UI/Frontend bug', 'Visual or interaction issue', 3),
  ('Data issue', 'Data inconsistency or corruption', 4),
  ('Performance issue', 'Slow or resource-intensive behavior', 5),
  ('Other', 'Other type of bug', 99);

-- Add new columns to analysis_results
ALTER TABLE public.analysis_results 
ADD COLUMN bug_category TEXT,
ADD COLUMN bug_link TEXT,
ADD COLUMN passed_locally BOOLEAN DEFAULT false;