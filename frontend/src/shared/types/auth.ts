export type UserRole = "ADMIN" | "AGENT" | "LANDOWNER" | "BUYER" | "CONTENT";

export interface UserProfile {
  id: string;
  fullName: string;
  role: UserRole;
  tenantId: string;
  isActive: boolean;
}

export interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
