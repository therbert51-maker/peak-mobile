-- Receipt processing jobs RLS: space members may queue and read jobs for expenses in their space.
-- Reuses existing public.is_space_member(uuid) (do not redefine).
-- Depends on: 004_create_expense_foundation.sql, 006_fix_expense_rls_and_membership.sql

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER — consistent with expenses access checks)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_access_expense(p_expense_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.expenses e
    WHERE e.id = p_expense_id
      AND public.is_space_member(e.space_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_receipt_processing_job(p_expense_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_expense(p_expense_id);
$$;

GRANT EXECUTE ON FUNCTION public.can_access_expense(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_receipt_processing_job(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- receipt_processing_jobs policies (match expenses: members read; creator queues)
-- ---------------------------------------------------------------------------

ALTER TABLE public.receipt_processing_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receipt_processing_jobs_select ON public.receipt_processing_jobs;
CREATE POLICY receipt_processing_jobs_select ON public.receipt_processing_jobs
  FOR SELECT TO authenticated
  USING (public.can_access_receipt_processing_job(expense_id));

DROP POLICY IF EXISTS receipt_processing_jobs_insert ON public.receipt_processing_jobs;
CREATE POLICY receipt_processing_jobs_insert ON public.receipt_processing_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND public.can_access_receipt_processing_job(expense_id)
  );

-- Creator may cancel / retry metadata from the app; Edge Function uses service role for AI updates.
DROP POLICY IF EXISTS receipt_processing_jobs_update ON public.receipt_processing_jobs;
CREATE POLICY receipt_processing_jobs_update ON public.receipt_processing_jobs
  FOR UPDATE TO authenticated
  USING (
    requested_by = auth.uid()
    AND public.can_access_receipt_processing_job(expense_id)
  )
  WITH CHECK (
    requested_by = auth.uid()
    AND public.can_access_receipt_processing_job(expense_id)
  );

DROP POLICY IF EXISTS receipt_processing_jobs_delete ON public.receipt_processing_jobs;
CREATE POLICY receipt_processing_jobs_delete ON public.receipt_processing_jobs
  FOR DELETE TO authenticated
  USING (public.can_manage_expense(expense_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_processing_jobs TO authenticated;
