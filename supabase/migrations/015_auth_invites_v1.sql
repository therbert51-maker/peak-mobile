BEGIN;

-- Auth + Invite + Join v1.
-- Adds profile creation for new Auth users and secure, email-specific Space invites.
-- Existing profiles, Spaces, memberships, users, and RLS policies are preserved.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Profiles: guarantee one public row for every newly-created Auth user.
-- Names arrive through signUp options.data. Auth email remains in auth.users.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_peak_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_first_name text := NULLIF(BTRIM(LEFT(COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''), 80)), '');
  v_last_name text := NULLIF(BTRIM(LEFT(COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''), 80)), '');
  v_display_name text := NULLIF(
    BTRIM(
      LEFT(
        COALESCE(
          NEW.raw_user_meta_data ->> 'display_name',
          CONCAT_WS(' ', v_first_name, v_last_name)
        ),
        100
      )
    ),
    ''
  );
BEGIN
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    display_name
  )
  VALUES (
    NEW.id,
    v_first_name,
    v_last_name,
    v_display_name
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = COALESCE(public.profiles.first_name, EXCLUDED.first_name),
    last_name = COALESCE(public.profiles.last_name, EXCLUDED.last_name),
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS peak_auth_user_profile_created ON auth.users;
CREATE TRIGGER peak_auth_user_profile_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_peak_auth_user_created();

REVOKE ALL ON FUNCTION public.handle_peak_auth_user_created() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Invite storage.
-- Tokens are 256-bit random bearer credentials. Direct table access is limited
-- to Space managers; invite validation always happens through RPCs.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.space_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT space_invites_email_check
    CHECK (
      invited_email = LOWER(BTRIM(invited_email))
      AND invited_email LIKE '%_@_%._%'
      AND CHAR_LENGTH(invited_email) <= 320
    ),
  CONSTRAINT space_invites_status_check
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  CONSTRAINT space_invites_acceptance_check
    CHECK (
      (status = 'accepted' AND accepted_by IS NOT NULL AND accepted_at IS NOT NULL)
      OR status <> 'accepted'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS space_invites_pending_email_unique
  ON public.space_invites (space_id, LOWER(invited_email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS space_invites_space_status_idx
  ON public.space_invites (space_id, status, created_at DESC);

ALTER TABLE public.space_invites ENABLE ROW LEVEL SECURITY;

-- Supports the existing owner model and a future captain role without changing
-- how current owner/member rows are interpreted elsewhere in Peak.
CREATE OR REPLACE FUNCTION public.can_manage_space_invites(p_space_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.spaces s
        WHERE s.id = p_space_id
          AND s.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.space_members sm
        WHERE sm.space_id = p_space_id
          AND sm.user_id = auth.uid()
          AND sm.role IN ('owner', 'captain')
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_space_invites(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_space_invites(uuid) TO authenticated;

DROP POLICY IF EXISTS space_invites_select_manager ON public.space_invites;
CREATE POLICY space_invites_select_manager ON public.space_invites
  FOR SELECT TO authenticated
  USING (public.can_manage_space_invites(space_id));

REVOKE ALL ON public.space_invites FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.space_invites FROM authenticated;
GRANT SELECT ON public.space_invites TO authenticated;

-- ---------------------------------------------------------------------------
-- Owner/captain invite creation. Repeated requests for the same active email
-- return the existing invite and token instead of creating duplicates.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_space_invite(
  p_space_id uuid,
  p_invited_email text
)
RETURNS TABLE (
  id uuid,
  space_id uuid,
  invited_email text,
  token text,
  status text,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text := LOWER(BTRIM(COALESCE(p_invited_email, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.can_manage_space_invites(p_space_id) THEN
    RAISE EXCEPTION 'Only the trip owner or captain can invite people.';
  END IF;

  IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR CHAR_LENGTH(v_email) > 320 THEN
    RAISE EXCEPTION 'Enter a valid email address.';
  END IF;

  UPDATE public.space_invites si
  SET status = 'expired'
  WHERE si.space_id = p_space_id
    AND si.invited_email = v_email
    AND si.status = 'pending'
    AND si.expires_at <= now();

  RETURN QUERY
  SELECT
    si.id,
    si.space_id,
    si.invited_email,
    si.token,
    si.status,
    si.created_at,
    si.expires_at
  FROM public.space_invites si
  WHERE si.space_id = p_space_id
    AND si.invited_email = v_email
    AND si.status = 'pending'
    AND si.expires_at > now()
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.space_invites (
    space_id,
    invited_email,
    invited_by
  )
  VALUES (
    p_space_id,
    v_email,
    auth.uid()
  )
  ON CONFLICT DO NOTHING
  RETURNING
    space_invites.id,
    space_invites.space_id,
    space_invites.invited_email,
    space_invites.token,
    space_invites.status,
    space_invites.created_at,
    space_invites.expires_at;

  IF FOUND THEN
    RETURN;
  END IF;

  -- A concurrent request may have won the pending-email race.
  RETURN QUERY
  SELECT
    si.id,
    si.space_id,
    si.invited_email,
    si.token,
    si.status,
    si.created_at,
    si.expires_at
  FROM public.space_invites si
  WHERE si.space_id = p_space_id
    AND si.invited_email = v_email
    AND si.status = 'pending'
    AND si.expires_at > now()
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.create_space_invite(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_space_invite(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Safe invite preview. This is the only invite operation available to anon.
-- It intentionally exposes no itinerary, expenses, members, or raw email.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_space_invite(p_token text)
RETURNS TABLE (
  invite_id uuid,
  status text,
  expires_at timestamptz,
  invited_email_hint text,
  space_name text,
  destination text,
  start_date date,
  end_date date,
  invited_by_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.space_invites si
  SET status = 'expired'
  WHERE si.token = BTRIM(COALESCE(p_token, ''))
    AND si.status = 'pending'
    AND si.expires_at <= now();

  RETURN QUERY
  SELECT
    si.id,
    si.status,
    si.expires_at,
    CASE
      WHEN POSITION('@' IN si.invited_email) > 1 THEN
        LEFT(si.invited_email, 1)
        || '***@'
        || SPLIT_PART(si.invited_email, '@', 2)
      ELSE 'Invited traveler'
    END,
    s.name,
    s.destination,
    s.start_date,
    s.end_date,
    COALESCE(
      NULLIF(BTRIM(p.display_name), ''),
      NULLIF(BTRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
      'A Peak traveler'
    )
  FROM public.space_invites si
  JOIN public.spaces s ON s.id = si.space_id
  LEFT JOIN public.profiles p ON p.id = si.invited_by
  WHERE si.token = BTRIM(COALESCE(p_token, ''))
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_space_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_space_invite(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Atomic acceptance: lock invite, validate Auth email, add membership once,
-- and mark the invite accepted in the same transaction.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_space_invite(p_token text)
RETURNS TABLE (
  space_id uuid,
  outcome text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite public.space_invites%ROWTYPE;
  v_auth_email text;
  v_already_member boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT LOWER(BTRIM(au.email))
  INTO v_auth_email
  FROM auth.users au
  WHERE au.id = auth.uid();

  SELECT si.*
  INTO v_invite
  FROM public.space_invites si
  WHERE si.token = BTRIM(COALESCE(p_token, ''))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This invite link is invalid.';
  END IF;

  IF v_invite.status = 'revoked' THEN
    RAISE EXCEPTION 'This invite has been revoked.';
  END IF;

  IF v_auth_email IS NULL OR v_auth_email <> v_invite.invited_email THEN
    RAISE EXCEPTION 'Sign in with the email address this invite was sent to.';
  END IF;

  SELECT public.is_space_user_member(v_invite.space_id, auth.uid())
  INTO v_already_member;

  IF v_invite.status = 'accepted' THEN
    IF v_invite.accepted_by = auth.uid() OR v_already_member THEN
      RETURN QUERY SELECT v_invite.space_id, 'already_member'::text;
      RETURN;
    END IF;
    RAISE EXCEPTION 'This invite has already been accepted.';
  END IF;

  IF v_invite.status = 'expired' OR v_invite.expires_at <= now() THEN
    UPDATE public.space_invites
    SET status = 'expired'
    WHERE id = v_invite.id
      AND status = 'pending';
    RAISE EXCEPTION 'This invite has expired.';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'This invite is no longer available.';
  END IF;

  IF NOT v_already_member THEN
    INSERT INTO public.space_members (space_id, user_id, role)
    SELECT v_invite.space_id, auth.uid(), 'member'
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.space_members sm
      WHERE sm.space_id = v_invite.space_id
        AND sm.user_id = auth.uid()
    );
  END IF;

  UPDATE public.space_invites
  SET
    status = 'accepted',
    accepted_by = auth.uid(),
    accepted_at = now()
  WHERE id = v_invite.id;

  RETURN QUERY
  SELECT
    v_invite.space_id,
    CASE WHEN v_already_member THEN 'already_member' ELSE 'joined' END::text;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_space_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_space_invite(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_space_invite(p_invite_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_space_id uuid;
BEGIN
  SELECT si.space_id
  INTO v_space_id
  FROM public.space_invites si
  WHERE si.id = p_invite_id;

  IF v_space_id IS NULL OR NOT public.can_manage_space_invites(v_space_id) THEN
    RAISE EXCEPTION 'Invite not found or access denied.';
  END IF;

  UPDATE public.space_invites
  SET
    status = 'revoked',
    revoked_at = now()
  WHERE id = p_invite_id
    AND status = 'pending';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_space_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_space_invite(uuid) TO authenticated;

COMMENT ON TABLE public.space_invites
IS 'Email-specific, owner-managed Space invites. space_members remains authoritative after acceptance.';

COMMIT;
