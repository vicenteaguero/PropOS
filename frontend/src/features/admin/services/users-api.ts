import { ENV } from "@core/config/env";
import { API_PREFIX } from "@core/config/constants";
import { createLogger } from "@core/logging/logger";
import { supabase } from "@core/supabase/client";
import type { ApiResponse } from "@shared/types/api";
import type { User } from "@features/admin/types";

const logger = createLogger("UsersAPI");

const USERS_ENDPOINT = `${ENV.API_URL}${API_PREFIX}/users`;

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  logger.info("request", `${options?.method ?? "GET"} ${url}`);

  const { data: { session } } = await supabase.auth.getSession();
  const authHeaders: Record<string, string> = session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("error", `Request failed: ${response.status}`, { url });
    return { data: null as unknown as T, error: errorText };
  }

  const data = (await response.json()) as T;
  return { data, error: null };
}

export async function fetchUsers(): Promise<ApiResponse<User[]>> {
  return request<User[]>(USERS_ENDPOINT);
}

export async function fetchUser(id: string): Promise<ApiResponse<User>> {
  return request<User>(`${USERS_ENDPOINT}/${id}`);
}
