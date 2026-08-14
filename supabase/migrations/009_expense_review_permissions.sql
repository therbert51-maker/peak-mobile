-- Restrict receipt line-item creation to the expense creator.
-- Existing UPDATE/DELETE policies already use can_manage_expense_item().
-- Depends on: 004_create_expense_foundation.sql, 006_fix_expense_rls_and_membership.sql.

DROP POLICY IF EXISTS expense_items_insert ON public.expense_items;
CREATE POLICY expense_items_insert ON public.expense_items
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_expense(expense_id));
