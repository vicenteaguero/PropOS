import { describe, expect, it } from "vitest";
import {
  AGENT_ACTION_LABELS,
  AUTONOMY_LEVEL_LABELS,
  EVIDENCE_SOURCE_LABELS,
  REJECT_REASON_LABELS,
  agentActionLabel,
  label,
} from "./labels";

/**
 * `agent/intent_registry.py` → `REGISTRY` keys, as of the autonomy contract.
 * A backend that adds an intent without a label here renders raw English in a
 * Spanish settings screen, so the list is pinned rather than inferred.
 */
const REGISTRY_ACTIONS = [
  "add_note",
  "attach_photos_to_property",
  "create_campaign",
  "create_document_from_photos",
  "create_event",
  "create_organization",
  "create_person",
  "create_property",
  "create_task",
  "log_interaction",
  "log_transaction",
  "update_person",
];

describe("agentActionLabel", () => {
  it("translates every action the agent registry knows", () => {
    for (const action of REGISTRY_ACTIONS) {
      expect(AGENT_ACTION_LABELS[action], action).toBeTruthy();
    }
  });

  it("carries no label for an action the registry does not have", () => {
    expect(Object.keys(AGENT_ACTION_LABELS).sort()).toEqual([...REGISTRY_ACTIONS].sort());
  });

  it("accepts the bare action_kind the settings screen uses", () => {
    expect(agentActionLabel("create_person")).toBe("Crear persona");
  });

  it("accepts the propose_-prefixed kind a queued proposal carries", () => {
    expect(agentActionLabel("propose_create_person")).toBe("Crear persona");
    expect(agentActionLabel("propose_log_transaction")).toBe("Registrar movimiento");
  });

  it("falls back to the raw token rather than blanking the card", () => {
    expect(agentActionLabel("propose_teleport_client")).toBe("teleport_client");
  });

  it("renders the em-dash for a missing kind", () => {
    expect(agentActionLabel(null)).toBe("—");
    expect(agentActionLabel(undefined)).toBe("—");
  });
});

describe("autonomy and review vocabularies", () => {
  it("names the three autonomy levels in Spanish", () => {
    expect(AUTONOMY_LEVEL_LABELS).toEqual({
      observe: "Observa",
      suggest: "Sugiere",
      execute: "Ejecuta",
    });
  });

  it("covers the whole RejectReason taxonomy", () => {
    expect(Object.keys(REJECT_REASON_LABELS).sort()).toEqual([
      "dato_incorrecto",
      "duplicado",
      "entidad_equivocada",
      "no_corresponde",
      "otro",
    ]);
  });

  it("covers every evidence source the agent can capture", () => {
    expect(Object.keys(EVIDENCE_SOURCE_LABELS).sort()).toEqual([
      "chat",
      "email",
      "voice",
      "whatsapp",
    ]);
  });

  it("resolves through the shared registry, not a local map", () => {
    expect(label("autonomyLevel", "execute")).toBe("Ejecuta");
    expect(label("rejectReason", "entidad_equivocada")).toBe("Persona o propiedad equivocada");
    expect(label("evidenceSource", "voice")).toBe("Nota de voz");
  });
});
