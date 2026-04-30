import type { ContactLite, InternalAreaLite, PropertyLite } from "../types";
import { apiRequest } from "./http";

export const entitiesApi = {
  listProperties: (q?: string) =>
    apiRequest<PropertyLite[]>(
      `/v1/properties${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
  createProperty: (title: string, isDraft = true) =>
    apiRequest<PropertyLite>("/v1/properties", {
      method: "POST",
      body: { title, is_draft: isDraft },
    }),

  listContacts: (q?: string) =>
    apiRequest<ContactLite[]>(
      `/v1/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
  createContact: (fullName: string, isDraft = true) =>
    apiRequest<ContactLite>("/v1/contacts", {
      method: "POST",
      body: { full_name: fullName, is_draft: isDraft },
    }),

  listAreas: () => apiRequest<InternalAreaLite[]>("/v1/internal-areas"),
};
