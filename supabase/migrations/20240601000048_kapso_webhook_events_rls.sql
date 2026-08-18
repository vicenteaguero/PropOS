-- =====================================================================
-- kapso_webhook_events was the only domain table without RLS.
--
-- It stores raw inbound WhatsApp payloads: phone numbers, message bodies and
-- conversation metadata. Supabase's default grants give `anon` and
-- `authenticated` SELECT on public tables, and with no RLS there was nothing
-- else in the way.
--
-- Enabling RLS with no policy is deliberate: it denies every role that is not
-- BYPASSRLS. Verified before applying that `service_role` is BYPASSRLS
-- (`select rolbypassrls from pg_roles`), so the webhook handler -- which
-- writes through the service-role client -- keeps inserting normally.
-- Acceptance test after deploy: send a real WhatsApp message and confirm the
-- row count increases.
-- =====================================================================

ALTER TABLE public.kapso_webhook_events ENABLE ROW LEVEL SECURITY;
