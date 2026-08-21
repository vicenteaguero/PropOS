import { apiRequest } from "@shared/api/http";
import type { ActionPolicy, AutonomyLevel } from "../lib/autonomy";

const BASE = "/v1/agent/policies";

export type { ActionPolicy, AutonomyLevel };

export const agentPoliciesApi = {
  list: () => apiRequest<ActionPolicy[]>(BASE),

  set: (actionKind: string, level: AutonomyLevel) =>
    apiRequest<ActionPolicy>(`${BASE}/${actionKind}`, {
      method: "PUT",
      body: { level },
    }),

  reset: (actionKind: string) =>
    apiRequest<ActionPolicy>(`${BASE}/${actionKind}`, { method: "DELETE" }),
};
