import type { Assignment, AssignmentTarget, DocumentItem, ThumbnailState } from "../types";
import { apiRequest } from "@shared/api/http";
import { qs } from "@shared/lib/query-string";

export interface ListDocumentsParams {
  contactId?: string;
  propertyId?: string;
  areaId?: string;
  q?: string;
}

export const documentsApi = {
  list: (params: ListDocumentsParams = {}) =>
    apiRequest<DocumentItem[]>(`/v1/documents${qs(params)}`),

  get: (id: string) => apiRequest<DocumentItem>(`/v1/documents/${id}`),

  /**
   * A fresh signed URL for the first-page preview, generating it if this
   * document has never had one.
   *
   * Called imperatively from a broken <img>, never through `useQuery`: it must
   * repair one tile without touching the list cache, and a grid where every
   * thumbnail loads must not call it at all.
   */
  /** Records that the document was opened; drives the "recently used" sort. */
  markOpened: (id: string) => apiRequest<void>(`/v1/documents/${id}/opened`, { method: "POST" }),

  thumbnail: (id: string) =>
    apiRequest<{ url: string | null; state: ThumbnailState }>(`/v1/documents/${id}/thumbnail`),

  create: (
    file: File,
    displayName: string,
    origin: string = "UPLOAD",
    downloadFilename?: string,
    editMetadata?: Record<string, unknown>,
    sourceImages?: Blob[],
    sourceEditStates?: Record<string, unknown>[],
    tag?: string,
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("display_name", displayName);
    fd.append("origin", origin);
    if (downloadFilename) fd.append("download_filename", downloadFilename);
    if (editMetadata) fd.append("edit_metadata", JSON.stringify(editMetadata));
    if (sourceImages && sourceImages.length > 0) {
      sourceImages.forEach((img, i) => fd.append("source_images", img, `source-${i}.jpg`));
      if (sourceEditStates) fd.append("source_edit_states", JSON.stringify(sourceEditStates));
    }
    if (tag) fd.append("tag", tag);
    return apiRequest<DocumentItem>("/v1/documents", { method: "POST", formData: fd });
  },

  update: (
    id: string,
    body: {
      display_name?: string;
      sort_order?: number;
      tag?: string | null;
      pin_offline?: boolean;
      is_priority?: boolean;
    },
  ) => apiRequest<DocumentItem>(`/v1/documents/${id}`, { method: "PATCH", body }),

  remove: (id: string) => apiRequest<void>(`/v1/documents/${id}`, { method: "DELETE" }),

  addVersion: (
    id: string,
    file: File,
    opts: {
      notes?: string;
      downloadFilename?: string;
      editMetadata?: Record<string, unknown>;
      sourceVersionId?: string;
      sourceImages?: Blob[];
      sourceEditStates?: Record<string, unknown>[];
    } = {},
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    if (opts.notes) fd.append("notes", opts.notes);
    if (opts.downloadFilename) fd.append("download_filename", opts.downloadFilename);
    if (opts.editMetadata) fd.append("edit_metadata", JSON.stringify(opts.editMetadata));
    if (opts.sourceVersionId) fd.append("source_version_id", opts.sourceVersionId);
    if (opts.sourceImages && opts.sourceImages.length > 0) {
      opts.sourceImages.forEach((img, i) => fd.append("source_images", img, `source-${i}.jpg`));
      if (opts.sourceEditStates)
        fd.append("source_edit_states", JSON.stringify(opts.sourceEditStates));
    }
    return apiRequest<DocumentItem>(`/v1/documents/${id}/versions`, {
      method: "POST",
      formData: fd,
    });
  },

  getSourceImages: (documentId: string, versionId: string) =>
    apiRequest<{ urls: string[]; edit_states: Record<string, unknown>[] }>(
      `/v1/documents/${documentId}/versions/${versionId}/source-images`,
    ),

  makeVersionCurrent: (documentId: string, versionId: string) =>
    apiRequest<DocumentItem>(`/v1/documents/${documentId}/versions/${versionId}/make-current`, {
      method: "POST",
    }),

  restoreOriginal: (documentId: string, versionId: string) =>
    apiRequest<DocumentItem>(`/v1/documents/${documentId}/versions/${versionId}/restore-original`, {
      method: "POST",
    }),

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
