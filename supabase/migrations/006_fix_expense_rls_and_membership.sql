-- Manual expense RLS + membership backfill (reuses existing is_space_owner / is_space_member).
-- Requires: public.is_space_owner(uuid), public.is_space_member(uuid) already deployed.
-- Run after 004_create_expense_foundation.sql.

-- Owners listed on spaces but missing a space_members row (legacy / failed inserts)
INSERT INTO public.space_members (space_id, user_id, role)
SELECT s.id, s.owner_id, 'owner'
FROM public.spaces s
WHERE s.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.space_members sm
    WHERE sm.space_id = s.id
      AND sm.user_id = s.owner_id
  );

-- ---------------------------------------------------------------------------
-- space_members RLS (readable by trip members; users may add themselves)
-- ---------------------------------------------------------------------------

ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS space_members_select_member ON public.space_members;
CREATE POLICY space_members_select_member ON public.space_members
  FOR SELECT TO authenticated
  USING (public.is_space_member(space_id));

DROP POLICY IF EXISTS space_members_insert_member ON public.space_members;
CREATE POLICY space_members_insert_member ON public.space_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_space_owner(space_id)
      OR public.is_space_member(space_id)
    )
  );

GRANT SELECT, INSERT ON public.space_members TO authenticated;

-- ---------------------------------------------------------------------------
-- Expense manager: creator may update/delete their expense (space member)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_manage_expense(p_expense_id uuid)
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
      AND e.created_by = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- expenses — members read/create; creators update/delete own rows
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS expenses_select_member ON public.expenses;
CREATE POLICY expenses_select_member ON public.expenses
  FOR SELECT TO authenticated
  USING (public.is_space_member(space_id));

DROP POLICY IF EXISTS expenses_insert_member ON public.expenses;
CREATE POLICY expenses_insert_member ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_space_member(space_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS expenses_update_manager ON public.expenses;
DROP POLICY IF EXISTS expenses_update_own ON public.expenses;
CREATE POLICY expenses_update_own ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    public.is_space_member(space_id)
    AND created_by = auth.uid()
  )
  WITH CHECK (
    public.is_space_member(space_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS expenses_delete_manager ON public.expenses;
DROP POLICY IF EXISTS expenses_delete_own ON public.expenses;
CREATE POLICY expenses_delete_own ON public.expenses
  FOR DELETE TO authenticated
  USING (
    public.is_space_member(space_id)
    AND created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- expense_items — members read/add; expense creator manages lines
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS expense_items_select ON public.expense_items;
CREATE POLICY expense_items_select ON public.expense_items
  FOR SELECT TO authenticated
  USING (public.can_access_expense(expense_id));

DROP POLICY IF EXISTS expense_items_insert ON public.expense_items;
CREATE POLICY expense_items_insert ON public.expense_items
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_expense(expense_id));

DROP POLICY IF EXISTS expense_items_update ON public.expense_items;
CREATE POLICY expense_items_update ON public.expense_items
  FOR UPDATE TO authenticated
  USING (public.can_manage_expense_item(id))
  WITH CHECK (public.can_manage_expense_item(id));

DROP POLICY IF EXISTS expense_items_delete ON public.expense_items;
CREATE POLICY expense_items_delete ON public.expense_items
  FOR DELETE TO authenticated
  USING (public.can_manage_expense_item(id));

-- ---------------------------------------------------------------------------
-- expense_item_assignments ("shares") — members read; creator or assignee manage
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS expense_item_assignments_select ON public.expense_item_assignments;
CREATE POLICY expense_item_assignments_select ON public.expense_item_assignments
  FOR SELECT TO authenticated
  USING (public.can_access_expense(public.expense_item_expense_id(expense_item_id)));

DROP POLICY IF EXISTS expense_item_assignments_insert ON public.expense_item_assignments;
CREATE POLICY expense_item_assignments_insert ON public.expense_item_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_assignment(expense_item_id, user_id));

DROP POLICY IF EXISTS expense_item_assignments_update ON public.expense_item_assignments;
CREATE POLICY expense_item_assignments_update ON public.expense_item_assignments
  FOR UPDATE TO authenticated
  USING (public.can_manage_assignment(expense_item_id, user_id))
  WITH CHECK (public.can_manage_assignment(expense_item_id, user_id));

DROP POLICY IF EXISTS expense_item_assignments_delete ON public.expense_item_assignments;
CREATE POLICY expense_item_assignments_delete ON public.expense_item_assignments
  FOR DELETE TO authenticated
  USING (public.can_manage_assignment(expense_item_id, user_id));
