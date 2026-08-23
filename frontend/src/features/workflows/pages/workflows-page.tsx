import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import {
  ActionIcon,
  ErrorState,
  PageSkeleton,
  Pill,
  ResponsiveSheet,
  SheetActions,
} from "@shared/ui";
import { cn } from "@/lib/utils";
import { workflowsApi, type Workflow, type WorkflowStep } from "../api/workflows-api";

export function WorkflowsPage() {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSteps, setNewSteps] = useState("");
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ["workflows"],
    queryFn: () => workflowsApi.list(),
  });

  const create = useMutation({
    mutationFn: () =>
      workflowsApi.create({
        name: newName.trim(),
        steps: newSteps
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      setNewName("");
      setNewSteps("");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  return (
    // Mobile: capped centered column (unchanged). Desktop: full-bleed grid.
    <PageLayout width="md" noPadding className="pb-6 lg:max-w-none">
      <div className="px-[var(--page-x)] pt-4 pb-5 lg:px-8 lg:pt-7">
        <PageHeader
          title="Workflows / Checklists"
          className="mb-0"
          actions={
            <Button onClick={() => setOpen(true)} variant="ink" className="gap-2">
              <ActionIcon name="createWorkflow" />
              Nuevo
            </Button>
          }
        />
      </div>

      {list.isLoading && <PageSkeleton variant="list" />}

      {list.isError && (
        <ErrorState message="No se pudieron cargar los workflows." onRetry={() => list.refetch()} />
      )}

      {!list.isLoading && !list.isError && (list.data?.length ?? 0) === 0 && (
        <EmptyState
          title="Sin workflows"
          actionLabel="Nuevo workflow"
          onAction={() => setOpen(true)}
        />
      )}

      {/* Mobile: single stacked column. Desktop: masonry-ish multi-column grid
          so reusable processes read as a dense board, not a narrow list. */}
      {!list.isLoading && !list.isError && (list.data?.length ?? 0) > 0 && (
        <div className="space-y-3 px-[var(--page-x)] pb-6 lg:columns-2 lg:gap-4 lg:space-y-0 lg:px-8 2xl:columns-3 lg:[&>*]:mb-4 lg:[&>*]:break-inside-avoid">
          {list.data?.map((w) => (
            <WorkflowCard key={w.id} workflow={w} />
          ))}
        </div>
      )}

      <ResponsiveSheet open={open} onOpenChange={setOpen} title="Nuevo workflow">
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wf-name">Nombre</Label>
            <Input
              id="wf-name"
              placeholder="Ej: Closing venta casa"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wf-steps">Pasos</Label>
            <Textarea
              id="wf-steps"
              placeholder="Un paso por línea..."
              value={newSteps}
              onChange={(e) => setNewSteps(e.target.value)}
            />
          </div>
          <SheetActions>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={create.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={!newName.trim() || create.isPending}
              variant="ink"
            >
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              Crear
            </Button>
          </SheetActions>
        </div>
      </ResponsiveSheet>
    </PageLayout>
  );
}

function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const queryClient = useQueryClient();
  const steps = useQuery({
    queryKey: ["workflows", workflow.id, "steps"],
    queryFn: () => workflowsApi.listSteps(workflow.id),
  });
  const stepsKey = ["workflows", workflow.id, "steps"] as const;
  const updateStep = useMutation({
    mutationFn: ({ stepId, status }: { stepId: string; status: string }) =>
      workflowsApi.updateStep(workflow.id, stepId, { status }),
    onMutate: async ({ stepId, status }) => {
      await queryClient.cancelQueries({ queryKey: stepsKey });
      const previous = queryClient.getQueryData<WorkflowStep[]>(stepsKey);
      if (previous) {
        queryClient.setQueryData<WorkflowStep[]>(
          stepsKey,
          previous.map((s) =>
            s.id === stepId ? { ...s, status: status as WorkflowStep["status"] } : s,
          ),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(stepsKey, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: stepsKey });
    },
  });

  const toggle = (s: WorkflowStep) => {
    const next = s.status === "COMPLETED" ? "NOT_STARTED" : "COMPLETED";
    updateStep.mutate({ stepId: s.id, status: next });
  };

  const all = steps.data ?? [];
  const done = all.filter((s) => s.status === "COMPLETED").length;
  const total = all.length;
  const complete = workflow.state === "COMPLETED";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h3 className="truncate text-base font-semibold text-foreground">{workflow.name}</h3>
        <Pill tone={complete ? "success" : "neutral"}>
          {total > 0 ? `${done}/${total}` : workflow.state}
        </Pill>
      </div>

      {steps.isLoading && (
        <div className="px-4 pb-3">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {all.length > 0 && (
        <div className="border-t border-border">
          {all.map((s) => {
            const isDone = s.status === "COMPLETED";
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s)}
                aria-pressed={isDone}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-secondary/50 active:scale-[0.99]"
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    isDone
                      ? "border-success bg-success text-background"
                      : "border-line-strong text-transparent",
                  )}
                >
                  <Check className="size-3.5" strokeWidth={2.5} />
                </span>
                <span
                  className={cn(
                    "text-sm",
                    isDone ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {s.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
