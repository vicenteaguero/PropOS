import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { agentPoliciesApi, type ActionPolicy, type AutonomyLevel } from "../api/agent-policies-api";

const KEY = ["agent", "policies"] as const;

export function useAgentPolicies() {
  return useQuery({ queryKey: KEY, queryFn: () => agentPoliciesApi.list() });
}

/**
 * Writes one action's level, or clears the override when `level` is null.
 *
 * Optimistic because the control is a segmented switch: waiting for the round
 * trip leaves the thumb on the old segment for as long as the network takes,
 * which reads as "the tap did not register" and invites a second tap onto a
 * third level.
 */
export function useSetAgentPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ actionKind, level }: { actionKind: string; level: AutonomyLevel | null }) =>
      level === null ? agentPoliciesApi.reset(actionKind) : agentPoliciesApi.set(actionKind, level),
    onMutate: async ({ actionKind, level }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<ActionPolicy[]>(KEY);
      qc.setQueryData<ActionPolicy[]>(KEY, (rows) =>
        rows?.map((row) =>
          row.action_kind === actionKind
            ? {
                ...row,
                level: level ?? row.default_level,
                is_default: level === null || level === row.default_level ? level === null : false,
              }
            : row,
        ),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(KEY, ctx.previous);
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el permiso");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
