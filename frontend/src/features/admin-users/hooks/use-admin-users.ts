import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@features/documents/api/http";

export interface AdminUserListItem {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  view: string;
  is_dev_admin: boolean;
  is_active: boolean;
  rut: string | null;
  tenant_id: string;
  created_at: string;
}

export interface AdminMembership {
  user_id: string;
  tenant_id: string;
  tenant_name?: string | null;
  tenant_slug?: string | null;
  tenants?: { id: string; name: string; slug: string };
  role: string;
  admin_scope: string[];
  is_dev_admin: boolean;
  view: string;
}

export interface AdminUserEmail {
  id: string;
  email: string;
  label: string | null;
  purpose: string;
  is_primary: boolean;
}

export interface AdminUserDetail extends AdminUserListItem {
  memberships: AdminMembership[];
  user_emails: AdminUserEmail[];
  grants: Array<{
    id: string;
    property_id: string;
    properties?: { title: string; address: string | null };
    view: string;
    capabilities: string[];
  }>;
}

export function useAdminUsersList(filters?: { role?: string; view?: string; search?: string }) {
  const params = new URLSearchParams();
  if (filters?.role) params.set("role", filters.role);
  if (filters?.view) params.set("view", filters.view);
  if (filters?.search) params.set("search", filters.search);
  const qs = params.toString();
  return useQuery({
    queryKey: ["admin-users", "list", filters],
    queryFn: () => apiRequest<AdminUserListItem[]>(`/v1/users${qs ? "?" + qs : ""}`),
  });
}

export function useAdminUserDetail(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin-users", "detail", userId],
    queryFn: () => apiRequest<AdminUserDetail>(`/v1/users/${userId}`),
    enabled: !!userId,
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (userId: string) =>
      apiRequest(`/v1/users/${userId}/reset-password`, { method: "POST" }),
  });
}

export function useResendInvite() {
  return useMutation({
    mutationFn: (userId: string) =>
      apiRequest(`/v1/users/${userId}/resend-invite`, { method: "POST" }),
  });
}

export function useSetPassword() {
  return useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      apiRequest(`/v1/users/${userId}/set-password`, {
        method: "POST",
        body: { new_password: newPassword },
      }),
  });
}

export function useDisableUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiRequest(`/v1/users/${userId}/disable`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useEnableUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiRequest(`/v1/users/${userId}/enable`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiRequest(`/v1/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useImpersonate() {
  return useMutation({
    mutationFn: (userId: string) =>
      apiRequest<{ magic_link: string }>(`/v1/users/${userId}/impersonate`, { method: "POST" }),
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest("/v1/users/invite", { method: "POST", body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, patch }: { userId: string; patch: Record<string, unknown> }) =>
      apiRequest(`/v1/users/${userId}`, { method: "PATCH", body: patch }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-users", "detail", vars.userId] });
      qc.invalidateQueries({ queryKey: ["admin-users", "list"] });
    },
  });
}

export function useUpdateMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      tenantId,
      patch,
    }: {
      userId: string;
      tenantId: string;
      patch: Record<string, unknown>;
    }) =>
      apiRequest(`/v1/admin/users/${userId}/memberships/${tenantId}`, {
        method: "PATCH",
        body: patch,
      }),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["admin-users", "detail", vars.userId] }),
  });
}

export function useAddMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: string; body: Record<string, unknown> }) =>
      apiRequest(`/v1/admin/users/${userId}/memberships`, {
        method: "POST",
        body,
      }),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["admin-users", "detail", vars.userId] }),
  });
}

export function useDeleteMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, tenantId }: { userId: string; tenantId: string }) =>
      apiRequest(`/v1/admin/users/${userId}/memberships/${tenantId}`, {
        method: "DELETE",
      }),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["admin-users", "detail", vars.userId] }),
  });
}
