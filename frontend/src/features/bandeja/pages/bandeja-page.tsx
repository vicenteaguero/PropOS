import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, ArchiveRestore, Inbox, Mail, PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BrandMark,
  FilterSelect,
  HOVER_REVEAL,
  ListShell,
  MasterDetail,
  Pill,
  RoundButton,
  Row,
  ViewToggle,
  type PillTone,
} from "@shared/ui";
import { listTime } from "@shared/utils/relative-time";
import { useContacts } from "@features/contacts/hooks/use-contacts";
import { useOpportunities } from "@features/opportunities/hooks/use-opportunities";
import { useProperties } from "@features/documents/hooks/use-entities";
import {
  useArchiveConversation,
  useConversations,
} from "@features/client-chat/hooks/use-client-chat";
import { ConversationAside } from "@features/client-chat/components/conversation-aside";
import { MessageThread } from "@features/client-chat/components/message-thread";
import { CONVERSATION_STATUS_TONES, conversationStatusLabel } from "@features/client-chat/status";
import type { ClientConversation } from "@features/client-chat/types";
import { useArchiveEmailThread, useEmailThreads } from "@features/email/hooks/use-email";
import { EmailComposeSheet } from "@features/email/components/email-compose-sheet";
import { EmailThreadView } from "@features/email/components/email-thread-view";
import { EMAIL_STATUS_TONES, emailStatusLabel } from "@features/email/status";
import type { EmailThread } from "@features/email/api/email-api";

export type InboxChannel = "whatsapp" | "email";

type ChannelFilter = "todos" | InboxChannel;
type StateFilter = "todos" | "pending" | "open" | "closed" | "archived";

/** One row of the inbox, whatever channel it came from. */
interface InboxEntry {
  key: string;
  id: string;
  channel: InboxChannel;
  title: string;
  /** The property the thread is about. The single most useful fact in a row:
   *  a broker recognises "Depto 2D Ñuñoa" instantly and a phone number never. */
  property: string | null;
  /** epoch ms of the last activity; 0 sorts last */
  time: number;
  statusLabel: string;
  statusTone: PillTone;
  contactId: string | null;
  /** last activity was inbound and the thread is still open → awaiting our reply */
  needsReply: boolean;
  archived: boolean;
  closed: boolean;
  /** lowercased corpus the search box matches against */
  haystack: string;
}

const STATE_FILTERS: { id: StateFilter; label: string }[] = [
  { id: "todos", label: "Todas" },
  { id: "pending", label: "Sin responder" },
  { id: "open", label: "Abiertas" },
  { id: "closed", label: "Cerradas" },
  { id: "archived", label: "Archivadas" },
];

const CHANNEL_LABEL: Record<InboxChannel, string> = {
  whatsapp: "WhatsApp",
  email: "Correo",
};

/** `"whatsapp:<uuid>"` → coordinates. Anything else reads as "nothing open". */
function parseThreadParam(raw: string | null): { channel: InboxChannel; id: string } | null {
  if (!raw) return null;
  const sep = raw.indexOf(":");
  const channel = raw.slice(0, sep);
  const id = raw.slice(sep + 1);
  if (!id || (channel !== "whatsapp" && channel !== "email")) return null;
  return { channel, id };
}

function toMs(iso: string | null | undefined): number {
  return iso ? Date.parse(iso) : 0;
}

function conversationEntry(
  c: ClientConversation,
  name: string | undefined,
  property: string | null,
): InboxEntry {
  const last = toMs(c.last_message_at);
  const inbound = toMs(c.last_inbound_at);
  // A name whenever we have one: the phone number is a fallback identity, not a
  // label. Rows that all read "+569…" are unscannable.
  const title = name || c.external_phone_e164 || "(sin número)";
  return {
    key: `whatsapp:${c.id}`,
    id: c.id,
    channel: "whatsapp",
    title,
    property,
    time: last,
    statusLabel: conversationStatusLabel(c.status),
    statusTone: CONVERSATION_STATUS_TONES[c.status] ?? "neutral",
    contactId: c.contact_id,
    // Open thread whose latest activity was the contact writing in.
    needsReply: c.status !== "closed" && inbound > 0 && inbound >= last,
    archived: !!c.archived_at,
    closed: c.status === "closed",
    haystack: `${title} ${c.external_phone_e164 ?? ""} ${property ?? ""}`.toLowerCase(),
  };
}

function threadEntry(t: EmailThread, property: string | null): InboxEntry {
  const who = t.counterpart_name || t.counterpart_email || "(sin remitente)";
  const subject = t.subject || "(sin asunto)";
  const archived = t.status.toUpperCase() === "ARCHIVED";
  return {
    key: `email:${t.id}`,
    id: t.id,
    channel: "email",
    title: who,
    property: property ?? subject,
    time: toMs(t.last_message_at),
    statusLabel: emailStatusLabel(t.status),
    statusTone: EMAIL_STATUS_TONES[t.status.toUpperCase()] ?? "neutral",
    contactId: t.contact_id,
    // Email threads expose no inbound timestamp, so "sin responder" cannot be
    // derived for them; they are simply never in that bucket.
    needsReply: false,
    archived,
    closed: archived,
    haystack: `${who} ${subject} ${t.counterpart_email ?? ""}`.toLowerCase(),
  };
}

interface BandejaPageProps {
  /**
   * Channels this user may see, from their admin scope. A single channel hides
   * the channel switcher — a one-item tab bar is a lie about having a choice.
   */
  channels?: InboxChannel[];
}

/**
 * Bandeja — every inbound conversation, one list.
 *
 * WhatsApp and email used to be two top-level tabs with two separate
 * implementations of the same screen, plus a third "bandeja" tab that merged
 * them read-only and, when tapped, threw you into one of the other two. The
 * broker's question is "who is waiting on me", which has nothing to do with
 * which pipe the message arrived through — so the channel is a filter, and
 * opening a row opens the thread right here.
 */
export function BandejaPage({ channels = ["whatsapp", "email"] }: BandejaPageProps) {
  const [channel, setChannel] = useState<ChannelFilter>("todos");
  const [state, setState] = useState<StateFilter>("todos");
  const [query, setQuery] = useState("");
  // The open thread's coordinates live in the URL — not in state, and not as
  // the row object, which is rebuilt on every refetch. Below md the pane swaps
  // the list out, so Back has to return to the list rather than leave the CRM.
  const [params, setParams] = useSearchParams();
  const selected = parseThreadParam(params.get("hilo"));
  const openThread = (channel: InboxChannel, id: string) => {
    const next = new URLSearchParams(params);
    next.set("hilo", `${channel}:${id}`);
    setParams(next);
  };
  const closeThread = () => {
    const next = new URLSearchParams(params);
    next.delete("hilo");
    setParams(next, { replace: true });
  };
  const [composeOpen, setComposeOpen] = useState(false);

  const showWhatsApp = channels.includes("whatsapp");
  const showEmail = channels.includes("email");
  const archivedView = state === "archived";

  // The WhatsApp list is archived-or-active server-side, so the view flag has to
  // reach the query rather than being filtered out of the result.
  const convos = useConversations(undefined, archivedView);
  const emails = useEmailThreads({});
  // Contacts resolve a role (comprador / propietario / …) per row. One fetch,
  // joined by contact_id; TanStack dedupes it with the Personas tab's copy.
  const contacts = useContacts({ limit: 500 });
  const opportunities = useOpportunities({ status: "OPEN", limit: 500 });
  const properties = useProperties();
  const archiveConversation = useArchiveConversation();
  const archiveThread = useArchiveEmailThread();

  const namesById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contacts.data ?? []) if (c.full_name) m.set(c.id, c.full_name);
    return m;
  }, [contacts.data]);

  /**
   * contact → the property they are currently dealing on.
   *
   * This is the join the inbox was missing, and the reason it felt disconnected
   * from the database: a thread is always ABOUT something, and until the row
   * says which property, the broker has to open it to find out. Resolved from
   * the person's open opportunity; both queries are already in cache from the
   * Personas and Pipeline tabs, so this costs nothing extra in practice.
   */
  const propertyByContact = useMemo(() => {
    const titles = new Map<string, string>();
    for (const p of properties.data ?? []) if (p.title) titles.set(p.id, p.title);
    const m = new Map<string, string>();
    for (const o of opportunities.data ?? []) {
      if (!o.person_id || !o.property_id) continue;
      const title = titles.get(o.property_id);
      if (title && !m.has(o.person_id)) m.set(o.person_id, title);
    }
    return m;
  }, [opportunities.data, properties.data]);

  const conversationById = useMemo(() => {
    const m = new Map<string, ClientConversation>();
    for (const c of convos.data ?? []) m.set(c.id, c);
    return m;
  }, [convos.data]);

  const entries = useMemo<InboxEntry[]>(() => {
    const out: InboxEntry[] = [];
    if (showWhatsApp) {
      for (const c of convos.data ?? [])
        out.push(
          conversationEntry(
            c,
            c.contact_id ? namesById.get(c.contact_id) : undefined,
            c.contact_id ? (propertyByContact.get(c.contact_id) ?? null) : null,
          ),
        );
    }
    if (showEmail) {
      for (const t of emails.data ?? [])
        out.push(
          threadEntry(t, t.contact_id ? (propertyByContact.get(t.contact_id) ?? null) : null),
        );
    }
    return out.sort((a, b) => b.time - a.time);
  }, [convos.data, emails.data, namesById, propertyByContact, showWhatsApp, showEmail]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (channel !== "todos" && e.channel !== channel) return false;
      // Archived is a view, not a facet: everywhere else archived rows are out.
      if (archivedView ? !e.archived : e.archived) return false;
      if (state === "pending" && !e.needsReply) return false;
      if (state === "open" && e.closed) return false;
      if (state === "closed" && !e.closed) return false;
      if (q && !e.haystack.includes(q)) return false;
      return true;
    });
  }, [entries, channel, state, archivedView, query]);

  const pendingCount = useMemo(
    () => entries.filter((e) => e.needsReply && !e.archived).length,
    [entries],
  );

  const isLoading =
    (showWhatsApp && convos.isPending) || (showEmail && emails.isLoading) || contacts.isLoading;
  // A failed fetch must not read as an empty inbox: real messages would go
  // unanswered inside WhatsApp's 24h freeform window and nobody would know.
  const error = (showWhatsApp && convos.error) || (showEmail && emails.error) || null;

  /**
   * Archiving is per-channel: WhatsApp toggles `archived_at`, email flips the
   * thread status. Restoring an email thread is not exposed by the API, so the
   * control only archives there.
   */
  const archive = (e: InboxEntry) => {
    if (e.channel === "whatsapp") {
      archiveConversation.mutate({ id: e.id, archived: !e.archived });
      return;
    }
    if (!e.archived) archiveThread.mutate(e.id);
  };

  const retry = () => {
    if (showWhatsApp) void convos.refetch();
    if (showEmail) void emails.refetch();
  };

  /**
   * One row, two controls.
   *
   * This used to be a pill TabBar for the channel PLUS a horizontally
   * scrolling chip strip for the state — two scrolling rows on a phone, where
   * the active state could be off screen. The channel is three options and
   * belongs in an icon switch; the state is a single choice and belongs in a
   * dropdown that says which one is active without scrolling to find out.
   */
  const filters = (
    <div className="flex items-center gap-2">
      {showWhatsApp && showEmail && (
        <ViewToggle
          value={channel}
          onChange={(v: string) => setChannel(v as ChannelFilter)}
          options={[
            { value: "todos", label: "Todo", icon: <Inbox className="size-4" strokeWidth={1.9} /> },
            {
              value: "whatsapp",
              label: CHANNEL_LABEL.whatsapp,
              icon: <BrandMark brand="whatsapp" size={17} />,
            },
            {
              value: "email",
              label: CHANNEL_LABEL.email,
              icon: <Mail className="size-4" strokeWidth={1.9} />,
            },
          ]}
        />
      )}
      <FilterSelect
        label="Estado"
        value={state === "todos" ? null : state}
        onChange={(v) => setState((v ?? "todos") as StateFilter)}
        allLabel="Todas"
        options={STATE_FILTERS.filter((f) => f.id !== "todos").map((f) => ({
          value: f.id,
          label: f.id === "pending" && pendingCount > 0 ? `${f.label} (${pendingCount})` : f.label,
        }))}
      />
    </div>
  );

  const list = (
    <ListShell
      fill
      title="Bandeja"
      meta={shown.length > 0 ? `${shown.length}` : undefined}
      search={{
        value: query,
        onChange: setQuery,
        placeholder: "Buscar por nombre, teléfono o asunto",
        ariaLabel: "Buscar conversaciones",
      }}
      action={
        // Icon-only: a labelled button here took a third of the header row on a
        // phone to say what a pencil already says.
        showEmail ? (
          <Button
            size="icon"
            aria-label="Escribir correo"
            title="Escribir correo"
            className="rounded-full"
            onClick={() => setComposeOpen(true)}
          >
            <PenSquare className="size-4" strokeWidth={1.8} />
          </Button>
        ) : undefined
      }
      filters={filters}
      isLoading={isLoading}
      error={error}
      errorMessage="No se pudo cargar la bandeja."
      onRetry={retry}
      isEmpty={shown.length === 0}
      emptyTitle={query ? "Sin coincidencias" : "Bandeja vacía"}
    >
      {shown.map((e, i) => (
        // Wrapper, not a `right` slot: Row is itself a <button> when tappable,
        // and a button inside a button is invalid and unreachable by keyboard.
        <div key={e.key} className="group relative">
          <Row
            divider={i < shown.length - 1}
            onClick={() => openThread(e.channel, e.id)}
            className={
              selected?.channel === e.channel && selected.id === e.id
                ? "bg-secondary/60"
                : undefined
            }
            // The mark, bare. A tinted circle behind a brand glyph adds a
            // second shape to parse per row and says nothing the glyph doesn't.
            left={
              <BrandMark
                mono
                brand={e.channel === "whatsapp" ? "whatsapp" : "email"}
                size={20}
                className="text-muted-foreground"
              />
            }
            title={e.title}
            sub={<span className="block truncate">{e.property ?? "Sin propiedad vinculada"}</span>}
            right={
              // pr-9 reserves the archive control's column. It used to sit
              // BELOW the pill with a spacer holding its place, which made every
              // row three lines tall for a control most rows never use.
              <span className="flex shrink-0 flex-col items-end gap-1 pr-9">
                <span className="text-[12px] whitespace-nowrap text-faint">
                  {listTime(e.time ? new Date(e.time).toISOString() : null)}
                </span>
                {e.needsReply ? (
                  <Pill tone="destructive" dot="var(--destructive)">
                    Sin responder
                  </Pill>
                ) : (
                  <Pill tone={e.statusTone}>{e.statusLabel}</Pill>
                )}
              </span>
            }
          />
          <RoundButton
            tone="ghost"
            size={32}
            aria-label={e.archived ? "Restaurar" : "Archivar"}
            title={e.archived ? "Restaurar" : "Archivar"}
            className={`absolute right-[var(--page-x)] top-1/2 -translate-y-1/2 ${HOVER_REVEAL}`}
            onClick={() => archive(e)}
          >
            {e.archived ? (
              <ArchiveRestore className="size-4" strokeWidth={1.8} />
            ) : (
              <Archive className="size-4" strokeWidth={1.8} />
            )}
          </RoundButton>
        </div>
      ))}
    </ListShell>
  );

  const selectedConversation =
    selected?.channel === "whatsapp" ? (conversationById.get(selected.id) ?? null) : null;

  return (
    <>
      <MasterDetail
        selected={!!selected}
        list={list}
        listWidth="24rem"
        detail={
          selectedConversation ? (
            <MessageThread conversation={selectedConversation} onBack={closeThread} />
          ) : selected?.channel === "email" ? (
            <EmailThreadView threadId={selected.id} onBack={closeThread} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              Selecciona una conversación.
            </div>
          )
        }
        aside={
          selectedConversation ? (
            <ConversationAside conversation={selectedConversation} />
          ) : undefined
        }
      />
      <EmailComposeSheet
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onSent={(threadId) => {
          void emails.refetch();
          openThread("email", threadId);
        }}
      />
    </>
  );
}

export default BandejaPage;
