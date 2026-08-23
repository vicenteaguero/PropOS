import type { ContactLite, InternalAreaLite, PropertyLite } from "../types";
import { apiRequest } from "@shared/api/http";
import { qs } from "@shared/lib/query-string";

export const entitiesApi = {
  // `limit` because the backend defaults to 100 and the deals board joins 500
  // opportunities against it: without it, four fifths of the board resolved to
  // no property title at all, which reads as missing data rather than a cap.
  listProperties: (q?: string, limit?: number) =>
    apiRequest<PropertyLite[]>(`/v1/properties${qs({ q: q || undefined, limit })}`),
  createProperty: (title: string, isDraft = true) =>
    apiRequest<PropertyLite>("/v1/properties", {
      method: "POST",
      body: { title, is_draft: isDraft },
    }),

  listContacts: (q?: string, propertyId?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (propertyId) params.set("property_id", propertyId);
    const qs = params.toString();
    return apiRequest<ContactLite[]>(`/v1/contacts${qs ? `?${qs}` : ""}`);
  },
  createContact: (fullName: string, isDraft = true) =>
    apiRequest<ContactLite>("/v1/contacts", {
      method: "POST",
      body: { full_name: fullName, is_draft: isDraft },
    }),

  listAreas: () => apiRequest<InternalAreaLite[]>("/v1/internal-areas"),
};
