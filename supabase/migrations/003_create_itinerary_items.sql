-- Peak itinerary items (requires public.is_space_owner(uuid) and public.is_space_member(uuid))

CREATE TABLE IF NOT EXISTS public.itinerary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  event_date date NOT NULL,
  start_time time,
  end_time time,
  category text NOT NULL DEFAULT 'activity',
  status text NOT NULL DEFAULT 'planned',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT itinerary_items_category_check CHECK (
    category IN (
      'flight',
      'lodging',
      'food',
      'activity',
      'transportation',
      'reservation',
      'other'
    )
  ),
  CONSTRAINT itinerary_items_status_check CHECK (
    status IN ('idea', 'planned', 'booked', 'completed')
  )
);

CREATE INDEX IF NOT EXISTS itinerary_items_space_id_idx
  ON public.itinerary_items (space_id);

CREATE INDEX IF NOT EXISTS itinerary_items_event_date_idx
  ON public.itinerary_items (event_date);

CREATE INDEX IF NOT EXISTS itinerary_items_space_date_sort_idx
  ON public.itinerary_items (space_id, event_date, sort_order);

CREATE OR REPLACE FUNCTION public.set_itinerary_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS itinerary_items_set_updated_at ON public.itinerary_items;

CREATE TRIGGER itinerary_items_set_updated_at
  BEFORE UPDATE ON public.itinerary_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_itinerary_items_updated_at();

ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "itinerary_items_select_member" ON public.itinerary_items;
CREATE POLICY "itinerary_items_select_member"
  ON public.itinerary_items
  FOR SELECT
  TO authenticated
  USING (public.is_space_member(space_id));

DROP POLICY IF EXISTS "itinerary_items_insert_member" ON public.itinerary_items;
CREATE POLICY "itinerary_items_insert_member"
  ON public.itinerary_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_space_member(space_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "itinerary_items_update_manager" ON public.itinerary_items;
CREATE POLICY "itinerary_items_update_manager"
  ON public.itinerary_items
  FOR UPDATE
  TO authenticated
  USING (
    public.is_space_member(space_id)
    AND (
      created_by = auth.uid()
      OR public.is_space_owner(space_id)
    )
  )
  WITH CHECK (
    public.is_space_member(space_id)
    AND (
      created_by = auth.uid()
      OR public.is_space_owner(space_id)
    )
  );

DROP POLICY IF EXISTS "itinerary_items_delete_manager" ON public.itinerary_items;
CREATE POLICY "itinerary_items_delete_manager"
  ON public.itinerary_items
  FOR DELETE
  TO authenticated
  USING (
    public.is_space_member(space_id)
    AND (
      created_by = auth.uid()
      OR public.is_space_owner(space_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.itinerary_items TO authenticated;
