BEGIN;

-- Settings + User Profile v1.
-- Extend the existing public.profiles table; do not duplicate Auth email.
--
-- Requires (already deployed):
--   public.is_space_member(uuid)
--   public.is_space_owner(uuid)
--   public.is_space_user_member(uuid, uuid)  -- migration 012
--   public.touch_updated_at()
--
-- Does NOT recreate profiles, auth helpers, or receipt storage policies.

-- ---------------------------------------------------------------------------
-- Storage: public-read profile avatars, user-scoped writes
-- Path convention: {user_id}/avatar
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS profile_avatars_insert_own ON storage.objects;
CREATE POLICY profile_avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS profile_avatars_select_own ON storage.objects;
CREATE POLICY profile_avatars_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS profile_avatars_update_own ON storage.objects;
CREATE POLICY profile_avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS profile_avatars_delete_own ON storage.objects;
CREATE POLICY profile_avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Profiles schema extensions (additive only)
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS preferred_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Preserve existing names when a deployed schema already has full_name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'full_name'
  ) THEN
    EXECUTE $sql$
      UPDATE public.profiles
      SET display_name = NULLIF(BTRIM(full_name), '')
      WHERE display_name IS NULL
        AND NULLIF(BTRIM(full_name), '') IS NOT NULL
    $sql$;
  END IF;
END
$$;

UPDATE public.profiles
SET preferred_currency = 'USD'
WHERE preferred_currency IS NULL
   OR BTRIM(preferred_currency) = ''
   OR preferred_currency NOT IN ('USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF');

ALTER TABLE public.profiles
  ALTER COLUMN preferred_currency SET DEFAULT 'USD';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'preferred_currency'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.profiles
      ALTER COLUMN preferred_currency SET NOT NULL;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_preferred_currency_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_currency_check
      CHECK (preferred_currency IN ('USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF'));
  END IF;
END
$$;

-- Reuse the existing touch_updated_at trigger function from migration 004.
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Profiles RLS (additive; does not drop unrelated existing policies)
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Read own profile, or profiles of members in Spaces you can access.
-- Preserves member-name display in Spaces, Split, and Settle Up.
DROP POLICY IF EXISTS profiles_self_select ON public.profiles;
DROP POLICY IF EXISTS profiles_select_space_peers ON public.profiles;
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.spaces s
      WHERE (public.is_space_member(s.id) OR public.is_space_owner(s.id))
        AND public.is_space_user_member(s.id, profiles.id)
    )
  );

DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
CREATE POLICY profiles_self_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

COMMIT;
