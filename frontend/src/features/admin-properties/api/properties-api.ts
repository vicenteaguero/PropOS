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
  /** Returned by the API and required by the map; previously dropped here. */
  lat: number | null;
  lng: number | null;
  /** Signed `card` derivative of the first photo, or null when there are none. */
  cover_url: string | null;
  /**
   * Where each fact came from. A missing key means nobody recorded it.
   *
   * Without this every field reads equally true: the 120 m² the owner
   * mentioned on the phone sits in the same column, rendered the same way, as
   * the 118.4 on the certificado — and an assistant reading the row states
   * both with the same confidence.
   */
  provenance: Record<string, { src: "verified" | "declared" | "derived"; at?: string }>;
  building_id: string | null;
  unit_label: string | null;
}

/** How sure we are about one field. */
export type Provenance = "verified" | "declared" | "derived" | "unknown";

export function provenanceOf(property: Property, field: string): Provenance {
  return property.provenance?.[field]?.src ?? "unknown";
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
  /** Full-resolution original. Only the lightbox should load this. */
  url: string;
  /** ~400px WebP; falls back to `url` when the photo has no derivative yet. */
  thumb_url: string;
  /** ~800px WebP; same fallback. */
  card_url: string;
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
  /** `q` is matched server-side, so search reaches past the 100-row cap. */
  list: (params: { q?: string } = {}) =>
    apiRequest<Property[]>(
      `/v1/properties${params.q?.trim() ? `?q=${encodeURIComponent(params.q.trim())}` : ""}`,
    ),
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
