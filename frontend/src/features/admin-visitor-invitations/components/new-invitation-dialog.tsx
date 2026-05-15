import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { entitiesApi } from "@features/documents/api/entities-api";
import {
  createInvitation,
  preflightInvitation,
  type PreflightResponse,
} from "../api/visitor-invitations";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPropertyId?: string;
}

export function NewInvitationDialog({ open, onOpenChange, defaultPropertyId }: Props) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? "");
  const [mode, setMode] = useState<"visitor_only" | "auth_user">("visitor_only");
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [confirmDup, setConfirmDup] = useState(false);

  const propertiesQuery = useQuery({
    queryKey: ["properties-lite"],
    queryFn: () => entitiesApi.listProperties(),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: createInvitation,
    onSuccess: () => {
      toast.success("Invitación enviada");
      qc.invalidateQueries({ queryKey: ["visitor-invitations"] });
      reset();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });

  function reset() {
    setEmail("");
    setPropertyId(defaultPropertyId ?? "");
    setMode("visitor_only");
    setPreflight(null);
    setConfirmDup(false);
  }

  // Run preflight on email change (debounced rough)
  useEffect(() => {
    if (!open) return;
    if (!email.includes("@")) {
      setPreflight(null);
      return;
    }
    const t = setTimeout(() => {
      preflightInvitation(email).then(setPreflight).catch(() => setPreflight(null));
    }, 400);
    return () => clearTimeout(t);
  }, [email, open]);

  const hasWarnings = (preflight?.warnings.length ?? 0) > 0;
  const canSubmit =
    email.includes("@") && propertyId && (!hasWarnings || confirmDup) && !create.isPending;

  function handleSubmit() {
    create.mutate({
      email: email.trim().toLowerCase(),
      property_id: propertyId,
      mode,
      confirm_duplicate: confirmDup,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar visitante</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vi_email">Email del visitante</Label>
            <Input
              id="vi_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="visitante@example.com"
            />
          </div>

          {hasWarnings && (
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="size-4 shrink-0 text-amber-500" />
              <div className="space-y-1">
                {preflight!.warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
                <label className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={confirmDup}
                    onChange={(e) => setConfirmDup(e.target.checked)}
                  />
                  <span className="text-xs">Enviar de todos modos</span>
                </label>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="vi_property">Propiedad</Label>
            <select
              id="vi_property"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">
                {propertiesQuery.isLoading ? "Cargando…" : "Selecciona propiedad"}
              </option>
              {(propertiesQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Modo</Label>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                  mode === "visitor_only"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted"
                }`}
                onClick={() => setMode("visitor_only")}
              >
                <span className="block font-medium">Solo registrar</span>
                <span className="block text-xs text-muted-foreground">
                  Sin cuenta. Solo guarda los datos del visitante.
                </span>
              </button>
              <button
                type="button"
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                  mode === "auth_user"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted"
                }`}
                onClick={() => setMode("auth_user")}
              >
                <span className="block font-medium">Con cuenta</span>
                <span className="block text-xs text-muted-foreground">
                  Crea usuario con password + confirmación email.
                </span>
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            {create.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {hasWarnings && confirmDup ? "Enviar igual" : "Enviar invitación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
