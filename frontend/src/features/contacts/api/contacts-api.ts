import { apiRequest } from "@shared/api/http";
import type { Contact, ContactInput } from "../types";
import { qs } from "@shared/lib/query-string";

export interface ListContactsParams {
  q?: string;
  include_deleted?: boolean;
  limit?: number;
  /** Row to start at. The endpoint has always accepted it; nothing sent it. */
  offset?: number;
}
// `type` used to be declared here and silently dropped before the request. It
// also sat in the query key, so two different values cached separately while
// returning identical rows. The endpoint has no such filter, and since the
// Clientes rewrite `contacts.type` is a denormalised hint rather than the
// truth — role is contextual, in property_stakeholders / opportunity_participants.

export const contactsApi = {
  list: (params: ListContactsParams = {}) =>
    apiRequest<Contact[]>(
      `/v1/contacts${qs({
        q: params.q,
        include_deleted: params.include_deleted,
        limit: params.limit,
        offset: params.offset,
      })}`,
    ),
  get: (id: string) => apiRequest<Contact>(`/v1/contacts/${id}`),
  create: (body: ContactInput) => apiRequest<Contact>("/v1/contacts", { method: "POST", body }),
  update: (id: string, body: Partial<ContactInput>) =>
    apiRequest<Contact>(`/v1/contacts/${id}`, { method: "PATCH", body }),
  remove: (id: string) => apiRequest<void>(`/v1/contacts/${id}`, { method: "DELETE" }),
};
