-- =====================================================================
-- Foreign keys with no covering index.
--
-- Postgres does not index the referencing side of a FK automatically. Every
-- DELETE on a parent row then has to sequentially scan each child table to
-- enforce the constraint, and every join across the FK does the same.
--
-- Scope is deliberate rather than exhaustive: 67 single-column FKs lack an
-- index, but indexing all of them would trade a real write cost for a mostly
-- theoretical read gain. Indexed here are the ones where a parent DELETE does
-- actual work (ON DELETE CASCADE and SET NULL) plus `created_by`/`user_id` on
-- the hot domain tables, which are the joins the services actually issue.
--
-- CREATE INDEX (not CONCURRENTLY) on purpose: `supabase db push` wraps each
-- migration in a transaction and CONCURRENTLY cannot run inside one. These
-- take a brief SHARE lock, which at current table sizes is milliseconds.
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_agent_transcripts_media_file_id ON public.agent_transcripts (media_file_id);
CREATE INDEX IF NOT EXISTS idx_agent_transcripts_message_id ON public.agent_transcripts (message_id);
CREATE INDEX IF NOT EXISTS idx_anonymous_upload_portals_default_contact_id ON public.anonymous_upload_portals (default_contact_id);
CREATE INDEX IF NOT EXISTS idx_anonymous_upload_portals_default_internal_area_id ON public.anonymous_upload_portals (default_internal_area_id);
CREATE INDEX IF NOT EXISTS idx_anonymous_upload_portals_default_property_id ON public.anonymous_upload_portals (default_property_id);
CREATE INDEX IF NOT EXISTS idx_anonymous_uploads_promoted_document_id ON public.anonymous_uploads (promoted_document_id);
CREATE INDEX IF NOT EXISTS idx_client_consents_contact_id ON public.client_consents (contact_id);
CREATE INDEX IF NOT EXISTS idx_client_consents_created_by ON public.client_consents (created_by);
CREATE INDEX IF NOT EXISTS idx_client_conversations_assigned_user_id ON public.client_conversations (assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_client_messages_sender_user_id ON public.client_messages (sender_user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON public.contacts (created_by);
CREATE INDEX IF NOT EXISTS idx_contacts_merged_into_id ON public.contacts (merged_into_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON public.documents (created_by);
CREATE INDEX IF NOT EXISTS idx_documents_current_version_id ON public.documents (current_version_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_account_id ON public.email_threads (account_id);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events (created_by);
CREATE INDEX IF NOT EXISTS idx_events_project_id ON public.events (project_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created_by ON public.interactions (created_by);
CREATE INDEX IF NOT EXISTS idx_interactions_raw_transcript_id ON public.interactions (raw_transcript_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_by ON public.notes (created_by);
CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_user_id ON public.notification_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_by ON public.opportunities (created_by);
CREATE INDEX IF NOT EXISTS idx_opportunities_pipeline_id ON public.opportunities (pipeline_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_project_id ON public.opportunities (project_id);
CREATE INDEX IF NOT EXISTS idx_places_organization_id ON public.places (organization_id);
CREATE INDEX IF NOT EXISTS idx_project_properties_tenant_id ON public.project_properties (tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_parent_project_id ON public.projects (parent_project_id);
CREATE INDEX IF NOT EXISTS idx_projects_primary_place_id ON public.projects (primary_place_id);
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON public.properties (created_by);
CREATE INDEX IF NOT EXISTS idx_share_links_pinned_version_id ON public.share_links (pinned_version_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks (created_by);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON public.transactions (created_by);
CREATE INDEX IF NOT EXISTS idx_transactions_payer_person_id ON public.transactions (payer_person_id);
CREATE INDEX IF NOT EXISTS idx_transactions_receipt_document_id ON public.transactions (receipt_document_id);
CREATE INDEX IF NOT EXISTS idx_transactions_vendor_org_id ON public.transactions (vendor_org_id);
CREATE INDEX IF NOT EXISTS idx_visitor_invitations_contact_id ON public.visitor_invitations (contact_id);
CREATE INDEX IF NOT EXISTS idx_visitor_invitations_id_document_id ON public.visitor_invitations (id_document_id);
CREATE INDEX IF NOT EXISTS idx_visitor_invitations_user_id ON public.visitor_invitations (user_id);
