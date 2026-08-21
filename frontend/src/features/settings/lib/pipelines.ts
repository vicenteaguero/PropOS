/**
 * Pipelines, and the rules that say which stage moves are legal.
 *
 * `pipeline_transitions` carries two independent facts per pair of stages: is
 * the move legal at all, and may an AI make it. Stored as presence-of-a-row
 * plus a boolean, those read as a sparse table nobody can hold in their head.
 * Collapsed into one three-way value per pair they become a setting:
 *
 *   none  → the row does not exist; `assert_allowed` refuses the move
 *   agent → the row exists, requires_human = false; Propo may do it
 *   human → the row exists, requires_human = true; only a person may
 *
 * The origin `null` is NOT a missing value. It is the "from any stage" rule —
 * abandoning a deal is legal wherever it sits, and spelling that out once
 * beats one row per origin.
 */

/** Sentinel for the null origin, because a React key cannot be null. */
export const ANY_STAGE = "__any__";

export type TransitionMode = "none" | "agent" | "human";

export interface PipelineTransition {
  from_stage: string | null;
  to_stage: string;
  requires_human: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  stages: string[];
  is_default: boolean;
  transitions: PipelineTransition[];
  deal_count: number;
}

function originOf(key: string): string | null {
  return key === ANY_STAGE ? null : key;
}

/** The current mode for one origin/target pair. */
export function modeFor(
  transitions: PipelineTransition[],
  fromKey: string,
  to: string,
): TransitionMode {
  const from = originOf(fromKey);
  const hit = transitions.find((t) => t.from_stage === from && t.to_stage === to);
  if (!hit) return "none";
  return hit.requires_human ? "human" : "agent";
}

/** Sets one pair, adding, flipping or removing the row as needed. */
export function setMode(
  transitions: PipelineTransition[],
  fromKey: string,
  to: string,
  mode: TransitionMode,
): PipelineTransition[] {
  const from = originOf(fromKey);
  const without = transitions.filter((t) => !(t.from_stage === from && t.to_stage === to));
  if (mode === "none") return without;
  return [...without, { from_stage: from, to_stage: to, requires_human: mode === "human" }];
}

/**
 * A pipeline with no declared transitions is UNCONSTRAINED, not locked.
 *
 * `assert_allowed` returns early when the rule set is empty rather than
 * freezing a tenant that never configured one. The consequence is
 * counter-intuitive and destructive: removing the last rule does not tighten
 * the pipeline, it switches the whole state machine off — including the
 * `requires_human` line Propo is not supposed to cross.
 */
export function isUnconstrained(transitions: PipelineTransition[]): boolean {
  return transitions.length === 0;
}

export interface PipelineSummary {
  declared: number;
  human: number;
  fromAny: number;
}

export function summarize(transitions: PipelineTransition[]): PipelineSummary {
  return {
    declared: transitions.length,
    human: transitions.filter((t) => t.requires_human).length,
    fromAny: transitions.filter((t) => t.from_stage === null).length,
  };
}

/**
 * Renames a stage and carries its rules with it.
 *
 * Transitions match the deal's stage by string equality, so renaming a stage
 * without rewriting the rules that name it leaves every one of them pointing
 * at a stage that no longer exists — legal-looking rows that can never fire.
 */
export function renameStage(
  transitions: PipelineTransition[],
  from: string,
  to: string,
): PipelineTransition[] {
  return transitions.map((t) => ({
    ...t,
    from_stage: t.from_stage === from ? to : t.from_stage,
    to_stage: t.to_stage === from ? to : t.to_stage,
  }));
}

/**
 * Everywhere a deal on this pipeline can be sent: the ordered stages, then any
 * destination the rules already name that is not one of them.
 *
 * The seeded pipelines all declare `NULL → LOST` while LOST is deliberately
 * absent from `stages` — abandoning a deal takes it out of the flow rather
 * than along it. An editor that only offered the stage list would not show
 * that rule, and since saving replaces the whole rule set, it would delete the
 * one rule that lets anybody abandon a deal.
 */
export function destinationsFor(
  stages: string[],
  transitions: PipelineTransition[],
  extra: string[] = [],
): string[] {
  const inFlow = stages.filter(Boolean);
  const known = new Set(inFlow);
  const outside: string[] = [];
  for (const name of [...transitions.map((t) => t.to_stage), ...extra]) {
    if (name && !known.has(name)) {
      known.add(name);
      outside.push(name);
    }
  }
  return [...inFlow, ...outside.sort((a, b) => a.localeCompare(b, "es"))];
}

/** Destinations that are not stages of the flow — terminal states like LOST. */
export function terminalDestinations(stages: string[], destinations: string[]): string[] {
  const inFlow = new Set(stages.filter(Boolean));
  return destinations.filter((d) => !inFlow.has(d));
}

/** Drops a stage and every rule that mentions it. */
export function dropStage(transitions: PipelineTransition[], stage: string): PipelineTransition[] {
  return transitions.filter((t) => t.from_stage !== stage && t.to_stage !== stage);
}

export function moveStage(stages: string[], index: number, delta: -1 | 1): string[] {
  const target = index + delta;
  if (target < 0 || target >= stages.length) return stages;
  const next = [...stages];
  const held = next[index]!;
  next[index] = next[target]!;
  next[target] = held;
  return next;
}

/** The reason a pipeline cannot be saved, in Spanish, or null. */
export function pipelineIssue(name: string, stages: string[]): string | null {
  if (!name.trim()) return "Ponle un nombre al pipeline.";
  const clean = stages.map((s) => s.trim());
  if (clean.length === 0) return "Agrega al menos una etapa.";
  const blank = clean.findIndex((s) => !s);
  if (blank >= 0) return `La etapa ${blank + 1} no tiene nombre.`;
  if (new Set(clean).size !== clean.length) return "Hay dos etapas con el mismo nombre.";
  return null;
}
