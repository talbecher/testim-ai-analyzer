-- Add updated_at column to analysis_reports
ALTER TABLE public.analysis_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create trigger function to automatically update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates on analysis_reports
DROP TRIGGER IF EXISTS update_analysis_reports_updated_at ON public.analysis_reports;
CREATE TRIGGER update_analysis_reports_updated_at
BEFORE UPDATE ON public.analysis_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add UPDATE policy for analysis_reports
CREATE POLICY "Allow public update access on analysis_reports"
ON public.analysis_reports
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Add DELETE policy for analysis_reports
CREATE POLICY "Allow public delete access on analysis_reports"
ON public.analysis_reports
FOR DELETE
USING (true);

-- Add UPDATE policy for analysis_results
CREATE POLICY "Allow public update access on analysis_results"
ON public.analysis_results
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Add DELETE policy for analysis_results
CREATE POLICY "Allow public delete access on analysis_results"
ON public.analysis_results
FOR DELETE
USING (true);