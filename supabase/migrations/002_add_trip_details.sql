-- Trip details columns for public.spaces (Peak shared spaces / trip planning)

ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS airport text,
  ADD COLUMN IF NOT EXISTS lodging text;

COMMENT ON COLUMN public.spaces.description IS 'Trip overview and notes for the group';
COMMENT ON COLUMN public.spaces.start_date IS 'Trip start date (inclusive)';
COMMENT ON COLUMN public.spaces.end_date IS 'Trip end date (inclusive)';
COMMENT ON COLUMN public.spaces.airport IS 'Airport or flight notes';
COMMENT ON COLUMN public.spaces.lodging IS 'Hotel, rental, or stay details';
