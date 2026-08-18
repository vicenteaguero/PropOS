-- =====================================================================
-- P0: views bypassed RLS entirely.
--
-- A Postgres view without `security_invoker` evaluates its underlying
-- tables as the view OWNER. Every view here is owned by `postgres`, which
-- owns the tables and is BYPASSRLS, so RLS never applied through any of
-- them. Combined with Supabase's default `SELECT` grant to `anon`, the
-- publishable key that ships in the frontend bundle could read:
--
--   v_entity_timeline  -> audit_log payloads (before/after JSONB) of every
--                         row of every table of every tenant
--   people             -> contacts: RUT, phone, email, address, all tenants
--   v_calendar_feed / v_pipeline_status / v_open_pending_review
--                      -> agenda, commercial pipeline, agent proposals
--
-- Verified live before this migration: GET /rest/v1/v_entity_timeline with
-- only the anon key returned rows.
--
-- Materialized views cannot have RLS at all, so the only available seal is
-- removing the grant. They currently carry `arwdDxtm` for anon and
-- authenticated -- that includes MAINTAIN, i.e. an anonymous caller can
-- trigger REFRESH MATERIALIZED VIEW. `agent_readonly` is revoked here too:
-- it is NOBYPASSRLS, so tables return nothing, but matviews have no RLS and
-- would have leaked every tenant once text_to_sql is switched on.
--
-- The backend reads all of these with the service-role client, which is
-- BYPASSRLS and keeps its own grant, so nothing in the app changes.
-- =====================================================================

ALTER VIEW public.people                SET (security_invoker = on);
ALTER VIEW public.v_entity_timeline     SET (security_invoker = on);
ALTER VIEW public.v_calendar_feed       SET (security_invoker = on);
ALTER VIEW public.v_pipeline_status     SET (security_invoker = on);
ALTER VIEW public.v_open_pending_review SET (security_invoker = on);

REVOKE ALL ON public.mv_revenue_monthly FROM anon, authenticated, agent_readonly;
REVOKE ALL ON public.mv_funnel_monthly  FROM anon, authenticated, agent_readonly;
REVOKE ALL ON public.mv_ad_roi          FROM anon, authenticated, agent_readonly;
REVOKE ALL ON public.mv_time_on_market  FROM anon, authenticated, agent_readonly;
REVOKE ALL ON public.mv_person_activity FROM anon, authenticated, agent_readonly;
