-- Receipt scanning workflow (uses existing tables + receipt-images bucket from 004).
-- No schema changes required; Edge Function uses service role for job/item writes.

COMMENT ON TABLE public.receipt_processing_jobs IS
  'Async receipt OCR/AI jobs; parse-receipt Edge Function updates rows server-side';
