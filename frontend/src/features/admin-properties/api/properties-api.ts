import { apiRequest } from "@shared/api/http";

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

/** A photo linked to the property. `url` is a short-lived signed URL. */
export interface PropertyPhoto {
  id: string;
  media_file_id: string;
  url: string;
  role: string;
  position: number;
  title: string | null;
  created_at: string | null;
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
  photos: (id: string) => apiRequest<PropertyPhoto[]>(`/v1/properties/${id}/photos`),
  uploadPhotos: (id: string, files: File[]) => {
    const fd = new FormData();
    files.forEach((file) => fd.append("files", file, file.name));
    return apiRequest<PropertyPhoto[]>(`/v1/properties/${id}/photos`, {
      method: "POST",
      formData: fd,
    });
  },
  deletePhoto: (id: string, assetId: string) =>
    apiRequest<void>(`/v1/properties/${id}/photos/${assetId}`, { method: "DELETE" }),
  generateDescription: (id: string, tone: string, portal: string) =>
    apiRequest<GeneratedDescription>(`/v1/properties/${id}/generate-description`, {
      method: "POST",
      body: { tone, portal },
    }),
};
