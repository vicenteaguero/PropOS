-- Forced password rotation on first login.
--
-- Accounts for real brokers are created by an admin with a temporary password
-- handed over in person, because the mailboxes on the brokerage domain do not
-- exist yet -- an invite email would bounce into nothing. A temporary password
-- that is never rotated is just a shared password, so the app has to insist.
--
-- The flag lives on `profiles` rather than in auth user_metadata for two
-- reasons: the frontend already fetches the profile row at sign-in, so reading
-- it costs no extra request, and user_metadata is writable by the user's own
-- JWT, which would let the holder of a temporary password clear the demand
-- instead of satisfying it.

alter table profiles
  add column if not exists must_change_password boolean not null default false;

comment on column profiles.must_change_password is
  'Set when an admin creates the account with a temporary password. Every '
  'protected route redirects to the change-password screen until the user '
  'rotates it, at which point POST /v1/users/me/password-changed clears it.';
