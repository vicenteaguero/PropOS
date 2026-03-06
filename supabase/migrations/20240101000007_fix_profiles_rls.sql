-- Fix infinite recursion: profiles RLS policy references itself.
-- Add a policy that lets users always read their own profile row,
-- which breaks the circular dependency.

CREATE POLICY "profiles_read_own" ON profiles
  FOR SELECT USING (id = auth.uid());
