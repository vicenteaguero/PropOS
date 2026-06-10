import { apiRequest } from "@features/documents/api/http";

export interface Property {
  id: string;
  tenant_id: string;
  title: string;
  address: string | null;
  status: string;
  is_draft: boolean;
  description: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: number | null;
  list_price_cents: number | null;
  currency: string;
  listing_kind: string;
  year_built: number | null;
}

export interface PropertyInput {
  title: string;
  address?: string | null;
  status?: string;
  description?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  area_sqm?: number | null;
  list_price_cents?: number | null;
  listing_kind?: string;
  year_built?: number | null;
}

export interface GeneratedDescription {
  title_suggestion: string;
  description: string;
  highlights: string[];
}

export const propertiesApi = {
  list: () => apiRequest<Property[]>("/v1/properties"),
  get: (id: string) => apiRequest<Property>(`/v1/properties/${id}`),
  create: (body: PropertyInput) => apiRequest<Property>("/v1/properties", { method: "POST", body }),
  update: (id: string, body: Partial<PropertyInput>) =>
    apiRequest<Property>(`/v1/properties/${id}`, { method: "PATCH", body }),
  generateDescription: (id: string, tone: string, portal: string) =>
    apiRequest<GeneratedDescription>(`/v1/properties/${id}/generate-description`, {
      method: "POST",
      body: { tone, portal },
    }),
};
