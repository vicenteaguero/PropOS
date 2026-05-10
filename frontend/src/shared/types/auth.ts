export type UserRole = "ADMIN" | "AGENT" | "LANDOWNER" | "BUYER" | "CONTENT";

export type UserView = "admin" | "admin-dev" | "agent" | "owner" | "buyer" | "content";

export interface UserProfile {
  id: string;
  fullName: string;
  role: UserRole;
  tenantId: string;
  isActive: boolean;
  avatarUrl: string | null;
  adminScope: string[];
  isDevAdmin: boolean;
  view: UserView;
}

export interface TenantMembership {
  userId: string;
  tenantId: string;
  tenantName: string | null;
  tenantSlug: string | null;
  role: UserRole;
  adminScope: string[];
  isDevAdmin: boolean;
  view: UserView;
  isActive: boolean;
}

export interface PropertyGrant {
  id: string;
  userId: string;
  propertyId: string;
  tenantId: string;
  view: UserView;
  capabilities: string[];
  propertyTitle: string | null;
  propertyAddress: string | null;
  grantedBy: string | null;
}

export interface AuthState {
  user: UserProfile | null;
  memberships: TenantMembership[];
  grants: PropertyGrant[];
  isLoading: boolean;
  isAuthenticated: boolean;
}
