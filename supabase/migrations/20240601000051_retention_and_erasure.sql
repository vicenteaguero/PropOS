-- =====================================================================
-- Retention, erasure and audit coverage — Ley N° 21.719 (Chile).
--
-- Closes the SQL half of three audit findings (docs/audits/v0.1.0-r3/
-- D7-cumplimiento-ley-21719.md):
--
--   P1-11  The right to erasure (Art. 14) was not executable. `contacts`
--          only had a soft delete, `media_files.purge_after` was created in
--          20240601000029:26-33 with the comment "Manual purge job reads this
--          column" and has had zero readers and zero writers ever since, and
--          `audit_log` keeps a full `to_jsonb(OLD/NEW)` copy of every row --
--          RUT, phone, e-mail -- with no expiry. After an "executed" erasure
--          the personal data survived in at least four places.
--
--   P2-56  33 `attach_audit` calls for ~60 tables, and none of them on the
--          access-control or consent tables. Who was granted what, and who
--          revoked a consent, left no trace.
--
--   P3     `kapso_webhook_events` is an append-only copy of the raw inbound
--          WhatsApp payloads (message bodies, E.164 numbers) with no retention
--          at all. rat.yaml already promises "webhooks crudos 60 días".
--
-- Design notes:
--
--   * Redaction, not deletion. `audit_log` is the ledger docs/disaster-
--     recovery.md replays from, and 20240601000047 made it append-only on
--     purpose. So erasure overwrites the PII *keys inside* the before/after
--     snapshots with the string "[redacted]" and leaves the row, its
--     timestamp, its actor and its shape intact. The ledger stays auditable;
--     the personal data stops being readable.
--
--   * Nothing is purged by this migration. Every DELETE below lives inside a
--     function body and only runs when a caller invokes it with an explicit
--     cutoff. Applying this file changes no rows other than backfilling the
--     new `kapso_webhook_events.purge_after` default.
--
--   * `log_audit()` is left untouched. The 27 tables already wired to it keep
--     the exact function they were tested against. Two of the tables this
--     migration needs to audit cannot use it at all -- `tenant_memberships`
--     has no `id` column (its PK is the (user_id, tenant_id) pair) and
--     `tenants` has no `tenant_id` column -- so they get `log_audit_keyed()`,
--     which reads the two column names off TG_ARGV instead of hardcoding
--     NEW.id / NEW.tenant_id. Same context resolution, same output row.
--
--   * `tenants` is attached for INSERT OR UPDATE only. `audit_log.tenant_id`
--     REFERENCES tenants(id), so an AFTER DELETE trigger on `tenants` would
--     try to insert a row pointing at the tenant that was just deleted and
--     fail the FK, taking tenant deletion down with it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Erasure marker on contacts (Art. 14)
-- ---------------------------------------------------------------------
-- Distinct from `deleted_at`: a soft delete is reversible and keeps the PII,
-- an erasure is a tombstone whose identifying columns have been overwritten.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS erased_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN contacts.erased_at IS
  'Ley 21.719 Art. 14. Set when the subject''s data was erased: the row is a '
  'tombstone keeping only id + tenant_id for referential integrity, every '
  'identifying column has been overwritten. NULL = never erased. A row with '
  'deleted_at but no erased_at is a reversible soft delete and STILL HOLDS PII.';

CREATE INDEX IF NOT EXISTS contacts_erased_at_idx
  ON contacts(erased_at) WHERE erased_at IS NOT NULL;


-- ---------------------------------------------------------------------
-- 2. Retention window on the raw webhook forensic log
-- ---------------------------------------------------------------------
-- rat.yaml (whatsapp_kapso): "retencion: 24 meses; webhooks crudos 60 días".
-- The default is volatile on purpose -- each row carries its own expiry, so
-- shortening the policy later does not need a backfill of the old rows.
--
-- Three statements, not one, and the order matters. `ADD COLUMN ... DEFAULT`
-- fills the *existing* rows with that default too, so declaring the default up
-- front would hand every payload already in the table a fresh 60-day lease
-- counted from today -- the opposite of the retention this closes. So: add the
-- column empty, backfill each row from its own received_at, and only then set
-- the default for the rows that arrive later.
ALTER TABLE kapso_webhook_events
  ADD COLUMN IF NOT EXISTS purge_after TIMESTAMPTZ;

UPDATE kapso_webhook_events
   SET purge_after = received_at + INTERVAL '60 days'
 WHERE purge_after IS NULL;

ALTER TABLE kapso_webhook_events
  ALTER COLUMN purge_after SET DEFAULT (now() + INTERVAL '60 days');

CREATE INDEX IF NOT EXISTS kapso_webhook_events_purge_after_idx
  ON kapso_webhook_events(purge_after) WHERE purge_after IS NOT NULL;

COMMENT ON COLUMN kapso_webhook_events.purge_after IS
  'Ley 21.719 Art. 14 quinquies. Raw payloads hold message bodies and E.164 '
  'numbers; they are forensic, not operational. Read by '
  'compliance_purge_webhook_events().';


-- ---------------------------------------------------------------------
-- 3. PII redaction inside audit_log snapshots
-- ---------------------------------------------------------------------
-- Keys are redacted only when present AND non-null: writing "[redacted]" over
-- a key that was NULL would invent data that the original row never held.
-- Keep this default list in sync with PII_FIELDS in
-- backend/app/features/compliance/service.py, which is what the backend
-- actually passes (and what the unit tests cover).
CREATE OR REPLACE FUNCTION public.compliance_redact_jsonb(
  p_doc    JSONB,
  p_fields TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_key TEXT;
  v_out JSONB;
BEGIN
  IF p_doc IS NULL OR p_fields IS NULL THEN
    RETURN p_doc;
  END IF;
  v_out := p_doc;
  FOREACH v_key IN ARRAY p_fields LOOP
    IF v_out ? v_key AND jsonb_typeof(v_out -> v_key) <> 'null' THEN
      v_out := jsonb_set(v_out, ARRAY[v_key], '"[redacted]"'::JSONB);
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.compliance_redact_jsonb(JSONB, TEXT[]) IS
  'Overwrite the listed top-level keys of an audit snapshot with "[redacted]". '
  'Absent and null keys are left alone.';


-- Default PII key list, used when a caller passes NULL.
CREATE OR REPLACE FUNCTION public.compliance_pii_fields()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT ARRAY[
    'full_name', 'name', 'first_name', 'last_name', 'display_name',
    'email', 'from_email', 'to_emails', 'cc_emails', 'counterpart_email',
    'phone', 'phone_e164', 'external_phone_e164', 'mobile',
    'rut', 'birthdate', 'address', 'notes', 'note',
    'content', 'body_text', 'body_html', 'snippet', 'subject',
    'text', 'raw_response', 'payload', 'proof', 'evidence',
    'consent', 'metadata', 'alias', 'media_url', 'url'
  ]::TEXT[];
$$;


-- Redact every audit row that points at one specific (table, row).
CREATE OR REPLACE FUNCTION public.compliance_redact_audit_row(
  p_tenant_id UUID,
  p_table     TEXT,
  p_row_id    UUID,
  p_fields    TEXT[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_fields TEXT[] := COALESCE(p_fields, public.compliance_pii_fields());
  v_count  INTEGER;
BEGIN
  UPDATE audit_log
     SET before = public.compliance_redact_jsonb(before, v_fields),
         after  = public.compliance_redact_jsonb(after,  v_fields),
         reason = COALESCE(reason || ' | ', '') || 'erasure-redacted ' || now()::TEXT
   WHERE tenant_id = p_tenant_id
     AND table_name = p_table
     AND row_id = p_row_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.compliance_redact_audit_row(UUID, TEXT, UUID, TEXT[]) IS
  'Ley 21.719 Art. 14. Redacts the PII keys of every audit_log snapshot for one '
  'row. The ledger stays append-only: no audit row is deleted, only its '
  'personal-data fields are overwritten.';


-- Redact everything reachable from one contact: the contact row itself plus
-- the satellite tables that embed the subject's identifiers in their own
-- snapshots. Runs as one statement per table so a missing table in a partially
-- migrated environment cannot take the whole erasure down.
CREATE OR REPLACE FUNCTION public.compliance_redact_subject_audit(
  p_tenant_id  UUID,
  p_contact_id UUID,
  p_fields     TEXT[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_fields TEXT[] := COALESCE(p_fields, public.compliance_pii_fields());
  v_total  INTEGER := 0;
  v_count  INTEGER;
BEGIN
  -- The contact row.
  UPDATE audit_log
     SET before = public.compliance_redact_jsonb(before, v_fields),
         after  = public.compliance_redact_jsonb(after,  v_fields),
         reason = COALESCE(reason || ' | ', '') || 'erasure-redacted ' || now()::TEXT
   WHERE tenant_id = p_tenant_id
     AND table_name = 'contacts'
     AND row_id = p_contact_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  -- Satellites that carry the contact id inside the snapshot.
  UPDATE audit_log
     SET before = public.compliance_redact_jsonb(before, v_fields),
         after  = public.compliance_redact_jsonb(after,  v_fields),
         reason = COALESCE(reason || ' | ', '') || 'erasure-redacted ' || now()::TEXT
   WHERE tenant_id = p_tenant_id
     AND table_name IN (
       'person_aliases', 'client_consents', 'client_conversations',
       'client_messages', 'interaction_participants', 'email_messages',
       'email_threads', 'visitor_invitations', 'notes'
     )
     AND (
       COALESCE(after ->> 'contact_id', before ->> 'contact_id') = p_contact_id::TEXT
       OR COALESCE(after ->> 'person_id', before ->> 'person_id') = p_contact_id::TEXT
       OR COALESCE(after ->> 'target_row_id', before ->> 'target_row_id') = p_contact_id::TEXT
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.compliance_redact_subject_audit(UUID, UUID, TEXT[]) IS
  'Ley 21.719 Art. 14. Redacts every audit_log snapshot reachable from one '
  'contact, including the satellite tables that embed the subject id.';


-- ---------------------------------------------------------------------
-- 4. Retention purges
-- ---------------------------------------------------------------------
-- media_files is a two-step purge on purpose: the row is the only pointer to
-- the Storage object, so the backend reads the expired rows, deletes the blobs,
-- and only then drops the rows. Losing a blob and keeping the row is
-- recoverable; the reverse leaves an orphan nobody can find.
CREATE OR REPLACE FUNCTION public.compliance_expired_media(
  p_before TIMESTAMPTZ DEFAULT now(),
  p_limit  INTEGER DEFAULT 500
)
RETURNS TABLE (id UUID, tenant_id UUID, url TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT m.id, m.tenant_id, m.url
    FROM media_files m
   WHERE m.purge_after IS NOT NULL
     AND m.purge_after <= p_before
   ORDER BY m.purge_after
   LIMIT p_limit;
$$;


CREATE OR REPLACE FUNCTION public.compliance_purge_media_files(p_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    RETURN 0;
  END IF;
  DELETE FROM media_files WHERE id = ANY(p_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


CREATE OR REPLACE FUNCTION public.compliance_purge_webhook_events(
  p_before TIMESTAMPTZ DEFAULT now()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM kapso_webhook_events
   WHERE purge_after IS NOT NULL
     AND purge_after <= p_before;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- rat.yaml (ia_anita): "retencion: 90 días". Transcripts hold the literal words
-- the broker dictated, which routinely include third-party names and RUTs.
CREATE OR REPLACE FUNCTION public.compliance_purge_agent_transcripts(
  p_before TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM agent_transcripts WHERE created_at < p_before;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- rat.yaml (auditoria): "retencion: 5 años (alineado con plazo APDP)". This is
-- the only sanctioned way audit rows ever leave the table -- 20240601000047
-- removed the ADMIN DELETE policy, and this function runs service-role only.
CREATE OR REPLACE FUNCTION public.compliance_purge_audit_log(
  p_before TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM audit_log WHERE changed_at < p_before;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ---------------------------------------------------------------------
-- 5. Audit coverage for access-control and consent tables (P2-56)
-- ---------------------------------------------------------------------
-- Same actor resolution as log_audit() (20240601000046): GUC first, then the
-- PostgREST request headers, so an agent-driven write is attributed even
-- though every backend write goes through the service-role client where
-- auth.uid() is NULL.
CREATE OR REPLACE FUNCTION public.audit_actor_context()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_session_id UUID;
  v_source     TEXT;
  v_changed_by UUID;
  v_headers    JSONB;
BEGIN
  BEGIN
    v_session_id := NULLIF(current_setting('app.agent_session_id', true), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_session_id := NULL;
  END;

  v_source := COALESCE(NULLIF(current_setting('app.action_source', true), ''), 'user');

  IF v_session_id IS NULL OR v_source = 'user' THEN
    BEGIN
      v_headers := current_setting('request.headers', true)::JSONB;
      IF v_session_id IS NULL AND v_headers ? 'x-agent-session-id' THEN
        v_session_id := NULLIF(v_headers ->> 'x-agent-session-id', '')::UUID;
      END IF;
      IF v_headers ? 'x-action-user' THEN
        v_changed_by := NULLIF(v_headers ->> 'x-action-user', '')::UUID;
      END IF;
      IF v_source = 'user' AND v_headers ? 'x-action-source' THEN
        v_source := COALESCE(NULLIF(v_headers ->> 'x-action-source', ''), v_source);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'source',     v_source,
    'changed_by', COALESCE(auth.uid(), v_changed_by)
  );
END;
$$;


-- TG_ARGV[0] = column holding the logical row id, TG_ARGV[1] = tenant column.
-- Needed by tables log_audit() cannot serve: no `id` (tenant_memberships) or
-- no `tenant_id` (tenants).
CREATE OR REPLACE FUNCTION public.log_audit_keyed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_key_col    TEXT := COALESCE(TG_ARGV[0], 'id');
  v_tenant_col TEXT := COALESCE(TG_ARGV[1], 'tenant_id');
  v_before     JSONB;
  v_after      JSONB;
  v_row_id     UUID;
  v_tenant_id  UUID;
  v_ctx        JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD);
    v_after  := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_before := NULL;
    v_after  := to_jsonb(NEW);
  ELSE
    v_before := to_jsonb(OLD);
    v_after  := to_jsonb(NEW);
  END IF;

  v_row_id    := COALESCE(v_after ->> v_key_col,    v_before ->> v_key_col)::UUID;
  v_tenant_id := COALESCE(v_after ->> v_tenant_col, v_before ->> v_tenant_col)::UUID;

  IF v_row_id IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'log_audit_keyed: % has no %/% to key on', TG_TABLE_NAME, v_key_col, v_tenant_col;
  END IF;

  v_ctx := public.audit_actor_context();

  INSERT INTO audit_log (
    tenant_id, table_name, row_id, op, before, after,
    changed_by, agent_session_id, source
  ) VALUES (
    v_tenant_id, TG_TABLE_NAME, v_row_id, TG_OP, v_before, v_after,
    NULLIF(v_ctx ->> 'changed_by', '')::UUID,
    NULLIF(v_ctx ->> 'session_id', '')::UUID,
    v_ctx ->> 'source'
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.attach_audit_keyed(
  p_table      TEXT,
  p_key_col    TEXT DEFAULT 'id',
  p_tenant_col TEXT DEFAULT 'tenant_id',
  p_ops        TEXT DEFAULT 'INSERT OR UPDATE OR DELETE'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON %I', p_table, p_table);
  EXECUTE format(
    'CREATE TRIGGER trg_audit_%I AFTER %s ON %I '
    'FOR EACH ROW EXECUTE FUNCTION public.log_audit_keyed(%L, %L)',
    p_table, p_ops, p_table, p_key_col, p_tenant_col
  );
END;
$$;


-- Standard shape (id + tenant_id): the plain trigger is enough.
SELECT public.attach_audit('client_consents');       -- who consented, and who revoked it
SELECT public.attach_audit('property_grants');       -- per-property access grants
SELECT public.attach_audit('user_phones');           -- the binding that lets a phone drive the agent
SELECT public.attach_audit('user_emails');           -- same binding for e-mail, and it carries a marketing purpose
SELECT public.attach_audit('profiles');              -- role / is_active changes
SELECT public.attach_audit('visitor_invitations');   -- external access to a property flow

-- Non-standard shape.
SELECT public.attach_audit_keyed('tenant_memberships', 'user_id', 'tenant_id');
SELECT public.attach_audit_keyed('tenants', 'id', 'id', 'INSERT OR UPDATE');


-- ---------------------------------------------------------------------
-- 6. Grants — every function above is backend-only
-- ---------------------------------------------------------------------
-- These read and rewrite the audit ledger and delete personal data. None of
-- them should be reachable through PostgREST with a user JWT.
REVOKE EXECUTE ON FUNCTION public.compliance_redact_audit_row(UUID, TEXT, UUID, TEXT[])  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compliance_redact_subject_audit(UUID, UUID, TEXT[])    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compliance_expired_media(TIMESTAMPTZ, INTEGER)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compliance_purge_media_files(UUID[])                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compliance_purge_webhook_events(TIMESTAMPTZ)           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compliance_purge_agent_transcripts(TIMESTAMPTZ)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compliance_purge_audit_log(TIMESTAMPTZ)                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.attach_audit_keyed(TEXT, TEXT, TEXT, TEXT)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_actor_context()                                  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.compliance_redact_audit_row(UUID, TEXT, UUID, TEXT[])   TO service_role;
GRANT EXECUTE ON FUNCTION public.compliance_redact_subject_audit(UUID, UUID, TEXT[])     TO service_role;
GRANT EXECUTE ON FUNCTION public.compliance_expired_media(TIMESTAMPTZ, INTEGER)          TO service_role;
GRANT EXECUTE ON FUNCTION public.compliance_purge_media_files(UUID[])                    TO service_role;
GRANT EXECUTE ON FUNCTION public.compliance_purge_webhook_events(TIMESTAMPTZ)            TO service_role;
GRANT EXECUTE ON FUNCTION public.compliance_purge_agent_transcripts(TIMESTAMPTZ)         TO service_role;
GRANT EXECUTE ON FUNCTION public.compliance_purge_audit_log(TIMESTAMPTZ)                 TO service_role;
