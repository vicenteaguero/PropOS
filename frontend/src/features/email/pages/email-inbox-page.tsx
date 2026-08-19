import { useState } from "react";
import { PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import {
  BrandMark,
  ErrorState,
  MasterDetail,
  PageSkeleton,
  Pill,
  type PillTone,
  Row,
} from "@shared/ui";
import { useEmailThreads } from "../hooks/use-email";
import { EmailComposeSheet } from "../components/email-compose-sheet";
import { EmailThreadView } from "../components/email-thread-view";
import { formatShortDateTime } from "@shared/utils/format";

function statusTone(status: string): PillTone {
  return status.toUpperCase() === "OPEN" ? "success" : "neutral";
}

function statusLabel(status: string): string {
  return status.toUpperCase() === "OPEN" ? "Abierta" : "Cerrada";
}

export function EmailInboxPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const { data: threads, isLoading, error, refetch } = useEmailThreads({ status: "OPEN" });

  // Left column: header + thread list, with its own loading / error / empty states.
  const list = (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center gap-2 px-5 pt-4 pb-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
          <BrandMark brand="titan" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
            Correos
          </h1>
          <p className="text-[13px] text-muted-foreground">Leads de portales y conversaciones.</p>
        </div>
        <Button size="sm" className="shrink-0 gap-1.5" onClick={() => setComposeOpen(true)}>
          <PenSquare className="size-4" strokeWidth={1.8} /> Nuevo
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && <PageSkeleton variant="list" count={6} />}
        {error && (
          <ErrorState
            message="No se pudieron cargar los correos."
            onRetry={() => refetch()}
            className="m-5"
          />
        )}
        {!isLoading && !error && (threads?.length ?? 0) === 0 && (
          <div className="px-5 py-6">
            <EmptyState
              title="Sin correos"
              description="Cuando se sincronice el buzón, los leads de portales aparecerán aquí. También puedes escribir tú primero."
              actionLabel="Nuevo correo"
              onAction={() => setComposeOpen(true)}
            />
          </div>
        )}
        {!isLoading && !error && threads && threads.length > 0 && (
          <div>
            {threads.map((t, i) => (
              <Row
                key={t.id}
                divider={i < threads.length - 1}
                onClick={() => setSelected(t.id)}
                className={selected === t.id ? "bg-secondary/60" : undefined}
                left={
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <BrandMark brand="titan" size={26} />
                  </span>
                }
                title={t.counterpart_name || t.counterpart_email || "(sin remitente)"}
                sub={
                  <>
                    <span className="block truncate">{t.subject || "(sin asunto)"}</span>
                    <span className="block text-faint">
                      {formatShortDateTime(t.last_message_at)}
                    </span>
                  </>
                }
                right={
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <Pill tone={statusTone(t.status)}>{statusLabel(t.status)}</Pill>
                    {t.is_lead && t.portal && <Pill tone="accent">{t.portal}</Pill>}
                  </span>
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <MasterDetail
        selected={!!selected}
        list={list}
        listWidth="24rem"
        detail={
          selected ? (
            <EmailThreadView threadId={selected} onBack={() => setSelected(null)} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              Selecciona una conversación.
            </div>
          )
        }
      />
      <EmailComposeSheet
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onSent={(threadId) => setSelected(threadId)}
      />
    </>
  );
}
