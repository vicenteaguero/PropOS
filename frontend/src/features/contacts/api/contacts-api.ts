import { apiRequest } from "@shared/api/http";
import type { Contact, ContactInput } from "../types";
import { qs } from "@shared/lib/query-string";

export interface ListContactsParams {
  q?: string;
  type?: string;
  include_deleted?: boolean;
  limit?: number;
}

export const contactsApi = {
  list: (params: ListContactsParams = {}) =>
    apiRequest<Contact[]>(
      `/v1/contacts${qs({ q: params.q, include_deleted: params.include_deleted, limit: params.limit })}`,
    ),
  get: (id: string) => apiRequest<Contact>(`/v1/contacts/${id}`),
  create: (body: ContactInput) => apiRequest<Contact>("/v1/contacts", { method: "POST", body }),
  update: (id: string, body: Partial<ContactInput>) =>
    apiRequest<Contact>(`/v1/contacts/${id}`, { method: "PATCH", body }),
  remove: (id: string) => apiRequest<void>(`/v1/contacts/${id}`, { method: "DELETE" }),
};
