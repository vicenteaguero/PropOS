-- =====================================================================
-- The timeline stops lying by omission.
--
-- `v_entity_timeline` (20240601000037) unions seven sources into
-- (table_name, row_id) -- and uses TWO INCOMPATIBLE VOCABULARIES for
-- `table_name`:
--
--   * `interaction_targets.target_kind::TEXT` yields 'PROPERTY', 'PROJECT'
--   * notes, tasks and events yield 'properties', 'contacts'
--
-- Every caller passes the lowercase plural (it is the real table name), so the
-- interactions branch is unreachable. Interactions -- calls, visits, showings,
-- the actual work of a brokerage -- have never appeared on any entity timeline,
-- and nothing failed: the page just rendered a shorter list.
--
-- A contact's timeline is worse still: the interactions branch joins TARGETS
-- (properties, projects, deals, places) and never PARTICIPANTS, so even fixing
-- the vocabulary would not put a person's own calls on their own page.
--
-- Also missing entirely: WhatsApp, e-mail, and stage changes. In a CRM whose
-- thesis is that the conversation is the record, the conversation was the one
-- thing the record did not show.
-- =====================================================================

CREATE OR REPLACE VIEW v_entity_timeline AS
-- 1. Audit: the only branch carrying source='agent', which is how a human
--    tells their own edits from Propo's.
SELECT
  a.tenant_id, a.table_name, a.row_id, a.changed_at AS event_at,
  'audit' AS event_type, a.op AS event_subtype, a.source AS source,
  a.changed_by AS actor,
  jsonb_build_object('before', a.before, 'after', a.after) AS payload
FROM audit_log a

UNION ALL
-- 2. Interactions, by what they were about. `target_kind` is mapped to the
--    real table name instead of being cast to TEXT.
SELECT
  i.tenant_id,
  CASE it.target_kind
    WHEN 'PROPERTY'    THEN 'properties'
    WHEN 'PROJECT'     THEN 'projects'
    WHEN 'OPPORTUNITY' THEN 'opportunities'
    WHEN 'PLACE'       THEN 'places'
  END AS table_name,
  COALESCE(it.property_id, it.project_id, it.opportunity_id, it.place_id) AS row_id,
  i.occurred_at AS event_at, 'interaction' AS event_type, i.kind::TEXT AS event_subtype,
  i.source, i.created_by AS actor,
  jsonb_build_object('summary', i.summary, 'body', i.body) AS payload
FROM interactions i
JOIN interaction_targets it ON it.interaction_id = i.id
WHERE i.deleted_at IS NULL

UNION ALL
-- 3. Interactions, by WHO was in them. The branch that never existed, and the
--    reason a person's own calls were missing from their own page.
SELECT
  i.tenant_id, 'contacts' AS table_name, ip.person_id AS row_id,
  i.occurred_at AS event_at, 'interaction' AS event_type, i.kind::TEXT AS event_subtype,
  i.source, i.created_by AS actor,
  jsonb_build_object('summary', i.summary, 'body', i.body, 'role', ip.role) AS payload
FROM interactions i
JOIN interaction_participants ip ON ip.interaction_id = i.id
WHERE i.deleted_at IS NULL

UNION ALL
-- 4. Notes, via the typed bridge. `notes.target_table` is the legacy pair and
--    stays readable, but `note_targets` is where multi-target notes live.
SELECT
  n.tenant_id,
  CASE nt.target_kind
    WHEN 'PROPERTY'    THEN 'properties'
    WHEN 'CONTACT'     THEN 'contacts'
    WHEN 'OPPORTUNITY' THEN 'opportunities'
    WHEN 'EVENT'       THEN 'events'
    WHEN 'PROJECT'     THEN 'projects'
    WHEN 'PLACE'       THEN 'places'
  END AS table_name,
  COALESCE(nt.property_id, nt.contact_id, nt.opportunity_id, nt.event_id,
           nt.project_id, nt.place_id) AS row_id,
  n.created_at AS event_at, 'note' AS event_type, NULL AS event_subtype,
  n.source, n.created_by AS actor,
  jsonb_build_object('body', n.body) AS payload
FROM notes n
JOIN note_targets nt ON nt.note_id = n.id
WHERE n.deleted_at IS NULL

UNION ALL
-- 5. Tasks. `related` is {"<table>": [ids]}; the writer, the reader and this
--    view disagreed on whether people live under 'people' or 'contacts', so
--    both are read until the data settles on one.
SELECT
  t.tenant_id, 'contacts' AS table_name, person_id::UUID AS row_id,
  t.created_at AS event_at, 'task' AS event_type, t.status::TEXT AS event_subtype,
  t.source, t.created_by AS actor,
  jsonb_build_object('title', t.title, 'due_at', t.due_at) AS payload
FROM tasks t,
     jsonb_array_elements_text(COALESCE(t.related -> 'contacts', t.related -> 'people', '[]'::jsonb)) person_id
WHERE t.deleted_at IS NULL

UNION ALL
SELECT
  t.tenant_id, 'properties' AS table_name, property_id::UUID AS row_id,
  t.created_at AS event_at, 'task' AS event_type, t.status::TEXT AS event_subtype,
  t.source, t.created_by AS actor,
  jsonb_build_object('title', t.title, 'due_at', t.due_at) AS payload
FROM tasks t,
     jsonb_array_elements_text(COALESCE(t.related -> 'properties', '[]'::jsonb)) property_id
WHERE t.deleted_at IS NULL

UNION ALL
-- 6. Calendar.
SELECT
  e.tenant_id, 'contacts' AS table_name, e.contact_id AS row_id,
  e.starts_at AS event_at, 'event' AS event_type, e.kind::TEXT AS event_subtype,
  e.source, e.created_by AS actor,
  jsonb_build_object('title', e.title, 'status', e.status) AS payload
FROM events e
WHERE e.deleted_at IS NULL AND e.contact_id IS NOT NULL

UNION ALL
SELECT
  e.tenant_id, 'properties' AS table_name, e.property_id AS row_id,
  e.starts_at AS event_at, 'event' AS event_type, e.kind::TEXT AS event_subtype,
  e.source, e.created_by AS actor,
  jsonb_build_object('title', e.title, 'status', e.status) AS payload
FROM events e
WHERE e.deleted_at IS NULL AND e.property_id IS NOT NULL

UNION ALL
-- 7. WhatsApp. The conversation IS the record; it had no branch at all.
SELECT
  m.tenant_id, 'contacts' AS table_name, c.contact_id AS row_id,
  m.created_at AS event_at, 'message' AS event_type, m.direction AS event_subtype,
  CASE m.sender_type WHEN 'agent_ai' THEN 'agent' ELSE 'user' END AS source,
  m.sender_user_id AS actor,
  jsonb_build_object('channel', 'whatsapp', 'content', m.content,
                     'conversation_id', m.conversation_id) AS payload
FROM client_messages m
JOIN client_conversations c ON c.id = m.conversation_id
WHERE c.contact_id IS NOT NULL

UNION ALL
-- 8. E-mail.
SELECT
  em.tenant_id, 'contacts' AS table_name, em.contact_id AS row_id,
  em.sent_at AS event_at, 'message' AS event_type, em.direction AS event_subtype,
  'user' AS source, NULL::UUID AS actor,
  jsonb_build_object('channel', 'email', 'subject', em.subject,
                     'snippet', em.snippet, 'thread_id', em.thread_id) AS payload
FROM email_messages em
WHERE em.contact_id IS NOT NULL

UNION ALL
-- 9. Stage changes, so a deal's page shows how it got where it is.
SELECT
  h.tenant_id, 'opportunities' AS table_name, h.opportunity_id AS row_id,
  h.changed_at AS event_at, 'stage' AS event_type, h.to_stage AS event_subtype,
  'user' AS source, h.changed_by AS actor,
  jsonb_build_object('from_stage', h.from_stage, 'to_stage', h.to_stage,
                     'note', h.note) AS payload
FROM opportunity_stage_history h;

-- Views default to the definer's rights; every other view in this schema was
-- switched to the caller's in 20240601000044 and this replacement must not
-- silently opt back out.
ALTER VIEW v_entity_timeline SET (security_invoker = true);
