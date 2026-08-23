import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  ArrowUpDown,
  PenSquare,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientChatApi } from "@features/client-chat/api/client-chat-api";
import { Button } from "@/components/ui/button";
import {
  CONTROL_SQUARE,
  EmailMark,
  FilterSelect,
  HOVER_REVEAL,
  ListShell,
  MasterDetail,
  RoundButton,
  Row,
  SwipeAction,
  WhatsAppMark,
  type PillTone,
} from "@shared/ui";
import { cn } from "@/lib/utils";
import { listTime } from "@shared/utils/relative-time";
import { useAuth } from "@shared/hooks/use-auth";
import { useAttention } from "../hooks/use-attention";
import {
  AttentionRow,
  KIND_LABEL,
  URGENCY_LABEL,
  URGENCY_ORDER,
} from "../components/attention-row";
import type { AttentionItem, AttentionKind } from "../api/attention-api";
import { ChannelSwitch, type ChannelFilter } from "../components/channel-switch";

/**
 * The kinds that are a conversation with a person waiting on the other end.
 *
 * The cross-source queue also carries visits, tasks and stalled deals; those
 * answer "what do I do now" and live on Inicio. A tab called Conversaciones
 * showing a visit was a category error, and it made the filter menu offer four
 * options that could never match anything here.
 */
const CONVERSATION_KINDS: AttentionKind[] = ["unanswered", "lead"];
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

/** Conversation states, plus one entry per attention kind. */
type StateFilter = "todos" | "open" | "closed" | "archived" | "unidentified" | AttentionKind;

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
  ...CONVERSATION_KINDS.map((kind) => ({ id: kind as StateFilter, label: KIND_LABEL[kind] })),
  // The queue that used to not exist. An unknown number silently minted a
  // contact named after its own phone number, so this pile was invisible and
  // made of junk rows.
  { id: "unidentified", label: "Sin identificar" },
  { id: "open", label: "Conversaciones abiertas" },
  { id: "closed", label: "Cerradas" },
  { id: "archived", label: "Archivadas" },
];

/** Section heading inside the list. Says what the rows below have in common. */
function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-border bg-secondary/40 px-[var(--page-x)] py-1.5">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {children}
      </span>
      {count !== undefined && count > 0 && <span className="text-[11px] text-faint">{count}</span>}
    </div>
  );
}

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
  // A name whenever we have one: a phone number is a fallback identity, not a
  // label, and rows that all read "+569…" are unscannable. For a thread nobody
  // has identified yet, WhatsApp's own display name is the best clue there is —
  // it used to be thrown away, or worse, saved as the contact's full name.
  const whatsappName =
    typeof c.metadata?.whatsapp_name === "string" ? c.metadata.whatsapp_name : null;
  const title = name || whatsappName || c.external_phone_e164 || "(sin número)";
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

interface AttentionPageProps {
  /**
   * Channels this user may see, from their admin scope. A single channel hides
   * the channel switcher — a one-item tab bar is a lie about having a choice.
   */
  channels?: InboxChannel[];
}

/**
 * Atención — everything waiting on the broker, then everything else.
 *
 * This was Bandeja: every inbound conversation in one list, which already beat
 * the two-tabs-per-transport screen it replaced. It still answered the wrong
 * question. "Who is waiting on me" is not only a messaging question — a visit
 * at 15:30, a lead a portal sent to four brokers at once, and a deal nobody has
 * opened in a month all expire on their own, and each lived on a different
 * screen with its own idea of what "recent" meant.
 *
 * So the top of this list is the ranked queue from `/v1/attention`: one row per
 * real-world obligation, each carrying the reason it surfaced and how soon it
 * stops being fixable. Conversations that are already in that queue do not
 * repeat below it — everything else follows in the order it arrived.
 */
type InboxSort = "urgency" | "recent" | "unread";

const INBOX_SORTS: { value: InboxSort; label: string; sub: string }[] = [
  { value: "urgency", label: "Urgencia", sub: "Lo que deja de arreglarse antes" },
  { value: "recent", label: "Más recientes", sub: "Por última actividad" },
  { value: "unread", label: "Sin leer", sub: "Los que tienen más mensajes nuevos" },
];

export function AttentionPage({ channels = ["whatsapp", "email"] }: AttentionPageProps) {
  const [channel, setChannel] = useState<ChannelFilter>("todos");
  const [state, setState] = useState<StateFilter>("todos");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<InboxSort>("urgency");
  const qc = useQueryClient();
  // Fire-and-forget: the badge is optimistic through the invalidation, and a
  // failed mark-read is a badge that stays up, not an error worth a toast.
  const markRead = useMutation({
    mutationFn: (conversationId: string) => clientChatApi.markRead(conversationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attention"] }),
  });
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = (user?.role ?? "ADMIN").toLowerCase();
  // Conversation kinds only. The cross-source queue (visits, tasks, stalled
  // deals) answers "what do I do now" and lives on Inicio; this tab answers the
  // narrower "who is waiting on me", and showing a visit here was a category
  // error in a tab literally named Conversaciones.
  const attention = useAttention(60, CONVERSATION_KINDS);

  const showWhatsApp = channels.includes("whatsapp");
  const showEmail = channels.includes("email");
  const archivedView = state === "archived";
  const unidentifiedView = state === "unidentified";

  // The WhatsApp list is archived-or-active server-side, so the view flag has to
  // reach the query rather than being filtered out of the result.
  // Server-side for the unidentified queue: it is a `contact_id IS NULL`
  // index scan, and filtering it in the browser would need the whole table.
  const convos = useConversations(
    undefined,
    archivedView,
    unidentifiedView ? { unidentified: true } : {},
  );
  const emails = useEmailThreads({});
  // Only the property list, and only for the context rail's `titleFor`. The
  // NAMES and the property each thread is about now arrive on the conversation
  // rows themselves (`contact_name`, `property_title`, resolved by the list
  // endpoint). This page used to fetch 500 contacts and 500 opportunities to
  // build those two lookups in the browser — a thousand rows over the wire to
  // label at most 200, on the section a broker opens first.
  const properties = useProperties();
  const archiveConversation = useArchiveConversation();
  const archiveThread = useArchiveEmailThread();

  const propertyTitles = useMemo(() => {
    const titles = new Map<string, string>();
    for (const p of properties.data ?? []) if (p.title) titles.set(p.id, p.title);
    return titles;
  }, [properties.data]);

  const conversationById = useMemo(() => {
    const m = new Map<string, ClientConversation>();
    for (const c of convos.data ?? []) m.set(c.id, c);
    return m;
  }, [convos.data]);

  const entries = useMemo<InboxEntry[]>(() => {
    const out: InboxEntry[] = [];
    if (showWhatsApp) {
      for (const c of convos.data ?? [])
        out.push(conversationEntry(c, c.contact_name ?? undefined, c.property_title ?? null));
    }
    if (showEmail) {
      // An e-mail thread carries its own subject, which is what the row falls
      // back to — and for a portal lead ("Nuevo interesado en Depto 2D") the
      // subject says more than the property title would.
      for (const t of emails.data ?? []) out.push(threadEntry(t, null));
    }
    return out.sort((a, b) => b.time - a.time);
  }, [convos.data, emails.data, showWhatsApp, showEmail]);

  const kindFilter: AttentionKind | null = CONVERSATION_KINDS.includes(state as AttentionKind)
    ? (state as AttentionKind)
    : null;

  /**
   * The queue, filtered the same way the list below it is.
   *
   * The channel switch applies here too: picking WhatsApp must not leave a
   * ranked email lead sitting above a WhatsApp-only list. Rows with no channel
   * at all — a visit, an overdue task — belong to "Todo" only.
   */
  const attentionItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = attention.data?.items ?? [];
    return items.filter((item) => {
      if (archivedView) return false;
      if (kindFilter && item.kind !== kindFilter) return false;
      // "Cerradas" is a question about the mailbox; the queue has no answer.
      if (!kindFilter && (state === "closed" || state === "unidentified")) return false;
      if (channel === "whatsapp" && !item.conversation_id) return false;
      if (channel === "email" && !item.thread_id) return false;
      if (!showWhatsApp && item.conversation_id) return false;
      if (!showEmail && item.thread_id) return false;
      if (q && !`${item.title} ${item.subtitle ?? ""} ${item.reason}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [attention.data, kindFilter, state, channel, archivedView, query, showWhatsApp, showEmail]);

  /**
   * The queue, ordered. `urgency` keeps the grouped view the page was built
   * around; the other two flatten it, because "most recent" and "most unread"
   * are questions about the whole list and grouping them by urgency answers a
   * different one.
   */
  const orderedItems = useMemo(() => {
    if (sort === "urgency") return attentionItems;
    const stamp = (i: AttentionItem) => new Date(i.last_at ?? i.at ?? 0).getTime();
    return [...attentionItems].sort((a, b) =>
      sort === "recent"
        ? stamp(b) - stamp(a)
        : (b.unread ?? 0) - (a.unread ?? 0) || stamp(b) - stamp(a),
    );
  }, [attentionItems, sort]);

  /** Threads already represented in the queue, so they are not listed twice. */
  const queuedThreadKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of attentionItems) {
      if (item.conversation_id) keys.add(`whatsapp:${item.conversation_id}`);
      if (item.thread_id) keys.add(`email:${item.thread_id}`);
    }
    return keys;
  }, [attentionItems]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    // A kind filter is a question about the queue, not about the mailbox: it
    // would otherwise show "Visitas" over the full conversation list.
    if (kindFilter) return [];
    return entries.filter((e) => {
      if (channel !== "todos" && e.channel !== channel) return false;
      // Archived is a view, not a facet: everywhere else archived rows are out.
      if (archivedView ? !e.archived : e.archived) return false;
      // An unidentified thread has no name to rank and no person to attribute
      // it to, so the ranked queue skips it. This filter is the only way to see
      // that pile, which is the point of having it.
      if (unidentifiedView && e.contactId) return false;
      if (!unidentifiedView && !archivedView && queuedThreadKeys.has(e.key)) return false;
      if (state === "open" && e.closed) return false;
      if (state === "closed" && !e.closed) return false;
      if (q && !e.haystack.includes(q)) return false;
      return true;
    });
  }, [
    entries,
    channel,
    state,
    kindFilter,
    archivedView,
    unidentifiedView,
    queuedThreadKeys,
    query,
  ]);

  const isLoading =
    (showWhatsApp && convos.isPending) || (showEmail && emails.isLoading) || attention.isLoading;
  // A failed fetch must not read as an empty inbox: real messages would go
  // unanswered inside WhatsApp's 24h freeform window and nobody would know.
  const error =
    (showWhatsApp && convos.error) || (showEmail && emails.error) || attention.error || null;

  /** Where an item is worked. Conversations open in this pane; the rest route. */
  const openAttention = (item: AttentionItem) => {
    if (item.conversation_id) {
      // Opening it is reading it. Marking read on close instead would leave the
      // badge up for as long as the thread is open, which is the one moment it
      // is certainly wrong.
      if ((item.unread ?? 0) > 0) markRead.mutate(item.conversation_id);
      return openThread("whatsapp", item.conversation_id);
    }
    if (item.thread_id) return openThread("email", item.thread_id);
    if (item.event_id) return navigate(`/${role}/agenda?tab=calendario`);
    if (item.task_id) return navigate(`/${role}/agenda?tab=tareas`);
    if (item.opportunity_id) return navigate(`/${role}/clientes?tab=negocios`);
    if (item.contact_id) return navigate(`/${role}/personas/${item.contact_id}`);
  };

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
      {showWhatsApp && showEmail && <ChannelSwitch value={channel} onChange={setChannel} />}
      <FilterSelect
        // Icons, not words: "Filtrar: Todo · Ordenar: Urgencia" spent two
        // thirds of a phone's width saying that neither control was doing
        // anything. The sheet each opens still carries the full label.
        iconOnly
        icon={<SlidersHorizontal className="size-4" strokeWidth={1.9} />}
        // "Estado" named the field; "Filtrar" names the act, which is what a
        // control the broker taps should say.
        label="Filtrar"
        value={state === "todos" ? null : state}
        onChange={(v) => setState((v ?? "todos") as StateFilter)}
        allLabel="Todo"
        options={STATE_FILTERS.filter((f) => f.id !== "todos").map((f) => {
          // A count only where the API supplies one, and only when non-zero: a
          // filter labelled "Leads (0)" invites a tap that shows nothing.
          const count = attention.data?.counts?.[f.id as AttentionKind];
          return { value: f.id, label: count ? `${f.label} (${count})` : f.label };
        })}
      />
      {/* The control that was simply missing. The queue has always been ranked
          by urgency, which is right by default and wrong the moment you are
          looking for "the one that came in ten minutes ago". */}
      <FilterSelect
        iconOnly
        icon={<ArrowUpDown className="size-4" strokeWidth={1.9} />}
        label="Ordenar"
        value={sort}
        options={INBOX_SORTS.map((o) => ({ value: o.value, label: o.label, sub: o.sub }))}
        onChange={(v) => setSort((v as InboxSort) ?? "urgency")}
      />
    </div>
  );

  const list = (
    <ListShell
      fill
      // No painted title: the section tab overhead already reads
      // "Conversaciones", and the count that sat beside it ("82 sin responder")
      // was a number nobody can act on — the rows below are already ordered by
      // which one to answer first.
      titleSr="Conversaciones"
      search={{
        value: query,
        onChange: setQuery,
        placeholder: "Buscar conversación…",
        ariaLabel: "Buscar conversaciones",
      }}
      action={
        // Its own destination now, not a `?tab=` that injected a tab into the
        // bar with no way to close it. A conversation is with a person; the
        // catalogue of people is the natural next place.
        <Button
          size="icon"
          variant="outline"
          aria-label="Ver personas"
          title="Ver personas"
          className={cn("rounded-full", CONTROL_SQUARE)}
          onClick={() => navigate(`/${role}/personas`)}
        >
          <Users className="size-4" strokeWidth={1.8} />
        </Button>
      }
      primaryAction={
        showEmail ? (
          <Button
            size="icon"
            aria-label="Escribir correo"
            title="Escribir correo"
            className={cn("rounded-full", CONTROL_SQUARE)}
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
      isEmpty={shown.length === 0 && attentionItems.length === 0}
      emptyTitle={query ? "Sin coincidencias" : "Nada pendiente"}
    >
      {sort !== "urgency" &&
        orderedItems.map((item, i) => (
          <AttentionRow
            key={item.id}
            item={item}
            divider={i < orderedItems.length - 1}
            selected={
              (selected?.channel === "whatsapp" && selected.id === item.conversation_id) ||
              (selected?.channel === "email" && selected.id === item.thread_id)
            }
            onOpen={openAttention}
          />
        ))}
      {sort === "urgency" &&
        URGENCY_ORDER.map((urgency) => {
          const group = attentionItems.filter((item) => item.urgency === urgency);
          if (group.length === 0) return null;
          return (
            <div key={urgency}>
              {/* The heading carries the urgency so the rows do not have to. */}
              <SectionLabel count={group.length}>
                {kindFilter
                  ? `${KIND_LABEL[kindFilter]} · ${URGENCY_LABEL[urgency]}`
                  : URGENCY_LABEL[urgency]}
              </SectionLabel>
              {group.map((item, i) => (
                <AttentionRow
                  key={item.id}
                  item={item}
                  divider={i < group.length - 1}
                  selected={
                    (selected?.channel === "whatsapp" && selected.id === item.conversation_id) ||
                    (selected?.channel === "email" && selected.id === item.thread_id)
                  }
                  onOpen={openAttention}
                />
              ))}
            </div>
          );
        })}
      {attentionItems.length > 0 && shown.length > 0 && (
        <SectionLabel>
          {archivedView ? "Archivadas" : unidentifiedView ? "Sin identificar" : "Conversaciones"}
        </SectionLabel>
      )}
      {shown.map((e, i) => (
        // Wrapper, not a `right` slot: Row is itself a <button> when tappable,
        // and a button inside a button is invalid and unreachable by keyboard.
        <SwipeAction
          key={e.key}
          onAction={() => archive(e)}
          icon={
            e.archived ? (
              <ArchiveRestore className="size-[18px]" strokeWidth={1.9} />
            ) : (
              <Archive className="size-[18px]" strokeWidth={1.9} />
            )
          }
          label={e.archived ? "Restaurar" : "Archivar"}
          className="group"
        >
          <Row
            divider={i < shown.length - 1}
            onClick={() => openThread(e.channel, e.id)}
            className={
              selected?.channel === e.channel && selected.id === e.id
                ? "bg-secondary/60"
                : undefined
            }
            // The brand mark, in colour. Which channel a thread is on decides
            // what may be said and how fast — a WhatsApp window closes, an
            // e-mail does not — so it is the one thing worth recognising before
            // reading a single word.
            left={e.channel === "whatsapp" ? <WhatsAppMark size={22} /> : <EmailMark size={22} />}
            title={e.title}
            titleRight={
              <span className="text-[12px] font-medium text-faint">
                {listTime(e.time ? new Date(e.time).toISOString() : null)}
              </span>
            }
            sub={
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="min-w-0 flex-1 truncate">
                  {e.property ?? <span className="text-faint">Sin propiedad vinculada</span>}
                </span>
                {e.needsReply ? (
                  <span className="shrink-0 font-medium text-destructive">Sin responder</span>
                ) : (
                  e.closed && <span className="shrink-0 text-faint">{e.statusLabel}</span>
                )}
              </span>
            }
          />
          {/* Pointer fallback for the same action. The swipe is the phone
              affordance; a mouse has no equivalent gesture, so hover still
              reveals a button. */}
          <RoundButton
            tone="ghost"
            size={32}
            aria-label={e.archived ? "Restaurar" : "Archivar"}
            title={e.archived ? "Restaurar" : "Archivar"}
            className={`absolute right-[var(--page-x)] top-1/2 -translate-y-1/2 [@media(pointer:coarse)]:hidden ${HOVER_REVEAL}`}
            onClick={() => archive(e)}
          >
            {e.archived ? (
              <ArchiveRestore className="size-4" strokeWidth={1.8} />
            ) : (
              <Archive className="size-4" strokeWidth={1.8} />
            )}
          </RoundButton>
        </SwipeAction>
      ))}
    </ListShell>
  );

  const selectedConversation =
    selected?.channel === "whatsapp" ? (conversationById.get(selected.id) ?? null) : null;
  const selectedEntry = selected
    ? entries.find((e) => e.key === `${selected.channel}:${selected.id}`)
    : undefined;

  return (
    <>
      <MasterDetail
        selected={!!selected}
        list={list}
        listWidth="24rem"
        detail={
          selectedConversation ? (
            <MessageThread
              conversation={selectedConversation}
              // The list already resolved both; the thread had no way to and
              // fell back to the phone number, so opening a conversation lost
              // the name the row had just shown.
              title={selectedEntry?.title}
              subtitle={selectedEntry?.property}
              onBack={closeThread}
            />
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
            <ConversationAside
              conversation={selectedConversation}
              // The properties list is already in cache for the rows; resolving
              // a title here costs nothing rather than a fetch per target.
              titleFor={(propertyId) => propertyTitles.get(propertyId) ?? null}
            />
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

export default AttentionPage;
