export type UserRole = "ADMIN" | "AGENT" | "LANDOWNER" | "BUYER" | "CONTENT";

export interface User {
  id: string;
  full_name: string | null;
  role: UserRole;
  tenant_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
