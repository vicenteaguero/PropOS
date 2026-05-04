import { apiRequest } from "@features/documents/api/http";

const BASE = "/v1/user-phones";

export interface UserPhone {
  id: string;
  user_id: string;
  phone_e164: string;
  verified_at: string | null;
  created_at: string;
}

export interface AppUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export const userPhonesApi = {
  list: () => apiRequest<UserPhone[]>(BASE),
  assign: (user_id: string, phone_e164: string) =>
    apiRequest<UserPhone>(BASE, {
      method: "POST",
      body: { user_id, phone_e164, verified: true },
    }),
  unassign: (id: string) =>
    apiRequest<void>(`${BASE}/${id}`, { method: "DELETE" }),
  listUsers: () => apiRequest<AppUser[]>("/v1/users"),
};
