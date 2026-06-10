import { ENV } from "@core/config/env";
import { supabase } from "@core/supabase/client";
import { apiRequest, getActiveTenantId } from "@features/documents/api/http";

export interface ImportPreview {
  import_id: string;
  entity: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  errors: Array<{ row: number; field: string; message: string }>;
  sample_rows: Array<Record<string, unknown>>;
}

export interface ImportJob {
  id: string;
  entity: string;
  filename: string | null;
  status: string;
  total_rows: number | null;
  valid_rows: number | null;
  inserted_rows: number | null;
  created_at: string;
}

export const importsApi = {
  list: () => apiRequest<ImportJob[]>("/v1/imports"),
  preview: async (entity: string, file: File): Promise<ImportPreview> => {
    const fd = new FormData();
    fd.append("entity", entity);
    fd.append("file", file);
    // Multipart upload — bypass apiRequest's JSON body to keep the boundary.
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    const tenant = getActiveTenantId();
    if (tenant) headers["X-Tenant-Id"] = tenant;
    const resp = await fetch(`${ENV.API_URL}/api/v1/imports`, {
      method: "POST",
      headers,
      body: fd,
    });
    if (!resp.ok) throw new Error(`API ${resp.status}: ${await resp.text()}`);
    return resp.json();
  },
  commit: (importId: string) =>
    apiRequest<{ inserted_rows: number }>(`/v1/imports/${importId}/commit`, {
      method: "POST",
      body: {},
    }),
};
