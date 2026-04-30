import type { ShareLink, ShareLinkPublicView } from "../types";
import { apiRequest, publicUrl } from "./http";

export interface CreateShareInput {
  document_id: string;
  pinned_version_id?: string | null;
  password?: string | null;
  expires_at?: string | null;
  download_filename_override?: string | null;
}

export interface UpdateShareInput {
  document_id?: string;
  pinned_version_id?: string | null;
  password?: string | null;
  clear_password?: boolean;
  expires_at?: string | null;
  download_filename_override?: string | null;
  is_active?: boolean;
}

export const shareLinksApi = {
  list: () => apiRequest<ShareLink[]>("/v1/share-links"),

  create: (documentId: string, input: CreateShareInput) =>
    apiRequest<ShareLink>(`/v1/documents/${documentId}/share-links`, {
      method: "POST",
      body: { ...input, document_id: documentId },
    }),

  update: (linkId: string, input: UpdateShareInput) =>
    apiRequest<ShareLink>(`/v1/share-links/${linkId}`, {
      method: "PATCH",
      body: input,
    }),

  remove: (linkId: string) =>
    apiRequest<void>(`/v1/share-links/${linkId}`, { method: "DELETE" }),

  publicShortLinkUrl: (slug: string) => publicUrl(`/r/${slug}`),

  // Llamada pública (sin auth) al backend para obtener el preview de un slug.
  resolvePublic: async (slug: string): Promise<ShareLinkPublicView> => {
    const res = await fetch(publicUrl(`/r/${slug}`));
    if (res.status === 401) {
      const view = (await res.json()) as ShareLinkPublicView;
      return { ...view, requires_password: true };
    }
    if (!res.ok) throw new Error(`shortlink ${res.status}`);
    return res.json() as Promise<ShareLinkPublicView>;
  },

  resolvePublicWithPassword: async (
    slug: string,
    password: string,
  ): Promise<ShareLinkPublicView> => {
    const fd = new FormData();
    fd.append("password", password);
    const res = await fetch(publicUrl(`/r/${slug}/verify-password`), {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new Error(`shortlink ${res.status}`);
    return res.json() as Promise<ShareLinkPublicView>;
  },
};
