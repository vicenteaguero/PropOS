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

  create: (file: File, displayName: string, origin: string = "UPLOAD", downloadFilename?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("display_name", displayName);
    fd.append("origin", origin);
    if (downloadFilename) fd.append("download_filename", downloadFilename);
    return apiRequest<DocumentItem>("/v1/documents", { method: "POST", formData: fd });
  },

  update: (id: string, body: { display_name?: string; sort_order?: number }) =>
    apiRequest<DocumentItem>(`/v1/documents/${id}`, { method: "PATCH", body }),

  remove: (id: string) =>
    apiRequest<void>(`/v1/documents/${id}`, { method: "DELETE" }),

  addVersion: (id: string, file: File, notes?: string, downloadFilename?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (notes) fd.append("notes", notes);
    if (downloadFilename) fd.append("download_filename", downloadFilename);
    return apiRequest<DocumentItem>(`/v1/documents/${id}/versions`, {
      method: "POST",
      formData: fd,
    });
  },

  makeVersionCurrent: (documentId: string, versionId: string) =>
    apiRequest<DocumentItem>(
      `/v1/documents/${documentId}/versions/${versionId}/make-current`,
      { method: "POST" },
    ),

  versionDownloadUrl: (documentId: string, versionId: string) =>
    apiRequest<{ url: string }>(
      `/v1/documents/${documentId}/versions/${versionId}/download`,
    ),

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
    apiRequest<void>(
      `/v1/documents/${documentId}/assignments/${assignmentId}`,
      { method: "DELETE" },
    ),
};
