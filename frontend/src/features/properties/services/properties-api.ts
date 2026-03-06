import { ENV } from "@core/config/env";
import { API_PREFIX } from "@core/config/constants";
import { createLogger } from "@core/logging/logger";
import { supabase } from "@core/supabase/client";
import type { ApiResponse } from "@shared/types/api";
import type { Property, CreatePropertyPayload, UpdatePropertyPayload } from "@features/properties/types";

const logger = createLogger("PropertiesAPI");

const PROPERTIES_ENDPOINT = `${ENV.API_URL}${API_PREFIX}/properties`;

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

export async function fetchProperties(): Promise<ApiResponse<Property[]>> {
  return request<Property[]>(PROPERTIES_ENDPOINT);
}

export async function fetchProperty(id: string): Promise<ApiResponse<Property>> {
  return request<Property>(`${PROPERTIES_ENDPOINT}/${id}`);
}

export async function createProperty(
  payload: CreatePropertyPayload,
): Promise<ApiResponse<Property>> {
  return request<Property>(PROPERTIES_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProperty(
  payload: UpdatePropertyPayload,
): Promise<ApiResponse<Property>> {
  const { id, ...body } = payload;
  return request<Property>(`${PROPERTIES_ENDPOINT}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteProperty(id: string): Promise<ApiResponse<null>> {
  return request<null>(`${PROPERTIES_ENDPOINT}/${id}`, {
    method: "DELETE",
  });
}
