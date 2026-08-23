import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Globe, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Field,
  FieldGroup,
  FOCUS_RING,
  ResponsiveSheet,
  SectionLabel,
  SheetActions,
  TOUCH_TARGET_COARSE,
  ChoiceSwitch,
} from "@shared/ui";
import { label } from "@shared/lib/labels";
import type { PipelineWrite } from "../api/catalogs-api";
import {
  ANY_STAGE,
  destinationsFor,
  dropStage,
  isUnconstrained,
  modeFor,
  moveStage,
  pipelineIssue,
  renameStage,
  setMode,
  summarize,
  terminalDestinations,
  type Pipeline,
  type PipelineTransition,
  type TransitionMode,
} from "../lib/pipelines";

const MODES: { value: TransitionMode; label: string; activeClassName?: string }[] = [
  { value: "none", label: "No se puede" },
  { value: "agent", label: "Propo puede" },
  {
    value: "human",
    label: "Sólo persona",
    activeClassName: "bg-warning text-warning-foreground",
  },
];

function stageLabel(stage: string): string {
  return label("pipelineStage", stage);
}

/**
 * The banner for the state the migration made possible and nobody expects.
 *
 * `assert_allowed` returns early when a pipeline has no declared transitions,
 * so removing the last rule does not lock the pipeline down — it turns the
 * whole state machine off, `requires_human` included. Somebody tidying up
 * rules one at a time would otherwise discover this only when Propo closed a
 * deal on its own.
 */
function UnconstrainedNotice() {
  return (
    <p className="flex items-start gap-2 rounded-[var(--radius)] bg-warning/12 p-3 text-[13px] leading-snug text-warning">
      <AlertTriangle className="mt-px size-4 shrink-0" strokeWidth={1.9} />
      <span>
        Sin reglas declaradas cualquier movimiento queda permitido, y Propo puede hacerlos todos —
        incluido cerrar o dar por perdido un negocio. Quitar la última regla no cierra el pipeline:
        lo abre.
      </span>
    </p>
  );
}

function StageEditor({
  stages,
  onChange,
}: {
  stages: string[];
  onChange: (next: string[], renamed?: { from: string; to: string }, dropped?: string) => void;
}) {
  // The name a field held when editing started, so the rules follow the whole
  // rename rather than each keystroke of it.
  //
  // Per-keystroke was wrong in a way that only shows up on real data: renaming
  // "LEAD" passes through "L", "LE", … and if any intermediate value happens to
  // equal ANOTHER stage's name, that stage's rules get dragged along with it.
  // One commit of the name, on blur, cannot collide with anything.
  const original = useRef<string | null>(null);

  return (
    <ul className="space-y-1.5">
      {stages.map((stage, index) => (
        <li key={index} className="flex items-center gap-2">
          <span className="w-5 shrink-0 text-center font-mono text-[12px] tabular-nums text-faint">
            {index + 1}
          </span>
          <Input
            value={stage}
            aria-label={`Etapa ${index + 1}`}
            className="h-10 font-mono text-[13px]"
            onFocus={() => {
              original.current = stage;
            }}
            onChange={(e) => onChange(stages.map((s, i) => (i === index ? e.target.value : s)))}
            onBlur={() => {
              const from = original.current;
              original.current = null;
              if (from !== null && from !== stage) onChange(stages, { from, to: stage });
            }}
          />
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => onChange(moveStage(stages, index, -1))}
              disabled={index === 0}
              aria-label={`Subir la etapa ${index + 1}`}
              className={cn(
                "flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary disabled:opacity-25",
                TOUCH_TARGET_COARSE,
                FOCUS_RING,
              )}
            >
              <ChevronUp className="size-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => onChange(moveStage(stages, index, 1))}
              disabled={index === stages.length - 1}
              aria-label={`Bajar la etapa ${index + 1}`}
              className={cn(
                "flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary disabled:opacity-25",
                TOUCH_TARGET_COARSE,
                FOCUS_RING,
              )}
            >
              <ChevronDown className="size-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() =>
                onChange(
                  stages.filter((_, i) => i !== index),
                  undefined,
                  stage,
                )
              }
              aria-label={`Quitar la etapa ${stageLabel(stage)}`}
              className={cn(
                "flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-destructive",
                TOUCH_TARGET_COARSE,
                FOCUS_RING,
              )}
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * One origin's rules: where a deal sitting here may go next, and who may move it.
 *
 * Collapsed it names the legal destinations, so the rule set can be read
 * without opening seven cards.
 */
function OriginCard({
  originKey,
  destinations,
  outOfFlow,
  transitions,
  expanded,
  onToggle,
  onSet,
}: {
  originKey: string;
  /** Stages in order, then the terminal destinations the rules name. */
  destinations: string[];
  /** Which of those are not stages of the flow, so they can be marked as such. */
  outOfFlow: Set<string>;
  transitions: PipelineTransition[];
  expanded: boolean;
  onToggle: () => void;
  onSet: (to: string, mode: TransitionMode) => void;
}) {
  const isAny = originKey === ANY_STAGE;
  const targets = destinations.filter((stage) => isAny || stage !== originKey);
  const allowed = targets.filter((to) => modeFor(transitions, originKey, to) !== "none");
  const humanOnly = targets.filter((to) => modeFor(transitions, originKey, to) === "human");

  return (
    <li
      className={cn(
        "overflow-hidden rounded-[var(--radius)] border bg-card",
        isAny ? "border-accent-brand/40" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          "flex w-full items-center gap-2.5 p-3 text-left",
          TOUCH_TARGET_COARSE,
          FOCUS_RING,
        )}
      >
        {isAny && (
          <Globe className="size-4 shrink-0 text-accent-brand" strokeWidth={1.9} aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-foreground">
            {/* NULL from_stage rendered as an empty cell is how a wildcard rule
                becomes invisible. It has a name here. */}
            {isAny ? "Desde cualquier etapa" : `Desde ${stageLabel(originKey)}`}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
            {allowed.length === 0
              ? "Ningún movimiento declarado"
              : allowed.map(stageLabel).join(", ")}
            {humanOnly.length > 0 && (
              <span className="text-warning"> · {humanOnly.length} sólo persona</span>
            )}
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="size-4 shrink-0 text-faint" strokeWidth={2} />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-faint" strokeWidth={2} />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-1">
          {targets.length === 0 && (
            <p className="py-3 text-[13px] text-muted-foreground">
              Agrega otra etapa para declarar un movimiento.
            </p>
          )}
          {targets.map((to) => (
            <div
              key={to}
              className="flex flex-col gap-2 border-b border-border py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-3"
            >
              <span className="min-w-0 flex-1 text-[14px] text-foreground">
                → {stageLabel(to)}
                {outOfFlow.has(to) && (
                  <span className="ml-1.5 text-[12px] whitespace-nowrap text-faint">
                    fuera del flujo
                  </span>
                )}
              </span>
              <ChoiceSwitch
                label={`Mover a ${stageLabel(to)}`}
                size="sm"
                value={modeFor(transitions, originKey, to)}
                onChange={(mode) => onSet(to, mode as TransitionMode)}
                options={MODES}
                className="shrink-0"
              />
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

/**
 * Create/edit one pipeline and the rules declared over it.
 *
 * The rules are the point. Stored as rows in `pipeline_transitions` they are a
 * sparse table; here each origin owns a card and each destination a three-way
 * choice, so `requires_human` — the line Propo does not cross — is one of the
 * three things you pick rather than a checkbox in a column.
 */
export function PipelineSheet({
  open,
  pipeline,
  onOpenChange,
  onSave,
  onDelete,
  saving,
}: {
  open: boolean;
  /** null = create. */
  pipeline: Pipeline | null;
  onOpenChange: (open: boolean) => void;
  onSave: (values: PipelineWrite) => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [stages, setStages] = useState<string[]>([]);
  const [transitions, setTransitions] = useState<PipelineTransition[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  //: Terminal destinations the user added by hand this session. Rules already
  //  naming one keep it without help; a brand-new pipeline needs a way in.
  const [extraDestinations, setExtraDestinations] = useState<string[]>([]);
  const [newDestination, setNewDestination] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(pipeline?.name ?? "");
    setIsDefault(pipeline?.is_default ?? false);
    setStages(pipeline ? [...pipeline.stages] : ["LEAD", "VISIT", "CLOSED"]);
    setTransitions(pipeline ? pipeline.transitions.map((t) => ({ ...t })) : []);
    setExtraDestinations([]);
    setNewDestination("");
    setExpanded(null);
  }, [open, pipeline]);

  const issue = useMemo(() => pipelineIssue(name, stages), [name, stages]);
  const summary = summarize(transitions);
  const unconstrained = isUnconstrained(transitions);
  // Includes LOST and anything else the rules already point at, so an existing
  // rule set survives a save instead of being silently pruned to the stages.
  const destinations = useMemo(
    () => destinationsFor(stages, transitions, extraDestinations),
    [stages, transitions, extraDestinations],
  );
  const outOfFlow = useMemo(
    () => new Set(terminalDestinations(stages, destinations)),
    [stages, destinations],
  );

  const changeStages = (
    next: string[],
    renamed?: { from: string; to: string },
    dropped?: string,
  ) => {
    setStages(next);
    // Rules name stages by string, so a rename that does not carry them leaves
    // rows pointing at a stage that no longer exists — legal-looking rows that
    // never fire and never complain.
    if (renamed && renamed.from !== renamed.to) {
      setTransitions((rules) => renameStage(rules, renamed.from, renamed.to));
    }
    if (dropped) setTransitions((rules) => dropStage(rules, dropped));
  };

  const submit = () => {
    if (issue) return;
    onSave({
      name: name.trim(),
      stages: stages.map((s) => s.trim()),
      is_default: isDefault,
      transitions,
    });
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={pipeline ? "Editar pipeline" : "Nuevo pipeline"}
      desktopClassName="max-w-2xl max-h-[88vh] overflow-y-auto"
    >
      <div className="mt-2 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ventas" />
          </Field>
          <FieldGroup
            label="Para negocios nuevos"
            hint={isDefault ? "Los negocios sin pipeline entran aquí." : "Sólo si se elige a mano."}
          >
            <ChoiceSwitch
              label="Uso por defecto"
              value={isDefault ? "default" : "manual"}
              onChange={(v) => setIsDefault(v === "default")}
              options={[
                { value: "default", label: "Por defecto" },
                { value: "manual", label: "A pedido" },
              ]}
            />
          </FieldGroup>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <SectionLabel>
              Etapas
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                {stages.length} en total
              </span>
            </SectionLabel>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setStages((list) => [...list, ""])}
            >
              <Plus className="size-3.5" strokeWidth={2} />
              Etapa
            </Button>
          </div>
          <StageEditor stages={stages} onChange={changeStages} />
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <SectionLabel>
              Movimientos permitidos
              <span className="ml-2 text-[12px] font-normal text-muted-foreground">
                {summary.declared} declarados
                {summary.human > 0 && (
                  <>
                    {" · "}
                    <span className="text-warning">{summary.human} sólo persona</span>
                  </>
                )}
              </span>
            </SectionLabel>
          </div>

          {/* The notice sits ABOVE the rules rather than replacing them: the
              state it describes is one the user is editing their way into or
              out of, and hiding the controls at that exact moment is the worst
              possible time to hide them. */}
          {unconstrained && <UnconstrainedNotice />}

          <ul className={cn("space-y-1.5", unconstrained && "mt-3")}>
            {[ANY_STAGE, ...stages.filter(Boolean)].map((originKey) => (
              <OriginCard
                key={originKey}
                originKey={originKey}
                destinations={destinations}
                outOfFlow={outOfFlow}
                transitions={transitions}
                expanded={expanded === originKey}
                onToggle={() => setExpanded((c) => (c === originKey ? null : originKey))}
                onSet={(to, mode) => setTransitions((rules) => setMode(rules, originKey, to, mode))}
              />
            ))}
          </ul>

          {/* Under the rules, not above them: adding a terminal destination is
              a once-per-pipeline act, and LOST is the only one that ships. It
              has to exist — without it a new pipeline could never declare the
              rule that lets anybody abandon a deal — but not at the top. */}
          <div className="mt-2 flex items-center gap-2">
            <span className="shrink-0 text-[12px] text-faint">Destino fuera del flujo</span>
            <Input
              value={newDestination}
              onChange={(e) => setNewDestination(e.target.value)}
              aria-label="Destino fuera del flujo"
              placeholder="LOST"
              className="h-10 max-w-[12rem] font-mono text-[13px]"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 shrink-0"
              disabled={!newDestination.trim() || destinations.includes(newDestination.trim())}
              onClick={() => {
                setExtraDestinations((list) => [...list, newDestination.trim()]);
                setNewDestination("");
              }}
            >
              <Plus className="size-3.5" strokeWidth={2} />
              Destino
            </Button>
          </div>
        </div>

        {pipeline && pipeline.deal_count > 0 && (
          <p className="text-[13px] text-muted-foreground">
            {pipeline.deal_count} negocios usan este pipeline hoy.
          </p>
        )}

        {issue && <p className="text-[13px] text-destructive">{issue}</p>}
      </div>

      <SheetActions>
        {pipeline && onDelete && (
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            className="text-destructive hover:text-destructive sm:mr-auto"
          >
            <Trash2 className="size-4" strokeWidth={1.8} />
            Eliminar
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="button" onClick={submit} disabled={!!issue || saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </SheetActions>
    </ResponsiveSheet>
  );
}
