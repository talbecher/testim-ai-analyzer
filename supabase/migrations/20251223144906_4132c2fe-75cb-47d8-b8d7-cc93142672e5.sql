-- Create analysis reports table (stores each run)
CREATE TABLE public.analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_name TEXT NOT NULL,
  run_date DATE NOT NULL,
  notes TEXT,
  total_analyzed INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  accuracy_percentage DECIMAL(5,2) DEFAULT 0,
  common_mistakes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create analysis results table (stores individual test feedback)
CREATE TABLE public.analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.analysis_reports(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  test_name_normalized TEXT NOT NULL,
  error_message TEXT,
  error_pattern TEXT,
  
  -- AI predictions
  ai_classification TEXT NOT NULL,
  ai_priority TEXT NOT NULL,
  ai_confidence INTEGER NOT NULL,
  ai_action TEXT,
  flaky_kb_matched BOOLEAN DEFAULT false,
  
  -- User feedback
  user_classification TEXT,
  user_priority TEXT,
  user_action TEXT,
  was_correct BOOLEAN DEFAULT true,
  user_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_analysis_results_report_id ON public.analysis_results(report_id);
CREATE INDEX idx_analysis_results_test_normalized ON public.analysis_results(test_name_normalized);
CREATE INDEX idx_analysis_results_was_correct ON public.analysis_results(was_correct);

-- Enable RLS
ALTER TABLE public.analysis_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

-- Create policies - public access (no auth required for this tool)
CREATE POLICY "Allow public read access on analysis_reports"
  ON public.analysis_reports FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access on analysis_reports"
  ON public.analysis_reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public read access on analysis_results"
  ON public.analysis_results FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access on analysis_results"
  ON public.analysis_results FOR INSERT
  WITH CHECK (true);

-- Enable realtime for reports
ALTER PUBLICATION supabase_realtime ADD TABLE public.analysis_reports;