-- Drop triggers que usan auth.uid() (siempre NULL cuando backend escribe con
-- service-role key). Backend hará el insert de auditoría explícitamente con
-- changed_by recibido de la sesión autenticada.

DROP TRIGGER IF EXISTS trg_share_link_audit ON share_links;
DROP TRIGGER IF EXISTS trg_share_link_audit_insert ON share_links;
DROP FUNCTION IF EXISTS public.share_link_audit();
DROP FUNCTION IF EXISTS public.share_link_audit_insert();
