-- Add email + rut to profiles with uniqueness for user identification.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS rut TEXT;

-- Backfill email from auth.users for existing profiles.
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx
  ON public.profiles (LOWER(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_rut_unique_idx
  ON public.profiles (rut)
  WHERE rut IS NOT NULL;
