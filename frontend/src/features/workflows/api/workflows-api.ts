import { apiRequest } from "@features/documents/api/http";

export interface Workflow {
  id: string;
  tenant_id: string;
  name: string;
  scope_table: string | null;
  scope_row_id: string | null;
  state: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "CANCELLED";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  tenant_id: string;
  name: string;
  position: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "CANCELLED";
  completed_at: string | null;
  notes: string | null;
}

export const workflowsApi = {
  list: () => apiRequest<Workflow[]>("/v1/workflows"),
  create: (body: { name: string; steps?: string[]; scope_table?: string; scope_row_id?: string }) =>
    apiRequest<Workflow>("/v1/workflows", { method: "POST", body }),
  listSteps: (workflowId: string) =>
    apiRequest<WorkflowStep[]>(`/v1/workflows/${workflowId}/steps`),
  updateStep: (stepId: string, body: { status?: string; notes?: string; completed_at?: string }) =>
    apiRequest<WorkflowStep>(`/v1/workflows/steps/${stepId}`, {
      method: "PATCH",
      body,
    }),
};
