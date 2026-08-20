import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, RefreshCw, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@shared/components/page-layout";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { ErrorState, PageSkeleton, Pill, Row, type PillTone } from "@shared/ui";
import { useIsDesktop } from "@/hooks/use-mobile";
import { toast } from "sonner";
import {
  expireInvitation,
  listInvitations,
  resendInvitation,
  type InvitationResponse,
} from "../api/visitor-invitations";
import { NewInvitationDialog } from "../components/new-invitation-dialog";
import { formatDate } from "@shared/utils/format";

const STATUS_LABEL: Record<InvitationResponse["status"], string> = {
  pending: "Pendiente",
  opened: "Abierto",
  completed: "Completado",
  expired: "Expirado",
};

const STATUS_TONE: Record<InvitationResponse["status"], PillTone> = {
  pending: "warning",
  opened: "accent",
  completed: "success",
  expired: "neutral",
};

function modeLabel(mode: InvitationResponse["mode"]): string {
  return mode === "auth_user" ? "Con cuenta" : "Solo registrar";
}

function expiresLabel(iso: string): string {
  return formatDate(iso);
}

export function AdminVisitorInvitationsPage() {
  const qc = useQueryClient();
  const isDesktop = useIsDesktop();
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

  function isClosed(inv: InvitationResponse) {
    return inv.status === "completed" || inv.status === "expired";
  }

  // Per-row action buttons — shared between the mobile rows and desktop table.
  function actions(inv: InvitationResponse) {
    const closed = isClosed(inv);
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => copyLink(inv.invite_url)}
          title="Copiar link"
        >
          <Copy className="size-4" strokeWidth={1.8} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={closed || resend.isPending}
          onClick={() => resend.mutate(inv.id)}
          title="Reenviar email"
        >
          {resend.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" strokeWidth={1.8} />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={closed || expire.isPending}
          onClick={() => expire.mutate(inv.id)}
          title="Expirar"
        >
          <X className="size-4" strokeWidth={1.8} />
        </Button>
      </div>
    );
  }

  return (
    <PageLayout width="md" noPadding className="pb-6 lg:max-w-none">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 lg:px-8 lg:pt-7">
        <div>
          <h1 className="text-[17px] font-semibold leading-tight tracking-tight text-foreground">
            Visitantes
          </h1>
        </div>
        <Button
          variant="ink"
          size="icon-lg"
          className="rounded-full lg:hidden"
          aria-label="Invitar visitante"
          onClick={() => setOpen(true)}
        >
          <UserPlus className="size-5" strokeWidth={1.8} />
        </Button>
        <Button variant="ink" className="hidden gap-2 lg:inline-flex" onClick={() => setOpen(true)}>
          <UserPlus className="size-4" strokeWidth={1.8} /> Invitar visitante
        </Button>
      </div>

      {isLoading && <PageSkeleton variant="table" />}

      {error && (
        <ErrorState message="No pudimos cargar las invitaciones." onRetry={() => refetch()} />
      )}

      {!isLoading && !error && data && data.length === 0 && (
        <div className="px-5 lg:px-8">
          <EmptyState
            title="Sin invitaciones"
            description="Crea la primera invitación con el botón Invitar visitante."
            actionLabel="Invitar visitante"
            onAction={() => setOpen(true)}
          />
        </div>
      )}

      {/* Mobile: stacked rows (no horizontal table overflow). */}
      {!isLoading && !error && data && data.length > 0 && !isDesktop && (
        <div className="lg:hidden">
          {data.map((inv, i) => (
            <Row
              key={inv.id}
              divider={i < data.length - 1}
              title={
                <span className="flex items-center gap-2">
                  <span className="truncate">{inv.email}</span>
                  <Pill tone={STATUS_TONE[inv.status]}>{STATUS_LABEL[inv.status]}</Pill>
                </span>
              }
              sub={`${modeLabel(inv.mode)} · vence ${expiresLabel(inv.expires_at)}`}
              right={actions(inv)}
            />
          ))}
        </div>
      )}

      {/* Desktop: dense table using the full width. */}
      {!isLoading && !error && data && data.length > 0 && isDesktop && (
        <div className="px-8">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[12px] font-medium text-muted-foreground">
                  <th className="py-2.5 pl-4 pr-3 font-medium">Email</th>
                  <th className="px-3 py-2.5 font-medium">Modo</th>
                  <th className="px-3 py-2.5 font-medium">Estado</th>
                  <th className="px-3 py-2.5 font-medium">Vence</th>
                  <th className="py-2.5 pl-3 pr-4 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((inv, i) => (
                  <tr
                    key={inv.id}
                    className={`align-middle transition hover:bg-secondary/40 ${
                      i < data.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="font-medium text-foreground">{inv.email}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        slug: {inv.slug}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Pill tone="neutral">{modeLabel(inv.mode)}</Pill>
                    </td>
                    <td className="px-3 py-2.5">
                      <Pill tone={STATUS_TONE[inv.status]}>{STATUS_LABEL[inv.status]}</Pill>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                      {expiresLabel(inv.expires_at)}
                    </td>
                    <td className="py-2.5 pl-3 pr-4">
                      <div className="flex justify-end">{actions(inv)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NewInvitationDialog open={open} onOpenChange={setOpen} />
    </PageLayout>
  );
}
