BEGIN;

-- Social Inspo Preview v1.
-- Adds optional, persisted link metadata to the existing inspiration table.
-- Existing inspiration rows and existing RLS policies are preserved.

ALTER TABLE public.inspiration
  ADD COLUMN IF NOT EXISTS normalized_url text,
  ADD COLUMN IF NOT EXISTS preview_title text,
  ADD COLUMN IF NOT EXISTS preview_description text,
  ADD COLUMN IF NOT EXISTS preview_image_url text,
  ADD COLUMN IF NOT EXISTS preview_source text,
  ADD COLUMN IF NOT EXISTS preview_kind text,
  ADD COLUMN IF NOT EXISTS preview_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS preview_fetched_at timestamptz;

UPDATE public.inspiration
SET preview_status = 'skipped'
WHERE NULLIF(BTRIM(url), '') IS NULL
  AND preview_status = 'pending'
  AND normalized_url IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inspiration_preview_kind_check'
      AND conrelid = 'public.inspiration'::regclass
  ) THEN
    ALTER TABLE public.inspiration
      ADD CONSTRAINT inspiration_preview_kind_check
      CHECK (
        preview_kind IS NULL
        OR preview_kind IN ('video', 'image', 'article', 'website')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inspiration_preview_status_check'
      AND conrelid = 'public.inspiration'::regclass
  ) THEN
    ALTER TABLE public.inspiration
      ADD CONSTRAINT inspiration_preview_status_check
      CHECK (preview_status IN ('pending', 'processing', 'ready', 'failed', 'skipped'));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.reset_inspiration_preview_on_url_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.preview_status = CASE
      WHEN NULLIF(BTRIM(NEW.url), '') IS NULL THEN 'skipped'
      ELSE 'pending'
    END;
  ELSIF NEW.url IS DISTINCT FROM OLD.url THEN
    NEW.normalized_url = NULL;
    NEW.preview_title = NULL;
    NEW.preview_description = NULL;
    NEW.preview_image_url = NULL;
    NEW.preview_source = NULL;
    NEW.preview_kind = NULL;
    NEW.preview_fetched_at = NULL;
    NEW.preview_status = CASE
      WHEN NULLIF(BTRIM(NEW.url), '') IS NULL THEN 'skipped'
      ELSE 'pending'
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inspiration_reset_preview_on_url_change ON public.inspiration;
CREATE TRIGGER inspiration_reset_preview_on_url_change
  BEFORE INSERT OR UPDATE OF url ON public.inspiration
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_inspiration_preview_on_url_change();

COMMENT ON COLUMN public.inspiration.normalized_url
IS 'Server-normalized URL used to identify the metadata currently stored on this row.';
COMMENT ON COLUMN public.inspiration.preview_status
IS 'Best-effort preview lifecycle; failures never invalidate the saved inspiration.';

COMMIT;
