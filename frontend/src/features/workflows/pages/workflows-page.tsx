import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Circle, Loader2, Plus } from "lucide-react";
import { workflowsApi, type Workflow, type WorkflowStep } from "../api/workflows-api";

export function WorkflowsPage() {
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
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  return (
    <div className="container max-w-3xl py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Workflows / Checklists</h1>
        <p className="text-sm text-muted-foreground">
          Procesos reutilizables (closing de venta, onboarding propietario, etc).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuevo workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="Nombre (ej: Closing venta casa)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <textarea
            className="w-full text-sm p-2 rounded-md bg-background border border-input min-h-24"
            placeholder="Pasos, uno por línea..."
            value={newSteps}
            onChange={(e) => setNewSteps(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() => create.mutate()}
            disabled={!newName.trim() || create.isPending}
            className="gap-1"
          >
            {create.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Plus className="size-3" />
            )}
            Crear
          </Button>
        </CardContent>
      </Card>

      {list.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {list.data?.map((w) => (
            <WorkflowCard key={w.id} workflow={w} />
          ))}
          {list.data?.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground text-sm">
              Sin workflows. Crea uno arriba.
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const queryClient = useQueryClient();
  const steps = useQuery({
    queryKey: ["workflows", workflow.id, "steps"],
    queryFn: () => workflowsApi.listSteps(workflow.id),
  });
  const updateStep = useMutation({
    mutationFn: ({ stepId, status }: { stepId: string; status: string }) =>
      workflowsApi.updateStep(workflow.id, stepId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows", workflow.id, "steps"] });
    },
  });

  const toggle = (s: WorkflowStep) => {
    const next = s.status === "COMPLETED" ? "NOT_STARTED" : "COMPLETED";
    updateStep.mutate({ stepId: s.id, status: next });
  };

  const all = steps.data ?? [];
  const done = all.filter((s) => s.status === "COMPLETED").length;
  const total = all.length;

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{workflow.name}</CardTitle>
          <Badge variant={workflow.state === "COMPLETED" ? "default" : "secondary"}>
            {total > 0 ? `${done}/${total}` : workflow.state}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {steps.isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        {all.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2 py-1 text-sm cursor-pointer hover:bg-muted/50 rounded px-1"
            onClick={() => toggle(s)}
          >
            {s.status === "COMPLETED" ? (
              <Check className="size-4 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="size-4 text-muted-foreground shrink-0" />
            )}
            <span className={s.status === "COMPLETED" ? "line-through text-muted-foreground" : ""}>
              {s.name}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
