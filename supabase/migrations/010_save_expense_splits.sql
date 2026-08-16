-- Atomic, member-scoped persistence for completed receipt item splits.
-- Reuses expense_item_assignments and expense_participants from migration 004.
-- Relies on the already-deployed public.can_manage_assignment(uuid, uuid) for RLS;
-- do not recreate it here (PostgreSQL rejects CREATE OR REPLACE when parameter names differ).

-- Final splits are written only through save_expense_split so assignments and
-- participant aggregates cannot drift through separate client writes.
DROP POLICY IF EXISTS expense_item_assignments_insert ON public.expense_item_assignments;
DROP POLICY IF EXISTS expense_item_assignments_update ON public.expense_item_assignments;
DROP POLICY IF EXISTS expense_item_assignments_delete ON public.expense_item_assignments;

CREATE OR REPLACE FUNCTION public.invalidate_expense_split_for_item_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense_id uuid;
BEGIN
  v_expense_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.expense_id ELSE NEW.expense_id END;

  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.expense_item_assignments
    WHERE expense_item_id = NEW.id;
  END IF;

  DELETE FROM public.expense_participants
  WHERE expense_id = v_expense_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expense_items_invalidate_split_on_delete ON public.expense_items;
CREATE TRIGGER expense_items_invalidate_split_on_delete
  AFTER DELETE ON public.expense_items
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_expense_split_for_item_change();

DROP TRIGGER IF EXISTS expense_items_invalidate_split_on_amount_update ON public.expense_items;
CREATE TRIGGER expense_items_invalidate_split_on_amount_update
  AFTER UPDATE OF line_total, quantity, unit_price ON public.expense_items
  FOR EACH ROW
  WHEN (
    OLD.line_total IS DISTINCT FROM NEW.line_total
    OR OLD.quantity IS DISTINCT FROM NEW.quantity
    OR OLD.unit_price IS DISTINCT FROM NEW.unit_price
  )
  EXECUTE FUNCTION public.invalidate_expense_split_for_item_change();

CREATE OR REPLACE FUNCTION public.save_expense_split(
  p_expense_id uuid,
  p_assignments jsonb,
  p_participants jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_space_id uuid;
  v_total numeric(12, 2);
  v_tax numeric(12, 2);
  v_tip numeric(12, 2);
  v_fees numeric(12, 2);
  v_discount numeric(12, 2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT e.space_id, e.total, e.tax, e.tip, e.fees, e.discount
  INTO v_space_id, v_total, v_tax, v_tip, v_fees, v_discount
  FROM public.expenses e
  WHERE e.id = p_expense_id;

  IF v_space_id IS NULL OR (
    NOT public.is_space_member(v_space_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.spaces s
      WHERE s.id = v_space_id
        AND s.owner_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Expense not found or access denied';
  END IF;

  IF jsonb_typeof(p_assignments) <> 'array' OR jsonb_typeof(p_participants) <> 'array' THEN
    RAISE EXCEPTION 'Split payloads must be arrays';
  END IF;

  IF jsonb_array_length(p_assignments) = 0 OR jsonb_array_length(p_participants) = 0 THEN
    RAISE EXCEPTION 'Assign every receipt item before saving';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_assignments)
      AS a(expense_item_id uuid, user_id uuid, assigned_amount numeric)
    LEFT JOIN public.expense_items ei ON ei.id = a.expense_item_id
    WHERE ei.expense_id IS DISTINCT FROM p_expense_id
      OR a.user_id IS NULL
      OR a.assigned_amount IS NULL
      OR a.assigned_amount < 0
      OR (
        NOT EXISTS (
          SELECT 1
          FROM public.space_members sm
          WHERE sm.space_id = v_space_id
            AND sm.user_id = a.user_id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.spaces s
          WHERE s.id = v_space_id
            AND s.owner_id = a.user_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'Assignments contain an invalid item or Space member';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_assignments)
      AS a(expense_item_id uuid, user_id uuid, assigned_amount numeric)
    GROUP BY a.expense_item_id, a.user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate item assignments are not allowed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.expense_items ei
    LEFT JOIN (
      SELECT a.expense_item_id, sum(a.assigned_amount)::numeric(12, 2) AS assigned_total
      FROM jsonb_to_recordset(p_assignments)
        AS a(expense_item_id uuid, user_id uuid, assigned_amount numeric)
      GROUP BY a.expense_item_id
    ) assigned ON assigned.expense_item_id = ei.id
    WHERE ei.expense_id = p_expense_id
      AND assigned.assigned_total IS DISTINCT FROM ei.line_total
  ) THEN
    RAISE EXCEPTION 'Every item must be assigned exactly to its line total';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_participants)
      AS p(
        user_id uuid,
        tax_share numeric,
        tip_share numeric,
        fee_share numeric,
        discount_share numeric,
        adjustment numeric,
        total_owed numeric
      )
    WHERE p.user_id IS NULL
      OR p.tax_share IS NULL OR p.tax_share < 0
      OR p.tip_share IS NULL OR p.tip_share < 0
      OR p.fee_share IS NULL OR p.fee_share < 0
      OR p.discount_share IS NULL OR p.discount_share < 0
      OR p.adjustment IS NULL
      OR p.total_owed IS NULL OR p.total_owed < 0
      OR (
        NOT EXISTS (
          SELECT 1
          FROM public.space_members sm
          WHERE sm.space_id = v_space_id
            AND sm.user_id = p.user_id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.spaces s
          WHERE s.id = v_space_id
            AND s.owner_id = p.user_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'Participant shares contain an invalid Space member or amount';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_participants)
      AS p(
        user_id uuid,
        tax_share numeric,
        tip_share numeric,
        fee_share numeric,
        discount_share numeric,
        adjustment numeric,
        total_owed numeric
      )
    GROUP BY p.user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate participant shares are not allowed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT DISTINCT a.user_id
      FROM jsonb_to_recordset(p_assignments)
        AS a(expense_item_id uuid, user_id uuid, assigned_amount numeric)
    ) assigned_users
    FULL JOIN (
      SELECT p.user_id
      FROM jsonb_to_recordset(p_participants)
        AS p(
          user_id uuid,
          tax_share numeric,
          tip_share numeric,
          fee_share numeric,
          discount_share numeric,
          adjustment numeric,
          total_owed numeric
        )
    ) participant_users USING (user_id)
    WHERE assigned_users.user_id IS NULL OR participant_users.user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Participants must match the assigned members';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_participants)
      AS p(
        user_id uuid,
        tax_share numeric,
        tip_share numeric,
        fee_share numeric,
        discount_share numeric,
        adjustment numeric,
        total_owed numeric
      )
    LEFT JOIN (
      SELECT a.user_id, sum(a.assigned_amount)::numeric(12, 2) AS item_subtotal
      FROM jsonb_to_recordset(p_assignments)
        AS a(expense_item_id uuid, user_id uuid, assigned_amount numeric)
      GROUP BY a.user_id
    ) assigned USING (user_id)
    WHERE p.total_owed IS DISTINCT FROM (
      assigned.item_subtotal
      + p.tax_share
      + p.tip_share
      + p.fee_share
      - p.discount_share
      + p.adjustment
    )::numeric(12, 2)
  ) THEN
    RAISE EXCEPTION 'A participant total does not match its item and receipt shares';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT
        sum(p.tax_share)::numeric(12, 2) AS tax_total,
        sum(p.tip_share)::numeric(12, 2) AS tip_total,
        sum(p.fee_share)::numeric(12, 2) AS fee_total,
        sum(p.discount_share)::numeric(12, 2) AS discount_total,
        sum(p.adjustment)::numeric(12, 2) AS adjustment_total,
        sum(p.total_owed)::numeric(12, 2) AS owed_total
      FROM jsonb_to_recordset(p_participants)
        AS p(
          user_id uuid,
          tax_share numeric,
          tip_share numeric,
          fee_share numeric,
          discount_share numeric,
          adjustment numeric,
          total_owed numeric
        )
    ) totals
    WHERE totals.tax_total IS DISTINCT FROM v_tax
      OR totals.tip_total IS DISTINCT FROM v_tip
      OR totals.fee_total IS DISTINCT FROM v_fees
      OR totals.discount_total IS DISTINCT FROM v_discount
      OR totals.adjustment_total IS DISTINCT FROM (
        v_total
        - (
          SELECT coalesce(sum(ei.line_total), 0)
          FROM public.expense_items ei
          WHERE ei.expense_id = p_expense_id
        )
        - v_tax
        - v_tip
        - v_fees
        + v_discount
      )::numeric(12, 2)
      OR totals.owed_total IS DISTINCT FROM v_total
  ) THEN
    RAISE EXCEPTION 'Participant shares do not reconcile to the receipt total';
  END IF;

  DELETE FROM public.expense_item_assignments
  WHERE expense_item_id IN (
    SELECT id FROM public.expense_items WHERE expense_id = p_expense_id
  );

  INSERT INTO public.expense_item_assignments (
    expense_item_id,
    user_id,
    share_type,
    share_value,
    assigned_amount,
    claimed_by_user
  )
  SELECT
    a.expense_item_id,
    a.user_id,
    'equal',
    1,
    a.assigned_amount,
    false
  FROM jsonb_to_recordset(p_assignments)
    AS a(expense_item_id uuid, user_id uuid, assigned_amount numeric);

  DELETE FROM public.expense_participants
  WHERE expense_id = p_expense_id;

  INSERT INTO public.expense_participants (
    expense_id,
    user_id,
    tax_share,
    tip_share,
    fee_share,
    discount_share,
    total_owed
  )
  SELECT
    p_expense_id,
    p.user_id,
    p.tax_share,
    p.tip_share,
    p.fee_share,
    p.discount_share,
    p.total_owed
  FROM jsonb_to_recordset(p_participants)
    AS p(
      user_id uuid,
      tax_share numeric,
      tip_share numeric,
      fee_share numeric,
      discount_share numeric,
      adjustment numeric,
      total_owed numeric
    );
END;
$$;

REVOKE ALL ON FUNCTION public.save_expense_split(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_expense_split(uuid, jsonb, jsonb) TO authenticated;

COMMENT ON FUNCTION public.save_expense_split(uuid, jsonb, jsonb)
IS 'Atomically validates and saves a fully assigned expense split for a Space member.';
