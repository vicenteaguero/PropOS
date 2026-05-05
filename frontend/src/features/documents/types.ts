export type DocumentKind = "PDF" | "DOCX" | "IMAGE_PDF" | "OTHER";
export type DocumentOrigin = "UPLOAD" | "CAMERA" | "ANONYMOUS_PORTAL" | "GENERATED";
export type AssignmentTarget = "CONTACT" | "PROPERTY" | "INTERNAL_AREA";
export type PortalAccess = "PUBLIC" | "PASSWORD" | "QR_ONLY";
export type ScanStatus = "pending" | "clean" | "infected" | "error" | "skipped";
export type OCRStatus = "pending" | "done" | "skipped" | "error";
export type AIStatus = "pending" | "done" | "skipped" | "error";
export type UploadReviewStatus = "pending_review" | "approved" | "rejected";

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  raw_path: string;
  normalized_path: string;
  size_bytes: number;
  page_count: number | null;
  sha256: string;
  mime_type: string;
  original_filename: string | null;
  download_filename: string | null;
  scan_status: ScanStatus;
  ocr_status: OCRStatus;
  ai_analysis_status: AIStatus;
  notes: string | null;
  edit_metadata: Record<string, unknown> | null;
  source_raw_path: string | null;
  source_image_paths?: string[];
  source_edit_states?: Record<string, unknown>[];
  source_image_urls?: string[];
  created_by: string | null;
  created_at: string;
}

export interface Assignment {
  id: string;
  document_id: string;
  target_kind: AssignmentTarget;
  contact_id: string | null;
  property_id: string | null;
  internal_area_id: string | null;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  tenant_id: string;
  display_name: string;
  kind: DocumentKind;
  origin: DocumentOrigin;
  current_version_id: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  versions?: DocumentVersion[];
  assignments?: Assignment[];
  current_version?: DocumentVersion | null;
}

export interface ShareLink {
  id: string;
  tenant_id: string;
  slug: string;
  document_id: string;
  pinned_version_id: string | null;
  has_password: boolean;
  expires_at: string | null;
  download_filename_override: string | null;
  is_active: boolean;
  view_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShareLinkPublicView {
  slug: string;
  document_display_name: string;
  version_number: number;
  sha256_short: string;
  mime_type: string;
  page_count: number | null;
  download_filename: string;
  download_url: string;
  requires_password: boolean;
  expires_at: string | null;
}

export interface Portal {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  description: string | null;
  access_mode: PortalAccess;
  has_password: boolean;
  default_property_id: string | null;
  default_contact_id: string | null;
  default_internal_area_id: string | null;
  max_file_size_mb: number;
  expires_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnonymousUpload {
  id: string;
  portal_id: string;
  storage_path: string;
  original_filename: string | null;
  size_bytes: number | null;
  sha256: string | null;
  mime_type: string | null;
  uploader_label: string | null;
  consent_given_at: string | null;
  status: UploadReviewStatus;
  promoted_document_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface PropertyLite {
  id: string;
  title: string;
  address: string | null;
  status: string;
  is_draft: boolean;
}

export interface ContactLite {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  type: string;
  is_draft: boolean;
}

export interface InternalAreaLite {
  id: string;
  name: string;
  slug: string;
}

export type ViewMode = "grid" | "list";
