import type { Assignment, AssignmentTarget, DocumentItem } from "../types";
import { apiRequest } from "./http";

export interface ListDocumentsParams {
  contactId?: string;
  propertyId?: string;
  areaId?: string;
  q?: string;
}

function qs(params: ListDocumentsParams): string {
  const sp = new URLSearchParams();
  if (params.contactId) sp.set("contact_id", params.contactId);
  if (params.propertyId) sp.set("property_id", params.propertyId);
  if (params.areaId) sp.set("area_id", params.areaId);
  if (params.q) sp.set("q", params.q);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const documentsApi = {
  list: (params: ListDocumentsParams = {}) =>
    apiRequest<DocumentItem[]>(`/v1/documents${qs(params)}`),

  get: (id: string) => apiRequest<DocumentItem>(`/v1/documents/${id}`),

  create: (
    file: File,
    displayName: string,
    origin: string = "UPLOAD",
    downloadFilename?: string,
    editMetadata?: Record<string, unknown>,
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("display_name", displayName);
    fd.append("origin", origin);
    if (downloadFilename) fd.append("download_filename", downloadFilename);
    if (editMetadata) fd.append("edit_metadata", JSON.stringify(editMetadata));
    return apiRequest<DocumentItem>("/v1/documents", { method: "POST", formData: fd });
  },

  update: (id: string, body: { display_name?: string; sort_order?: number }) =>
    apiRequest<DocumentItem>(`/v1/documents/${id}`, { method: "PATCH", body }),

  remove: (id: string) => apiRequest<void>(`/v1/documents/${id}`, { method: "DELETE" }),

  addVersion: (
    id: string,
    file: File,
    opts: {
      notes?: string;
      downloadFilename?: string;
      editMetadata?: Record<string, unknown>;
      sourceVersionId?: string;
    } = {},
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    if (opts.notes) fd.append("notes", opts.notes);
    if (opts.downloadFilename) fd.append("download_filename", opts.downloadFilename);
    if (opts.editMetadata) fd.append("edit_metadata", JSON.stringify(opts.editMetadata));
    if (opts.sourceVersionId) fd.append("source_version_id", opts.sourceVersionId);
    return apiRequest<DocumentItem>(`/v1/documents/${id}/versions`, {
      method: "POST",
      formData: fd,
    });
  },

  makeVersionCurrent: (documentId: string, versionId: string) =>
    apiRequest<DocumentItem>(`/v1/documents/${documentId}/versions/${versionId}/make-current`, {
      method: "POST",
    }),

  restoreOriginal: (documentId: string, versionId: string) =>
    apiRequest<DocumentItem>(
      `/v1/documents/${documentId}/versions/${versionId}/restore-original`,
      { method: "POST" },
    ),

  versionDownloadUrl: (documentId: string, versionId: string) =>
    apiRequest<{ url: string }>(`/v1/documents/${documentId}/versions/${versionId}/download`),

  addAssignment: (
    documentId: string,
    body: {
      target_kind: AssignmentTarget;
      contact_id?: string;
      property_id?: string;
      internal_area_id?: string;
    },
  ) =>
    apiRequest<Assignment>(`/v1/documents/${documentId}/assignments`, {
      method: "POST",
      body,
    }),

  removeAssignment: (documentId: string, assignmentId: string) =>
    apiRequest<void>(`/v1/documents/${documentId}/assignments/${assignmentId}`, {
      method: "DELETE",
    }),
};
