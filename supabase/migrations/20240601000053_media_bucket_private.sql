-- =====================================================================
-- The `media` bucket was world-readable and world-enumerable.
--
-- 20240101000009 created it with `public = true`, a SELECT policy with no
-- `TO` clause (therefore PUBLIC, i.e. anon) and an INSERT policy for
-- `authenticated` with no tenant scope at all. Verified live before this
-- migration: `POST /storage/v1/object/list/media` with only the publishable
-- key returned 200 and listed the per-tenant folders.
--
-- This is where WhatsApp inbound photos, Propo voice notes and property
-- photos land -- i.e. scanned IDs and contracts a client sends over chat.
--
-- The policies below are copied verbatim from the `documents` bucket
-- (20240101000014:388-410), which was always private and tenant-scoped, so
-- there is now one convention instead of two. That requires every writer to
-- put the tenant first in the path: the frontend already does
-- (`{tenant}/{type}/...`, use-media-upload.ts:31) and the backend was changed
-- in this same run (`{tenant}/agent/...`, agent_adapter.py). Verified that no
-- object currently lives under the old `agent/` prefix, so no backfill of
-- existing objects is required.
--
-- NOTE: `INSERT ... ON CONFLICT DO NOTHING` (how the bucket was created) does
-- not flip the flag on an existing row. It has to be an UPDATE.
--
-- Apply AFTER the backend that signs URLs is deployed. If applied first, every
-- inbound WhatsApp photo fails its upload against the new policy and
-- `_store_media` swallows it, losing media with no visible error.
-- =====================================================================

UPDATE storage.buckets SET public = FALSE WHERE id = 'media';

DROP POLICY IF EXISTS "Public media read"   ON storage.objects;
DROP POLICY IF EXISTS "Tenant media upload" ON storage.objects;

CREATE POLICY tenant_media_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = (public.get_my_tenant_id())::text);

CREATE POLICY tenant_media_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = (public.get_my_tenant_id())::text);

CREATE POLICY tenant_media_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = (public.get_my_tenant_id())::text);

CREATE POLICY tenant_media_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = (public.get_my_tenant_id())::text);
