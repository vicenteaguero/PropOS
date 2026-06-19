import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@shared/hooks/use-auth";
import { useConversations } from "@features/client-chat/hooks/use-client-chat";
import { useEmailThreads } from "@features/email/hooks/use-email";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import { Row, Segmented, Pill, BrandMark, type PillTone } from "@shared/ui";
import { Button } from "@/components/ui/button";

type Channel = "whatsapp" | "email";

interface InboxItem {
  key: string;
  channel: Channel;
  title: string;
  sub: string;
  time: number;
  status: string;
}

const STATUS_TONE: Record<string, PillTone> = {
  open: "success",
  assigned: "accent",
  closed: "neutral",
};

function fmt(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

/**
 * CRM "Bandeja" — a unified entry point that merges recent WhatsApp + Email
 * activity into one list and routes into the existing (separate) inboxes.
 * Channels are NOT merged into one thread (by design).
 */
export function BandejaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const base = `/${(user?.role ?? "ADMIN").toLowerCase()}`;
  const [filter, setFilter] = useState<"todos" | Channel>("todos");

  const convos = useConversations();
  const emails = useEmailThreads({});

  const items = useMemo<InboxItem[]>(() => {
    const wa: InboxItem[] = (convos.data ?? []).map((c) => ({
      key: `wa-${c.id}`,
      channel: "whatsapp",
      title: c.external_phone_e164 ?? "Conversación de WhatsApp",
      sub: "WhatsApp · Kapso",
      time: c.last_message_at ? Date.parse(c.last_message_at) : 0,
      status: c.status,
    }));
    const em: InboxItem[] = (emails.data ?? []).map((t) => ({
      key: `em-${t.id}`,
      channel: "email",
      title: t.counterpart_name || t.subject || t.counterpart_email || "Correo",
      sub: t.subject || "Correo · Titan",
      time: t.last_message_at ? Date.parse(t.last_message_at) : 0,
      status: t.status,
    }));
    return [...wa, ...em].sort((a, b) => b.time - a.time);
  }, [convos.data, emails.data]);

  const shown = filter === "todos" ? items : items.filter((i) => i.channel === filter);

  const isLoading = convos.isLoading || emails.isLoading;
  const error = convos.error || emails.error;

  return (
    <PageLayout width="md">
      <PageHeader title="Bandeja" description="WhatsApp y correos recientes en un solo lugar." />

      <div className="mb-4">
        <Segmented
          items={[
            { id: "todos", label: "Todos" },
            { id: "whatsapp", label: "WhatsApp" },
            { id: "email", label: "Correos" },
          ]}
          value={filter}
          onChange={(id) => setFilter(id as "todos" | Channel)}
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          No se pudo cargar la bandeja.
          <Button
            variant="ghost"
            size="sm"
            className="ml-2"
            onClick={() => {
              void convos.refetch();
              void emails.refetch();
            }}
          >
            Reintentar
          </Button>
        </div>
      )}

      {!isLoading && !error && shown.length === 0 && (
        <EmptyState title="Bandeja vacía" description="No hay conversaciones recientes." />
      )}

      {!isLoading && !error && shown.length > 0 && (
        <div>
          {shown.map((it, i) => (
            <Row
              key={it.key}
              divider={i < shown.length - 1}
              onClick={() => navigate(it.channel === "whatsapp" ? `${base}/client-inbox` : `${base}/correos`)}
              left={<BrandMark brand={it.channel === "whatsapp" ? "whatsapp" : "email"} size={40} />}
              title={it.title}
              sub={it.sub}
              right={
                <div className="flex flex-col items-end gap-1.5">
                  <Pill tone={STATUS_TONE[it.status] ?? "neutral"}>{it.status}</Pill>
                  <span className="text-xs text-faint">{fmt(it.time)}</span>
                </div>
              }
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
