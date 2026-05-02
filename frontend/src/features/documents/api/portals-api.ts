import type {
  AnonymousUpload,
  AssignmentTarget,
  DocumentItem,
  Portal,
  PortalAccess,
} from "../types";
import { apiRequest, publicUrl } from "./http";

export interface CreatePortalInput {
  title: string;
  description?: string;
  access_mode: PortalAccess;
  password?: string;
  default_property_id?: string;
  default_contact_id?: string;
  default_internal_area_id?: string;
  max_file_size_mb?: number;
  expires_at?: string;
}

export interface PromoteUploadInput {
  display_name: string;
  assignments: Array<{
    target_kind: AssignmentTarget;
    contact_id?: string;
    property_id?: string;
    internal_area_id?: string;
  }>;
}

export interface PublicPortalView {
  slug: string;
  title: string;
  description: string | null;
  max_file_size_mb: number;
  requires_password: boolean;
}

export const portalsApi = {
  list: () => apiRequest<Portal[]>("/v1/portals"),

  get: (id: string) => apiRequest<Portal>(`/v1/portals/${id}`),

  create: (input: CreatePortalInput) =>
    apiRequest<Portal>("/v1/portals", { method: "POST", body: input }),

  update: (
    id: string,
    input: Partial<CreatePortalInput> & { is_active?: boolean; clear_password?: boolean },
  ) => apiRequest<Portal>(`/v1/portals/${id}`, { method: "PATCH", body: input }),

  remove: (id: string) => apiRequest<void>(`/v1/portals/${id}`, { method: "DELETE" }),

  uploads: (portalId: string) => apiRequest<AnonymousUpload[]>(`/v1/portals/${portalId}/uploads`),

  promote: (uploadId: string, input: PromoteUploadInput) =>
    apiRequest<DocumentItem>(`/v1/uploads/${uploadId}/promote`, {
      method: "POST",
      body: input,
    }),

  reject: (uploadId: string) =>
    apiRequest<void>(`/v1/uploads/${uploadId}/reject`, { method: "POST" }),

  publicUrl: (slug: string) => publicUrl(`/p/${slug}`),

  publicView: async (slug: string): Promise<PublicPortalView> => {
    const res = await fetch(publicUrl(`/p/${slug}`));
    if (!res.ok) throw new Error(`portal ${res.status}`);
    return res.json() as Promise<PublicPortalView>;
  },

  publicUpload: async (
    slug: string,
    file: File,
    uploaderLabel: string | undefined,
    consent: boolean,
    password: string | undefined,
  ): Promise<AnonymousUpload> => {
    const fd = new FormData();
    fd.append("file", file);
    if (uploaderLabel) fd.append("uploader_label", uploaderLabel);
    fd.append("consent", consent ? "true" : "false");
    if (password) fd.append("password", password);
    const res = await fetch(publicUrl(`/p/${slug}/upload`), {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`upload ${res.status}: ${text}`);
    }
    return res.json() as Promise<AnonymousUpload>;
  },
};
