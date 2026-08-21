import { Eye, Inbox, Loader2, RotateCcw, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ErrorState, FOCUS_RING, PageSkeleton, Pill, TOUCH_TARGET_ROW_COARSE } from "@shared/ui";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { usePageTitle } from "@app/page-meta";
import { agentActionLabel } from "@shared/lib/labels";
import { useAgentName } from "@core/branding/agent-branding";
import {
  AUTONOMY_LEVELS,
  AUTONOMY_LEVEL_EFFECT,
  AUTONOMY_LEVEL_SHORT,
  isLoosened,
  levelLabel,
  sortPoliciesForDisplay,
  type ActionPolicy,
  type AutonomyLevel,
} from "../lib/autonomy";
import { useAgentPolicies, useSetAgentPolicy } from "../hooks/use-agent-policies";

const LEVEL_ICON: Record<AutonomyLevel, LucideIcon> = {
  observe: Eye,
  suggest: Inbox,
  execute: Zap,
};

/**
 * The legend, and the only place the three levels are defined.
 *
 * It is not decoration: an admin who moves "Crear persona" to Ejecuta is
 * agreeing that people will appear in the CRM without anyone reading them
 * first, and the switch alone does not say that anywhere.
 */
function LevelLegend({ agentName }: { agentName: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {AUTONOMY_LEVELS.map((level) => {
        const Icon = LEVEL_ICON[level];
        return (
          <div
            key={level}
            className="rounded-[var(--radius)] border border-border bg-card p-3.5 sm:p-4"
          >
            <div className="flex items-center gap-2">
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  level === "execute" ? "text-warning" : "text-muted-foreground",
                )}
                strokeWidth={1.8}
              />
              <span className="text-[15px] font-semibold leading-none text-foreground">
                {levelLabel(level)}
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
              {AUTONOMY_LEVEL_EFFECT[level].replace("Propo", agentName)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The three-way switch, one per action.
 *
 * Not `Segmented`/`TabBar`, which is the app's tab strip: it is a `tablist`
 * that scrolls its selected item into view on mount, and twelve of them on one
 * page each scrolled the document — the page opened halfway down its own list.
 * A setting is a radio group, not a tab, so it says so to assistive tech too.
 */
function LevelSwitch({
  value,
  onChange,
  actionLabel,
}: {
  value: AutonomyLevel;
  onChange: (level: AutonomyLevel) => void;
  actionLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={`Nivel de autonomía para ${actionLabel}`}
      className="flex gap-1 rounded-full bg-secondary p-1"
    >
      {AUTONOMY_LEVELS.map((level) => {
        const active = level === value;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(level)}
            className={cn(
              "h-10 rounded-full px-4 text-[14px] font-semibold whitespace-nowrap transition-colors",
              TOUCH_TARGET_ROW_COARSE,
              FOCUS_RING,
              active ? "bg-ink text-ink-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {levelLabel(level)}
          </button>
        );
      })}
    </div>
  );
}

function PolicyRow({
  policy,
  onChange,
  onReset,
  busy,
}: {
  policy: ActionPolicy;
  onChange: (level: AutonomyLevel) => void;
  onReset: () => void;
  busy: boolean;
}) {
  const loosened = isLoosened(policy);

  return (
    <div
      className={cn(
        // Stacks on a phone — a three-segment switch beside a label leaves each
        // segment too narrow to hit — and sits on one line from `sm` up.
        "flex flex-col gap-2.5 border-b border-border py-3.5 last:border-b-0",
        "sm:flex-row sm:items-center sm:gap-4",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] font-semibold leading-tight text-foreground">
            {agentActionLabel(policy.action_kind)}
          </span>
          {loosened && <Pill tone="warning">Sin revisión</Pill>}
        </div>
        <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
          {AUTONOMY_LEVEL_SHORT[policy.level]}
          {!policy.is_default && (
            <>
              {" · "}
              <span className="text-faint">
                Por defecto: {levelLabel(policy.default_level).toLowerCase()}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <LevelSwitch
          value={policy.level}
          onChange={onChange}
          actionLabel={agentActionLabel(policy.action_kind)}
        />
        {/* Occupies its slot at all times so the switches stay on one vertical
            line instead of shifting left on every row that is at its default. */}
        <button
          type="button"
          onClick={onReset}
          disabled={policy.is_default || busy}
          aria-label={`Restaurar ${agentActionLabel(policy.action_kind)} al valor por defecto`}
          title="Restaurar"
          className={cn(
            "flex size-11 items-center justify-center rounded-full text-muted-foreground transition",
            TOUCH_TARGET_ROW_COARSE,
            FOCUS_RING,
            policy.is_default
              ? "pointer-events-none opacity-0"
              : "hover:bg-secondary hover:text-foreground",
          )}
        >
          <RotateCcw className="size-4" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}

/**
 * Configuración → Propo: what the assistant may do without asking.
 *
 * Its own page rather than a card on Configuración because there are twelve
 * actions and each one is a decision about who reviews the AI's writes — the
 * kind of thing that deserves the room to be read, not a scroll-past section
 * between the paper size and the brand colour.
 */
export function AgentPoliciesPage() {
  const agentName = useAgentName();
  usePageTitle(agentName);
  const { data, isPending, isError, error, refetch } = useAgentPolicies();
  const setPolicy = useSetAgentPolicy();

  const policies = data ? sortPoliciesForDisplay(data) : [];
  const overridden = policies.filter((p) => !p.is_default);

  const restoreAll = () => {
    for (const p of overridden) {
      setPolicy.mutate({ actionKind: p.action_kind, level: null });
    }
  };

  const restoreAllButton = overridden.length > 0 && (
    <Button variant="outline" size="sm" onClick={restoreAll} disabled={setPolicy.isPending}>
      {setPolicy.isPending ? (
        <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
      ) : (
        <RotateCcw className="size-4" strokeWidth={1.8} />
      )}
      Restaurar todo
    </Button>
  );

  return (
    <PageLayout width="md" noPadding className="pb-16 lg:px-8 lg:pt-7">
      <div className="px-[var(--page-x)] pt-5 lg:px-0">
        <PageHeader
          title={agentName}
          backTo="/admin/settings"
          actions={restoreAllButton || undefined}
          className="mb-4"
        />

        {isPending && <PageSkeleton variant="list" count={6} />}

        {isError && (
          <ErrorState
            message="No se pudieron cargar los permisos."
            error={error}
            onRetry={() => refetch()}
          />
        )}

        {!isPending && !isError && (
          <>
            <LevelLegend agentName={agentName} />

            <div className="mt-6 flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Acciones</h2>
              <span className="font-mono text-[12px] tabular-nums text-faint">
                {overridden.length}/{policies.length} personalizadas
              </span>
            </div>

            <div className="mt-1">
              {policies.map((policy) => (
                <PolicyRow
                  key={policy.action_kind}
                  policy={policy}
                  busy={setPolicy.isPending}
                  onChange={(level) => setPolicy.mutate({ actionKind: policy.action_kind, level })}
                  onReset={() => setPolicy.mutate({ actionKind: policy.action_kind, level: null })}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}

export default AgentPoliciesPage;
