import type { PendingProposal } from "@features/agent/types";
import { agentActionLabel } from "@shared/lib/labels";

/**
 * The sentence a card leads with.
 *
 * Composed server-side now (`backend/app/features/agent/summaries.py`) so the
 * chat reply and this card cannot drift. This is only the fallback for rows
 * written before that existed, whose `summary_es` is a bare label like "tarea"
 * or "actualizar contacto" — the exact thing the rewrite was for. Those rows do
 * not get a sentence, but they can at least get the subject's name.
 */
export function proposalHeadline(proposal: PendingProposal): string {
  const summary = proposal.payload?.summary_es;
  if (typeof summary === "string" && summary.trim().split(/\s+/).length > 3) {
    return summary.trim();
  }

  const action = agentActionLabel(proposal.kind);
  const subject = subjectOf(proposal);
  return subject ? `${action} · ${subject}` : action;
}

/** Whoever or whatever the proposal is about, from its resolved payload. */
function subjectOf(proposal: PendingProposal): string | null {
  const payload = (proposal.resolved_payload ?? proposal.payload ?? {}) as Record<string, unknown>;
  for (const key of ["full_name", "person", "title", "property", "name"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
