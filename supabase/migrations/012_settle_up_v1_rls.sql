-- Settle Up v1: secure completed-payment history using public.settlements.
-- The table already exists from migration 004; this migration only tightens RLS.

CREATE OR REPLACE FUNCTION public.is_space_user_member(
  p_space_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.spaces s
    WHERE s.id = p_space_id
      AND s.owner_id = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.space_members sm
    WHERE sm.space_id = p_space_id
      AND sm.user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_space_user_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_space_user_member(uuid, uuid) TO authenticated;

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- Every Space member may read completed payments for the trip.
DROP POLICY IF EXISTS settlements_select ON public.settlements;
CREATE POLICY settlements_select ON public.settlements
  FOR SELECT TO authenticated
  USING (
    public.is_space_member(space_id)
    OR public.is_space_owner(space_id)
  );

-- A Space member may record a completed payment only between two members of
-- that same Space. created_by must always be the authenticated user.
DROP POLICY IF EXISTS settlements_insert ON public.settlements;
CREATE POLICY settlements_insert ON public.settlements
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_space_member(space_id) OR public.is_space_owner(space_id))
    AND created_by = auth.uid()
    AND public.is_space_user_member(space_id, from_user_id)
    AND public.is_space_user_member(space_id, to_user_id)
    AND from_user_id <> to_user_id
    AND status = 'paid'
    AND settled_at IS NOT NULL
  );

-- v1 has no edit, undo, or delete flow.
DROP POLICY IF EXISTS settlements_update ON public.settlements;
DROP POLICY IF EXISTS settlements_delete ON public.settlements;

REVOKE UPDATE, DELETE ON public.settlements FROM authenticated;
GRANT SELECT, INSERT ON public.settlements TO authenticated;

COMMENT ON TABLE public.settlements
IS 'Space-level settlement payments; trip balances remain derived from finalized expense splits minus paid settlements.';
