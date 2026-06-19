import { Link } from "react-router-dom";
import { BrandMark, Pill, SectionLabel } from "@shared/ui";
import { useAuth } from "@shared/hooks/use-auth";
import type { ClientConversation } from "../types";

function fmt(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * 2xl context rail for the WhatsApp inbox. Summarises the selected conversation
 * — contact, channel, AI state, and the 24h consent window — from data already
 * loaded with the conversation (no extra fetch).
 */
export function ConversationAside({ conversation }: { conversation: ClientConversation }) {
  const { user } = useAuth();
  const role = user?.role.toLowerCase() ?? "agent";

  const inWindow =
    conversation.last_inbound_at &&
    Date.now() - new Date(conversation.last_inbound_at).getTime() < 24 * 3600 * 1000;

  return (
    <div className="space-y-6 p-5">
      <div className="flex flex-col items-center text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-secondary">
          <BrandMark brand="whatsapp" size={32} />
        </span>
        <div className="mt-3 text-base font-semibold text-foreground">
          {conversation.external_phone_e164 ?? "(sin número)"}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          <Pill tone={conversation.ai_enabled ? "success" : "neutral"}>
            {conversation.ai_enabled ? "IA activa" : "Manual"}
          </Pill>
          {conversation.archived_at && <Pill tone="neutral">Archivada</Pill>}
        </div>
      </div>

      <div>
        <SectionLabel className="px-0">Estado</SectionLabel>
        <dl className="mt-2 space-y-2.5 rounded-2xl bg-card p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Ventana 24h</dt>
            <dd>
              <Pill tone={inWindow ? "success" : "warning"}>
                {inWindow ? "Abierta" : "Cerrada"}
              </Pill>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Último mensaje</dt>
            <dd className="text-right text-foreground">{fmt(conversation.last_message_at)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Última respuesta</dt>
            <dd className="text-right text-foreground">{fmt(conversation.last_inbound_at)}</dd>
          </div>
        </dl>
      </div>

      {conversation.contact_id ? (
        <Link
          to={`/${role}/personas/${conversation.contact_id}`}
          className="block rounded-2xl bg-card p-4 text-sm font-semibold text-primary transition hover:bg-secondary/60"
        >
          Ver ficha del contacto
        </Link>
      ) : (
        <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">
          Sin contacto vinculado.
        </p>
      )}
    </div>
  );
}
