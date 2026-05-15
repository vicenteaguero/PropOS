import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, RefreshCw, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";
import { toast } from "sonner";
import {
  expireInvitation,
  listInvitations,
  resendInvitation,
  type InvitationResponse,
} from "../api/visitor-invitations";
import { NewInvitationDialog } from "../components/new-invitation-dialog";

const STATUS_LABEL: Record<InvitationResponse["status"], string> = {
  pending: "Pendiente",
  opened: "Abierto",
  completed: "Completado",
  expired: "Expirado",
};

const STATUS_TONE: Record<InvitationResponse["status"], string> = {
  pending: "bg-amber-500/15 text-amber-300",
  opened: "bg-blue-500/15 text-blue-300",
  completed: "bg-emerald-500/15 text-emerald-300",
  expired: "bg-zinc-500/15 text-zinc-300",
};

export function AdminVisitorInvitationsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["visitor-invitations"],
    queryFn: () => listInvitations(),
  });

  const resend = useMutation({
    mutationFn: (id: string) => resendInvitation(id),
    onSuccess: () => {
      toast.success("Invitación reenviada");
      qc.invalidateQueries({ queryKey: ["visitor-invitations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const expire = useMutation({
    mutationFn: (id: string) => expireInvitation(id),
    onSuccess: () => {
      toast.success("Invitación expirada");
      qc.invalidateQueries({ queryKey: ["visitor-invitations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function copyLink(url: string) {
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Link copiado"))
      .catch(() => toast.error("No se pudo copiar"));
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Visitantes</h1>
        <Button size="sm" onClick={() => setOpen(true)}>
          <UserPlus className="mr-1.5 size-4" /> Invitar visitante
        </Button>
      </header>

      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="md" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-destructive">
            Error: {(error as Error).message}
            <div className="mt-2">
              <Button variant="link" size="sm" onClick={() => refetch()}>
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && data && data.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Aún no hay invitaciones. Crea la primera con el botón "Invitar visitante".
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && data && data.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Modo</th>
                  <th className="px-4 py-2 text-left">Estado</th>
                  <th className="px-4 py-2 text-left">Vence</th>
                  <th className="px-4 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((inv) => {
                  const closed = inv.status === "completed" || inv.status === "expired";
                  return (
                    <tr key={inv.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">
                        <div className="font-medium">{inv.email}</div>
                        <div className="text-xs text-muted-foreground">
                          slug: {inv.slug}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="text-xs">
                          {inv.mode === "auth_user" ? "Con cuenta" : "Solo registrar"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${STATUS_TONE[inv.status]}`}
                        >
                          {STATUS_LABEL[inv.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {new Date(inv.expires_at).toLocaleDateString("es-CL")}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyLink(inv.invite_url)}
                            title="Copiar link"
                          >
                            <Copy className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={closed || resend.isPending}
                            onClick={() => resend.mutate(inv.id)}
                            title="Reenviar email"
                          >
                            {resend.isPending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <RefreshCw className="size-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={closed || expire.isPending}
                            onClick={() => expire.mutate(inv.id)}
                            title="Expirar"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <NewInvitationDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
