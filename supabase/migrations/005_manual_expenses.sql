-- Manual trip expenses (Branch: manual expense UI)
-- Depends on: 004_create_expense_foundation.sql (public.expenses + RLS)
--
-- App mapping for simple manual entries:
--   title    -> expense_title
--   amount   -> total
--   currency -> original_currency (and display_currency)
--   receipt_status -> 'manual'

COMMENT ON COLUMN public.expenses.expense_title IS 'User-visible expense title';
COMMENT ON COLUMN public.expenses.total IS 'Total amount; for manual expenses equals the entered amount';
COMMENT ON COLUMN public.expenses.original_currency IS 'ISO 4217 currency code (uppercase)';

CREATE INDEX IF NOT EXISTS expenses_space_created_at_idx
  ON public.expenses (space_id, created_at DESC);
