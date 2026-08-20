-- Track whether RAG (historical similar failures) context was used during AI analysis
ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS rag_used BOOLEAN DEFAULT NULL;

COMMENT ON COLUMN public.analysis_results.rag_used IS
  'True when analyze-failures injected Historical Similar Failures (Ground Truth) context; NULL for legacy rows.';
