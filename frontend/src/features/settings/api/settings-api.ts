import { apiRequest } from "@shared/api/http";
import { supabase } from "@core/supabase/client";

export interface TenantSettings {
  ai_assistant_name: string;
  default_paper_size: string;
  brand_color?: string | null;
  /** 0-12: surface tint strength. See --tint in index.css. */
  brand_tint?: number | null;
}

export interface TenantResponse {
  id: string;
  name: string;
  slug: string;
  settings: TenantSettings;
}

export interface UserMe {
  id: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  email: string | null;
  rut: string | null;
  admin_scope: string[];
}

export const settingsApi = {
  getTenant: () => apiRequest<TenantResponse>("/v1/tenants/me"),

  updateTenant: (body: Partial<TenantSettings>) =>
    apiRequest<TenantResponse>("/v1/tenants/me", {
      method: "PATCH",
      body,
    }),

  getMe: () => apiRequest<UserMe>("/v1/users/me"),

  /**
   * Merge a partial preferences patch into the caller's own profile. Partial on
   * the server too: sending `{ palette }` cannot wipe a preference added later.
   */
  updatePreferences: (preferences: Record<string, unknown>) =>
    apiRequest<UserMe>("/v1/users/me/preferences", {
      method: "PATCH",
      body: { preferences },
    }),

  updateAvatar: (avatar_url: string | null) =>
    apiRequest<UserMe>("/v1/users/me/avatar", {
      method: "PATCH",
      body: { avatar_url },
    }),

  /** Upload directly to Supabase Storage 'avatars' bucket. Returns public URL. */
  async uploadAvatar(userId: string, file: File): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  },
};
