-- =====================================================================
-- Documents feature schema (V1)
-- Includes: properties, contacts, internal_areas, documents,
-- document_versions, document_assignments, share_links,
-- share_link_history, anonymous_upload_portals, anonymous_uploads.
-- Plus: storage bucket "documents" (private) with tenant-scoped policies.
-- =====================================================================


-- ---------------------------------------------------------------------
-- ENUMs
-- ---------------------------------------------------------------------
CREATE TYPE property_status AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'INACTIVE');
CREATE TYPE contact_type AS ENUM ('BUYER', 'SELLER', 'LANDOWNER', 'NOTARY', 'OTHER');
CREATE TYPE document_kind AS ENUM ('PDF', 'DOCX', 'IMAGE_PDF', 'OTHER');
CREATE TYPE document_origin AS ENUM ('UPLOAD', 'CAMERA', 'ANONYMOUS_PORTAL', 'GENERATED');
CREATE TYPE assignment_target AS ENUM ('CONTACT', 'PROPERTY', 'INTERNAL_AREA');
CREATE TYPE portal_access AS ENUM ('PUBLIC', 'PASSWORD', 'QR_ONLY');


-- ---------------------------------------------------------------------
-- properties (mínimo viable; otra feature paralela completa CRUD avanzado)
-- ---------------------------------------------------------------------
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  address TEXT,
  status property_status NOT NULL DEFAULT 'AVAILABLE',
  is_draft BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_properties_tenant ON properties(tenant_id);
CREATE INDEX idx_properties_tenant_draft ON properties(tenant_id, is_draft);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY properties_tenant_select ON properties FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY properties_tenant_insert ON properties FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY properties_tenant_update ON properties FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY properties_tenant_delete ON properties FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- contacts (mínimo viable)
-- ---------------------------------------------------------------------
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  type contact_type NOT NULL DEFAULT 'OTHER',
  is_draft BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_tenant_draft ON contacts(tenant_id, is_draft);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contacts_tenant_select ON contacts FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY contacts_tenant_insert ON contacts FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY contacts_tenant_update ON contacts FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY contacts_tenant_delete ON contacts FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- internal_areas (carpetas internas tipo ANAIDA/CETER: Legal, RRHH, Templates)
-- ---------------------------------------------------------------------
CREATE TABLE internal_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);
CREATE INDEX idx_internal_areas_tenant ON internal_areas(tenant_id);

ALTER TABLE internal_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY internal_areas_tenant_select ON internal_areas FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY internal_areas_tenant_insert ON internal_areas FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY internal_areas_tenant_update ON internal_areas FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY internal_areas_tenant_delete ON internal_areas FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- documents (header)
-- ---------------------------------------------------------------------
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  kind document_kind NOT NULL,
  origin document_origin NOT NULL,
  current_version_id UUID,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_documents_tenant ON documents(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_sort ON documents(tenant_id, sort_order);
CREATE INDEX idx_documents_tenant_created ON documents(tenant_id, created_at DESC);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_tenant_select ON documents FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY documents_tenant_insert ON documents FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY documents_tenant_update ON documents FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY documents_tenant_delete ON documents FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- document_versions (versionado estricto + hash + metadata)
-- ---------------------------------------------------------------------
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  raw_path TEXT NOT NULL,
  normalized_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  page_count INT,
  sha256 TEXT NOT NULL CHECK (char_length(sha256) = 64),
  mime_type TEXT NOT NULL,
  original_filename TEXT,
  original_metadata JSONB,
  download_filename TEXT,
  scan_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (scan_status IN ('pending', 'clean', 'infected', 'error', 'skipped')),
  ocr_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (ocr_status IN ('pending', 'done', 'skipped', 'error')),
  ai_analysis_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (ai_analysis_status IN ('pending', 'done', 'skipped', 'error')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, version_number),
  UNIQUE(document_id, sha256)
);
CREATE INDEX idx_versions_document ON document_versions(document_id, version_number DESC);
CREATE INDEX idx_versions_tenant ON document_versions(tenant_id);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_versions_tenant_select ON document_versions FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY document_versions_tenant_insert ON document_versions FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY document_versions_tenant_update ON document_versions FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY document_versions_tenant_delete ON document_versions FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

-- forward FK: documents.current_version_id -> document_versions.id
ALTER TABLE documents
  ADD CONSTRAINT fk_documents_current_version
  FOREIGN KEY (current_version_id) REFERENCES document_versions(id) ON DELETE SET NULL;


-- ---------------------------------------------------------------------
-- document_assignments (poliasociación: contact / property / internal_area)
-- ---------------------------------------------------------------------
CREATE TABLE document_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target_kind assignment_target NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  internal_area_id UUID REFERENCES internal_areas(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (target_kind = 'CONTACT' AND contact_id IS NOT NULL AND property_id IS NULL AND internal_area_id IS NULL)
    OR (target_kind = 'PROPERTY' AND property_id IS NOT NULL AND contact_id IS NULL AND internal_area_id IS NULL)
    OR (target_kind = 'INTERNAL_AREA' AND internal_area_id IS NOT NULL AND contact_id IS NULL AND property_id IS NULL)
  )
);
CREATE UNIQUE INDEX uq_assign_doc_contact ON document_assignments(document_id, contact_id) WHERE contact_id IS NOT NULL;
CREATE UNIQUE INDEX uq_assign_doc_property ON document_assignments(document_id, property_id) WHERE property_id IS NOT NULL;
CREATE UNIQUE INDEX uq_assign_doc_area ON document_assignments(document_id, internal_area_id) WHERE internal_area_id IS NOT NULL;
CREATE INDEX idx_assign_contact ON document_assignments(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_assign_property ON document_assignments(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_assign_area ON document_assignments(internal_area_id) WHERE internal_area_id IS NOT NULL;
CREATE INDEX idx_assign_tenant ON document_assignments(tenant_id);

ALTER TABLE document_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_assignments_tenant_select ON document_assignments FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY document_assignments_tenant_insert ON document_assignments FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY document_assignments_tenant_delete ON document_assignments FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- share_links (shortlinks únicos editables, password opcional)
-- ---------------------------------------------------------------------
CREATE TABLE share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  pinned_version_id UUID REFERENCES document_versions(id) ON DELETE SET NULL,
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  download_filename_override TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  view_count INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_share_slug_active ON share_links(slug) WHERE is_active = TRUE;
CREATE INDEX idx_share_document ON share_links(document_id);
CREATE INDEX idx_share_tenant ON share_links(tenant_id);

ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY share_links_tenant_select ON share_links FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY share_links_tenant_insert ON share_links FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY share_links_tenant_update ON share_links FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY share_links_tenant_delete ON share_links FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- share_link_history (auditoría: cambios de target o version)
-- ---------------------------------------------------------------------
CREATE TABLE share_link_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prev_document_id UUID,
  new_document_id UUID NOT NULL,
  prev_version_id UUID,
  new_version_id UUID,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT
);
CREATE INDEX idx_share_history_link ON share_link_history(share_link_id, changed_at DESC);
CREATE INDEX idx_share_history_tenant ON share_link_history(tenant_id);

ALTER TABLE share_link_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY share_link_history_tenant_select ON share_link_history FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY share_link_history_tenant_insert ON share_link_history FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- anonymous_upload_portals
-- ---------------------------------------------------------------------
CREATE TABLE anonymous_upload_portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  access_mode portal_access NOT NULL DEFAULT 'PASSWORD',
  password_hash TEXT,
  default_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  default_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  default_internal_area_id UUID REFERENCES internal_areas(id) ON DELETE SET NULL,
  max_file_size_mb INT NOT NULL DEFAULT 50,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_portals_tenant ON anonymous_upload_portals(tenant_id);
CREATE INDEX idx_portals_slug_active ON anonymous_upload_portals(slug) WHERE is_active = TRUE;

ALTER TABLE anonymous_upload_portals ENABLE ROW LEVEL SECURITY;

CREATE POLICY portals_tenant_select ON anonymous_upload_portals FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY portals_tenant_insert ON anonymous_upload_portals FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY portals_tenant_update ON anonymous_upload_portals FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY portals_tenant_delete ON anonymous_upload_portals FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- anonymous_uploads (uploads externos pendientes review)
-- ---------------------------------------------------------------------
CREATE TABLE anonymous_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id UUID NOT NULL REFERENCES anonymous_upload_portals(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  original_filename TEXT,
  size_bytes BIGINT,
  sha256 TEXT,
  mime_type TEXT,
  uploader_ip INET,
  uploader_label TEXT,
  consent_given_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected')),
  promoted_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_anon_portal_status ON anonymous_uploads(portal_id, status);
CREATE INDEX idx_anon_tenant ON anonymous_uploads(tenant_id);

ALTER TABLE anonymous_uploads ENABLE ROW LEVEL SECURITY;

-- Solo backend (service-role) puede insertar. Frontend autenticado lee/aprueba/rechaza.
CREATE POLICY anon_uploads_tenant_select ON anonymous_uploads FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());
CREATE POLICY anon_uploads_tenant_update ON anonymous_uploads FOR UPDATE TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
CREATE POLICY anon_uploads_tenant_delete ON anonymous_uploads FOR DELETE TO authenticated
  USING (tenant_id = public.get_my_tenant_id());


-- ---------------------------------------------------------------------
-- Storage bucket: documents (privado, 50MB cap, MIME whitelist)
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  FALSE,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- Storage RLS: tenant-scoped via path prefix
CREATE POLICY tenant_documents_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
  );

CREATE POLICY tenant_documents_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
  );

CREATE POLICY tenant_documents_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
  );

CREATE POLICY tenant_documents_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_my_tenant_id()::text
  );


-- ---------------------------------------------------------------------
-- Triggers: updated_at auto-touch
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_properties_touch BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_contacts_touch BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_documents_touch BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_share_links_touch BEFORE UPDATE ON share_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_portals_touch BEFORE UPDATE ON anonymous_upload_portals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ---------------------------------------------------------------------
-- Trigger: share_links pinned change → audit en share_link_history
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.share_link_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (OLD.document_id IS DISTINCT FROM NEW.document_id)
     OR (OLD.pinned_version_id IS DISTINCT FROM NEW.pinned_version_id) THEN
    INSERT INTO share_link_history (
      share_link_id, tenant_id, prev_document_id, new_document_id,
      prev_version_id, new_version_id, changed_by
    ) VALUES (
      NEW.id, NEW.tenant_id, OLD.document_id, NEW.document_id,
      OLD.pinned_version_id, NEW.pinned_version_id, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_share_link_audit AFTER UPDATE ON share_links
  FOR EACH ROW EXECUTE FUNCTION public.share_link_audit();


-- ---------------------------------------------------------------------
-- Trigger: share_links INSERT también registra creación inicial
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.share_link_audit_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO share_link_history (
    share_link_id, tenant_id, prev_document_id, new_document_id,
    prev_version_id, new_version_id, changed_by, reason
  ) VALUES (
    NEW.id, NEW.tenant_id, NULL, NEW.document_id,
    NULL, NEW.pinned_version_id, auth.uid(), 'created'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_share_link_audit_insert AFTER INSERT ON share_links
  FOR EACH ROW EXECUTE FUNCTION public.share_link_audit_insert();
