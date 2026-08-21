import { ENV } from "@core/config/env";
import { ApiError } from "./api-error";
import { supabase } from "@core/supabase/client";

const API_BASE = `${ENV.API_URL}/api`;
const ACTIVE_TENANT_KEY = "propos.active_tenant_id";
const DEV_SCHEMA_KEY = "propos.dev_db_schema";

/**
 * Dev-only Postgres schema override.
 *
 * The backend reads `X-Db-Schema` and swaps its Supabase client for the
 * request; the middleware that honours it is only installed when APP_ENV is
 * development, so the header is inert against staging or production. Stored in
 * localStorage rather than React state so a reload keeps the choice.
 */
export function getDevSchema(): string | null {
  if (!import.meta.env.DEV) return null;
  try {
    return localStorage.getItem(DEV_SCHEMA_KEY);
  } catch {
    return null;
  }
}

export function setDevSchema(schema: string | null): void {
  try {
    if (schema && schema !== "public") localStorage.setItem(DEV_SCHEMA_KEY, schema);
    else localStorage.removeItem(DEV_SCHEMA_KEY);
  } catch {
    /* ignore (private browsing etc.) */
  }
}

export function getActiveTenantId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_TENANT_KEY);
  } catch {
    return null;
  }
}

export function setActiveTenantId(tenantId: string | null): void {
  try {
    if (tenantId) {
      localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
    } else {
      localStorage.removeItem(ACTIVE_TENANT_KEY);
    }
  } catch {
    /* ignore (private browsing etc.) */
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const tenant = getActiveTenantId();
  if (tenant) headers["X-Tenant-Id"] = tenant;
  const schema = getDevSchema();
  if (schema) headers["X-Db-Schema"] = schema;
  return headers;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
}

export { ApiError };

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = await authHeaders();
  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const response = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body,
    signal: opts.signal,
  });
  if (!response.ok) {
    throw await ApiError.from(response);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function publicUrl(path: string): string {
  return `${ENV.API_URL}${path}`;
}
