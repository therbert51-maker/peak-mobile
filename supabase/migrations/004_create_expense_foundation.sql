-- Peak Expenses — Branch 1: database foundation
-- Requires: public.is_space_owner(uuid), public.is_space_member(uuid)

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Path convention: {user_id}/{space_id}/{expense_id}/{filename}
CREATE OR REPLACE FUNCTION public.receipt_storage_space_id(object_path text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parts text[];
BEGIN
  parts := string_to_array(object_path, '/');
  IF parts IS NULL OR array_length(parts, 1) < 2 THEN
    RETURN NULL;
  END IF;
  RETURN parts[2]::uuid;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  merchant_name text,
  expense_title text NOT NULL,
  expense_date date,
  original_currency text NOT NULL DEFAULT 'USD',
  display_currency text,
  subtotal numeric(12, 2),
  tax numeric(12, 2) NOT NULL DEFAULT 0,
  tip numeric(12, 2) NOT NULL DEFAULT 0,
  fees numeric(12, 2) NOT NULL DEFAULT 0,
  discount numeric(12, 2) NOT NULL DEFAULT 0,
  total numeric(12, 2) NOT NULL,
  exchange_rate numeric(18, 8),
  exchange_rate_date date,
  receipt_image_path text,
  receipt_status text NOT NULL DEFAULT 'manual',
  processing_error text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expenses_original_currency_upper CHECK (original_currency = upper(original_currency)),
  CONSTRAINT expenses_display_currency_upper CHECK (
    display_currency IS NULL OR display_currency = upper(display_currency)
  ),
  CONSTRAINT expenses_receipt_status_check CHECK (
    receipt_status IN (
      'manual',
      'uploaded',
      'processing',
      'needs_review',
      'ready',
      'failed'
    )
  ),
  CONSTRAINT expenses_subtotal_nonneg CHECK (subtotal IS NULL OR subtotal >= 0),
  CONSTRAINT expenses_tax_nonneg CHECK (tax >= 0),
  CONSTRAINT expenses_tip_nonneg CHECK (tip >= 0),
  CONSTRAINT expenses_fees_nonneg CHECK (fees >= 0),
  CONSTRAINT expenses_total_nonneg CHECK (total >= 0)
);

CREATE TABLE IF NOT EXISTS public.expense_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity numeric(10, 3) NOT NULL DEFAULT 1,
  unit_price numeric(12, 2),
  line_total numeric(12, 2) NOT NULL,
  category text,
  sort_order integer NOT NULL DEFAULT 0,
  source_text text,
  confidence numeric(5, 4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT expense_items_line_total_nonneg CHECK (line_total >= 0),
  CONSTRAINT expense_items_unit_price_nonneg CHECK (unit_price IS NULL OR unit_price >= 0),
  CONSTRAINT expense_items_confidence_range CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
  )
);

CREATE TABLE IF NOT EXISTS public.expense_item_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_item_id uuid NOT NULL REFERENCES public.expense_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_type text NOT NULL DEFAULT 'equal',
  share_value numeric(12, 4) NOT NULL DEFAULT 1,
  assigned_amount numeric(12, 2),
  claimed_by_user boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_item_assignments_unique_user UNIQUE (expense_item_id, user_id),
  CONSTRAINT expense_item_assignments_share_type_check CHECK (
    share_type IN ('equal', 'quantity', 'percentage', 'fixed')
  ),
  CONSTRAINT expense_item_assignments_share_value_positive CHECK (share_value > 0),
  CONSTRAINT expense_item_assignments_percentage_cap CHECK (
    share_type <> 'percentage' OR share_value <= 100
  ),
  CONSTRAINT expense_item_assignments_assigned_amount_nonneg CHECK (
    assigned_amount IS NULL OR assigned_amount >= 0
  )
);

CREATE TABLE IF NOT EXISTS public.expense_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tax_share numeric(12, 2) NOT NULL DEFAULT 0,
  tip_share numeric(12, 2) NOT NULL DEFAULT 0,
  fee_share numeric(12, 2) NOT NULL DEFAULT 0,
  discount_share numeric(12, 2) NOT NULL DEFAULT 0,
  total_owed numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_participants_unique_user UNIQUE (expense_id, user_id),
  CONSTRAINT expense_participants_tax_share_nonneg CHECK (tax_share >= 0),
  CONSTRAINT expense_participants_tip_share_nonneg CHECK (tip_share >= 0),
  CONSTRAINT expense_participants_fee_share_nonneg CHECK (fee_share >= 0),
  CONSTRAINT expense_participants_total_owed_nonneg CHECK (total_owed >= 0)
);

CREATE TABLE IF NOT EXISTS public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  external_reference text,
  note text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settlements_currency_upper CHECK (currency = upper(currency)),
  CONSTRAINT settlements_status_check CHECK (
    status IN ('pending', 'paid', 'cancelled')
  ),
  CONSTRAINT settlements_amount_positive CHECK (amount > 0),
  CONSTRAINT settlements_distinct_users CHECK (from_user_id <> to_user_id)
);

CREATE TABLE IF NOT EXISTS public.receipt_processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL UNIQUE REFERENCES public.expenses(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  provider text,
  model text,
  attempt_count integer NOT NULL DEFAULT 0,
  extracted_payload jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receipt_processing_jobs_status_check CHECK (
    status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT receipt_processing_jobs_attempt_count_nonneg CHECK (attempt_count >= 0)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS expenses_space_id_idx ON public.expenses (space_id);
CREATE INDEX IF NOT EXISTS expenses_created_by_idx ON public.expenses (created_by);
CREATE INDEX IF NOT EXISTS expenses_paid_by_idx ON public.expenses (paid_by);
CREATE INDEX IF NOT EXISTS expenses_expense_date_idx ON public.expenses (expense_date);
CREATE INDEX IF NOT EXISTS expenses_receipt_status_idx ON public.expenses (receipt_status);
CREATE INDEX IF NOT EXISTS expenses_space_date_idx ON public.expenses (space_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS expense_items_expense_id_idx ON public.expense_items (expense_id);
CREATE INDEX IF NOT EXISTS expense_items_expense_sort_idx ON public.expense_items (expense_id, sort_order);

CREATE INDEX IF NOT EXISTS expense_item_assignments_item_idx
  ON public.expense_item_assignments (expense_item_id);
CREATE INDEX IF NOT EXISTS expense_item_assignments_user_idx
  ON public.expense_item_assignments (user_id);

CREATE INDEX IF NOT EXISTS expense_participants_expense_id_idx
  ON public.expense_participants (expense_id);
CREATE INDEX IF NOT EXISTS expense_participants_user_id_idx
  ON public.expense_participants (user_id);

CREATE INDEX IF NOT EXISTS settlements_space_id_idx ON public.settlements (space_id);
CREATE INDEX IF NOT EXISTS settlements_from_user_idx ON public.settlements (from_user_id);
CREATE INDEX IF NOT EXISTS settlements_to_user_idx ON public.settlements (to_user_id);
CREATE INDEX IF NOT EXISTS settlements_status_idx ON public.settlements (status);
CREATE INDEX IF NOT EXISTS settlements_space_status_idx ON public.settlements (space_id, status);

CREATE INDEX IF NOT EXISTS receipt_processing_jobs_expense_id_idx
  ON public.receipt_processing_jobs (expense_id);
CREATE INDEX IF NOT EXISTS receipt_processing_jobs_status_idx
  ON public.receipt_processing_jobs (status);
CREATE INDEX IF NOT EXISTS receipt_processing_jobs_requested_by_idx
  ON public.receipt_processing_jobs (requested_by);

-- ---------------------------------------------------------------------------
-- Security definer helpers (avoid recursive RLS; run after tables exist)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.expense_space_id(p_expense_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.space_id FROM public.expenses e WHERE e.id = p_expense_id;
$$;

CREATE OR REPLACE FUNCTION public.can_access_expense(p_expense_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_space_member(
    (SELECT e.space_id FROM public.expenses e WHERE e.id = p_expense_id)
  );
$$;

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
      AND (
        e.created_by = auth.uid()
        OR public.is_space_owner(e.space_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.expense_item_expense_id(p_expense_item_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ei.expense_id
  FROM public.expense_items ei
  WHERE ei.id = p_expense_item_id;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_expense_item(p_expense_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_manage_expense(public.expense_item_expense_id(p_expense_item_id));
$$;

CREATE OR REPLACE FUNCTION public.can_manage_assignment(
  p_expense_item_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_manage_expense(public.expense_item_expense_id(p_expense_item_id))
    OR p_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_read_settlement(p_settlement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.settlements s
    WHERE s.id = p_settlement_id
      AND public.is_space_member(s.space_id)
      AND (
        s.from_user_id = auth.uid()
        OR s.to_user_id = auth.uid()
        OR s.created_by = auth.uid()
        OR public.is_space_owner(s.space_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_settlement(p_settlement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.settlements s
    WHERE s.id = p_settlement_id
      AND public.is_space_member(s.space_id)
      AND (
        s.created_by = auth.uid()
        OR s.from_user_id = auth.uid()
        OR s.to_user_id = auth.uid()
        OR public.is_space_owner(s.space_id)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS expenses_touch_updated_at ON public.expenses;
CREATE TRIGGER expenses_touch_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS expense_items_touch_updated_at ON public.expense_items;
CREATE TRIGGER expense_items_touch_updated_at
  BEFORE UPDATE ON public.expense_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS expense_item_assignments_touch_updated_at ON public.expense_item_assignments;
CREATE TRIGGER expense_item_assignments_touch_updated_at
  BEFORE UPDATE ON public.expense_item_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS expense_participants_touch_updated_at ON public.expense_participants;
CREATE TRIGGER expense_participants_touch_updated_at
  BEFORE UPDATE ON public.expense_participants
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS receipt_processing_jobs_touch_updated_at ON public.receipt_processing_jobs;
CREATE TRIGGER receipt_processing_jobs_touch_updated_at
  BEFORE UPDATE ON public.receipt_processing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_item_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_processing_jobs ENABLE ROW LEVEL SECURITY;

-- expenses
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
CREATE POLICY expenses_update_manager ON public.expenses
  FOR UPDATE TO authenticated
  USING (public.can_manage_expense(id))
  WITH CHECK (public.can_manage_expense(id));

DROP POLICY IF EXISTS expenses_delete_manager ON public.expenses;
CREATE POLICY expenses_delete_manager ON public.expenses
  FOR DELETE TO authenticated
  USING (public.can_manage_expense(id));

-- expense_items
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

-- expense_item_assignments
DROP POLICY IF EXISTS expense_item_assignments_select ON public.expense_item_assignments;
CREATE POLICY expense_item_assignments_select ON public.expense_item_assignments
  FOR SELECT TO authenticated
  USING (public.can_access_expense(public.expense_item_expense_id(expense_item_id)));

DROP POLICY IF EXISTS expense_item_assignments_insert ON public.expense_item_assignments;
CREATE POLICY expense_item_assignments_insert ON public.expense_item_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_assignment(expense_item_id, user_id)
  );

DROP POLICY IF EXISTS expense_item_assignments_update ON public.expense_item_assignments;
CREATE POLICY expense_item_assignments_update ON public.expense_item_assignments
  FOR UPDATE TO authenticated
  USING (public.can_manage_assignment(expense_item_id, user_id))
  WITH CHECK (public.can_manage_assignment(expense_item_id, user_id));

DROP POLICY IF EXISTS expense_item_assignments_delete ON public.expense_item_assignments;
CREATE POLICY expense_item_assignments_delete ON public.expense_item_assignments
  FOR DELETE TO authenticated
  USING (public.can_manage_assignment(expense_item_id, user_id));

-- expense_participants
DROP POLICY IF EXISTS expense_participants_select ON public.expense_participants;
CREATE POLICY expense_participants_select ON public.expense_participants
  FOR SELECT TO authenticated
  USING (public.can_access_expense(expense_id));

DROP POLICY IF EXISTS expense_participants_insert ON public.expense_participants;
CREATE POLICY expense_participants_insert ON public.expense_participants
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_expense(expense_id));

DROP POLICY IF EXISTS expense_participants_update ON public.expense_participants;
CREATE POLICY expense_participants_update ON public.expense_participants
  FOR UPDATE TO authenticated
  USING (public.can_manage_expense(expense_id))
  WITH CHECK (public.can_manage_expense(expense_id));

DROP POLICY IF EXISTS expense_participants_delete ON public.expense_participants;
CREATE POLICY expense_participants_delete ON public.expense_participants
  FOR DELETE TO authenticated
  USING (public.can_manage_expense(expense_id));

-- settlements
DROP POLICY IF EXISTS settlements_select ON public.settlements;
CREATE POLICY settlements_select ON public.settlements
  FOR SELECT TO authenticated
  USING (public.can_read_settlement(id));

DROP POLICY IF EXISTS settlements_insert ON public.settlements;
CREATE POLICY settlements_insert ON public.settlements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_space_member(space_id)
    AND created_by = auth.uid()
    AND from_user_id <> to_user_id
  );

DROP POLICY IF EXISTS settlements_update ON public.settlements;
CREATE POLICY settlements_update ON public.settlements
  FOR UPDATE TO authenticated
  USING (public.can_manage_settlement(id))
  WITH CHECK (public.can_manage_settlement(id));

DROP POLICY IF EXISTS settlements_delete ON public.settlements;
CREATE POLICY settlements_delete ON public.settlements
  FOR DELETE TO authenticated
  USING (public.can_manage_settlement(id));

-- receipt_processing_jobs
DROP POLICY IF EXISTS receipt_processing_jobs_select ON public.receipt_processing_jobs;
CREATE POLICY receipt_processing_jobs_select ON public.receipt_processing_jobs
  FOR SELECT TO authenticated
  USING (public.can_access_expense(expense_id));

DROP POLICY IF EXISTS receipt_processing_jobs_insert ON public.receipt_processing_jobs;
CREATE POLICY receipt_processing_jobs_insert ON public.receipt_processing_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_expense(expense_id)
    AND requested_by = auth.uid()
  );

DROP POLICY IF EXISTS receipt_processing_jobs_update ON public.receipt_processing_jobs;
CREATE POLICY receipt_processing_jobs_update ON public.receipt_processing_jobs
  FOR UPDATE TO authenticated
  USING (public.can_manage_expense(expense_id))
  WITH CHECK (public.can_manage_expense(expense_id));

DROP POLICY IF EXISTS receipt_processing_jobs_delete ON public.receipt_processing_jobs;
CREATE POLICY receipt_processing_jobs_delete ON public.receipt_processing_jobs
  FOR DELETE TO authenticated
  USING (public.can_manage_expense(expense_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_item_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipt_processing_jobs TO authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private receipt-images bucket
-- Object path: {user_id}/{space_id}/{expense_id}/{filename}
-- AI provider keys must live in Edge Functions / server secrets only.
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipt-images',
  'receipt-images',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS receipt_images_insert_own ON storage.objects;
CREATE POLICY receipt_images_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipt-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS receipt_images_update_own ON storage.objects;
CREATE POLICY receipt_images_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipt-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'receipt-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS receipt_images_delete_own ON storage.objects;
CREATE POLICY receipt_images_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipt-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS receipt_images_select_member ON storage.objects;
CREATE POLICY receipt_images_select_member ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipt-images'
    AND public.is_space_member(public.receipt_storage_space_id(name))
  );

COMMENT ON TABLE public.expenses IS 'Space-scoped shared expenses; receipt scan pipeline hooks via receipt_processing_jobs';
COMMENT ON TABLE public.expense_items IS 'Line items for itemized splitting';
COMMENT ON TABLE public.expense_item_assignments IS 'Per-user shares/claims on line items';
COMMENT ON TABLE public.expense_participants IS 'Aggregated tax/tip/fee/total owed per user per expense';
COMMENT ON TABLE public.settlements IS 'Recorded payments between members within a space';
COMMENT ON TABLE public.receipt_processing_jobs IS 'Async OCR/AI receipt extraction jobs (server-side workers only)';
