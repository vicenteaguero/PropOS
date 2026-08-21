import { agentActionLabel, label } from "@shared/lib/labels";

/** `agent/policies.py` → `AutonomyLevel`. Ordered least to most autonomous. */
export const AUTONOMY_LEVELS = ["observe", "suggest", "execute"] as const;

export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export interface ActionPolicy {
  /** Registry key, e.g. `create_person`. Translate with `agentActionLabel`. */
  action_kind: string;
  /** What the agent is allowed to do with this action today. */
  level: AutonomyLevel;
  /** True while no tenant override exists and the code default is in force. */
  is_default: boolean;
  /** What the code would pick, so the UI can offer "restaurar". */
  default_level: AutonomyLevel;
}

/**
 * What each level actually does, in one sentence.
 *
 * Phrased as a consequence rather than a definition, because the question an
 * admin is answering is not "what is `execute`" but "what happens to my CRM if
 * I pick it".
 */
export const AUTONOMY_LEVEL_EFFECT: Record<AutonomyLevel, string> = {
  observe: "Propo lo anota en la conversación y no toca el CRM.",
  suggest: "Propo lo deja en Pendientes y alguien lo aprueba.",
  execute: "Propo lo hace sola, sin que nadie lo revise.",
};

/** Same idea, short enough to sit under the action's name in a list row. */
export const AUTONOMY_LEVEL_SHORT: Record<AutonomyLevel, string> = {
  observe: "No escribe nada.",
  suggest: "Queda en Pendientes para aprobar.",
  execute: "Se aplica sin revisión.",
};

/**
 * How permissive a level is. `observe` < `suggest` < `execute`.
 *
 * Used to tell a loosened override from a tightened one: raising an action
 * above its code default is the change worth flagging in the UI, and lowering
 * it is never a risk.
 */
export function levelRank(level: AutonomyLevel): number {
  return level === "observe" ? 0 : level === "suggest" ? 1 : 2;
}

/** True when the tenant gave this action MORE freedom than the code default. */
export function isLoosened(policy: ActionPolicy): boolean {
  return !policy.is_default && levelRank(policy.level) > levelRank(policy.default_level);
}

/**
 * Alphabetical by the Spanish label, not by the English `action_kind` the API
 * sorts on: the reader scans "Adjuntar, Agendar, Agregar…", and ordering a
 * Spanish list by hidden English keys looks like no ordering at all.
 */
export function sortPoliciesForDisplay(policies: readonly ActionPolicy[]): ActionPolicy[] {
  return [...policies].sort((a, b) =>
    agentActionLabel(a.action_kind).localeCompare(agentActionLabel(b.action_kind), "es"),
  );
}

/** Spanish name of a level, via the shared registry. */
export function levelLabel(level: AutonomyLevel): string {
  return label("autonomyLevel", level);
}
