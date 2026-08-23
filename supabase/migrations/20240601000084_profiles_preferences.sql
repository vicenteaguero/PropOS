-- Per-user UI preferences (colour palette, and whatever comes next).
--
-- The palette a broker picks is theirs, not the workspace's: two people in the
-- same brokerage share `tenants.settings.brand_color` but must be able to run
-- the app in different colours. Kept as jsonb so a new preference does not cost
-- a migration, and read straight off the profile row the client already selects
-- at sign-in, so the chosen palette is on screen before the first paint.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
