-- Restore member-scoped reads for persisted expense participant shares.
-- Writes remain restricted to the existing save_expense_split SECURITY DEFINER RPC.
--
-- Symptom: save_expense_split succeeds and expense_item_assignments are readable,
-- but expense_participants SELECT returns zero rows so settlement UI never renders.

-- Align expense access checks with save_expense_split (member or space owner).
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
      AND (
        public.is_space_member(e.space_id)
        OR EXISTS (
          SELECT 1
          FROM public.spaces s
          WHERE s.id = e.space_id
            AND s.owner_id = auth.uid()
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_expense(uuid) TO authenticated;

ALTER TABLE public.expense_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expense_participants_select ON public.expense_participants;
CREATE POLICY expense_participants_select ON public.expense_participants
  FOR SELECT TO authenticated
  USING (public.can_access_expense(expense_id));

GRANT SELECT ON public.expense_participants TO authenticated;

COMMENT ON POLICY expense_participants_select ON public.expense_participants
IS 'Space members may read finalized participant shares for expenses they can access.';
