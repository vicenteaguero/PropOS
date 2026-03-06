export type ProjectStatus = "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED";

export interface Project {
  id: string;
  title: string;
  slug: string;
  status: ProjectStatus;
  property_id: string | null;
  tenant_id: string;
  microsite_config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
