import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@shared/hooks/use-auth";
import { useConversations } from "@features/client-chat/hooks/use-client-chat";
import { useEmailThreads } from "@features/email/hooks/use-email";
import { useContacts } from "@features/contacts/hooks/use-contacts";
import { CONTACT_TYPE_LABELS, type ContactType } from "@features/contacts/types";
import type { UserProfile } from "@shared/types/auth";
import { PageLayout } from "@shared/components/page-layout";
import { EmptyState } from "@shared/components/empty-state/empty-state";
import {
  Row,
  Segmented,
  Pill,
  Chips,
  Chip,
  BrandMark,
  ErrorState,
  PageSkeleton,
  type PillTone,
} from "@shared/ui";
import { useIsDesktop } from "@/hooks/use-mobile";
import { CrmPipeline } from "../components/crm-pipeline";
import { CrmMetrics } from "../components/crm-metrics";
import { formatDayMonth } from "@shared/utils/format";

type Channel = "whatsapp" | "email";
type Tab = "bandeja" | "pipeline" | "metricas";
type FilterId = "todos" | "pending" | "interesado" | "dueno" | Channel;

interface InboxItem {
  key: string;
  channel: Channel;
  title: string;
  sub: string;
  time: number;
  status: string;
  contactId: string | null;
  /** last activity was inbound and the thread is still open → awaiting our reply */
  needsReply: boolean;
}

const STATUS_TONE: Record<string, PillTone> = {
  open: "success",
  assigned: "accent",
  closed: "neutral",
};

// Contact types that map to the mockup's "Interesados" / "Dueños" filters.
const INTERESADO_TYPES: ContactType[] = ["BUYER", "INVESTOR"];
const DUENO_TYPES: ContactType[] = ["SELLER", "LANDOWNER"];

function fmt(ms: number): string {
  if (!ms) return "";
  return formatDayMonth(ms);
}

const TABS = [
  { id: "bandeja", label: "Bandeja" },
  { id: "pipeline", label: "Pipeline" },
  { id: "metricas", label: "Métricas" },
];

const FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "pending", label: "Por responder" },
  { id: "interesado", label: "Interesados" },
  { id: "dueno", label: "Dueños" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Correos" },
];

/**
 * Métricas reads `/v1/analytics/pipeline`, which the backend gates with
 * `require_role("ADMIN")` + `require_scope("analytics")` — an empty scope means
 * full admin. The bandeja route itself is open to AGENT, so the tab has to
 * mirror that gate or an AGENT gets a 403 from a tab we offered them.
 */
function canSeeMetrics(user: UserProfile | null): boolean {
  if (!user || user.role !== "ADMIN") return false;
  const scope = user.adminScope ?? [];
  return scope.length === 0 || scope.includes("analytics");
}

/**
 * CRM screen — a tabbed surface over Bandeja / Pipeline / Métricas.
 *
 * Bandeja merges recent WhatsApp + Email activity into one list and routes into
 * the existing (separate) inboxes; channels are NOT merged into one thread (by
 * design). Pipeline and Métricas reuse the opportunities + analytics data.
 */
export function BandejaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const base = `/${(user?.role ?? "ADMIN").toLowerCase()}`;
  const [tab, setTab] = useState<Tab>("bandeja");
  const [filter, setFilter] = useState<FilterId>("todos");

  const showMetrics = canSeeMetrics(user);
  const tabs = useMemo(
    () => (showMetrics ? TABS : TABS.filter((t) => t.id !== "metricas")),
    [showMetrics],
  );
  // Falling back keeps the surface coherent if the tab disappears mid-session
  // (e.g. switching into a workspace where the user is not a full admin).
  const activeTab: Tab = tab === "metricas" && !showMetrics ? "bandeja" : tab;

  const convos = useConversations();
  const emails = useEmailThreads({});
  // Contacts let us resolve a role (comprador / propietario / …) per row and
  // power the Interesados / Dueños filters. Loaded once, joined by contact_id.
  const contacts = useContacts({ limit: 500 });

  const roleMap = useMemo(() => {
    const m = new Map<string, ContactType>();
    for (const c of contacts.data ?? []) m.set(c.id, c.type);
    return m;
  }, [contacts.data]);

  const items = useMemo<InboxItem[]>(() => {
    const wa: InboxItem[] = (convos.data ?? []).map((c) => {
      const lastMs = c.last_message_at ? Date.parse(c.last_message_at) : 0;
      const inboundMs = c.last_inbound_at ? Date.parse(c.last_inbound_at) : 0;
      return {
        key: `wa-${c.id}`,
        channel: "whatsapp",
        title: c.external_phone_e164 ?? "Conversación de WhatsApp",
        sub: "WhatsApp · Kapso",
        time: lastMs,
        status: c.status,
        contactId: c.contact_id,
        // Open thread whose latest activity was the contact writing in.
        needsReply: c.status !== "closed" && inboundMs > 0 && inboundMs >= lastMs,
      };
    });
    const em: InboxItem[] = (emails.data ?? []).map((t) => ({
      key: `em-${t.id}`,
      channel: "email",
      title: t.counterpart_name || t.subject || t.counterpart_email || "Correo",
      sub: t.subject || "Correo · Titan",
      time: t.last_message_at ? Date.parse(t.last_message_at) : 0,
      status: t.status,
      contactId: t.contact_id,
      // NOTE: email threads expose no inbound timestamp, so "Por responder"
      // cannot be derived for email — they are excluded from that filter.
      needsReply: false,
    }));
    return [...wa, ...em].sort((a, b) => b.time - a.time);
  }, [convos.data, emails.data]);

  const shown = useMemo(() => {
    switch (filter) {
      case "todos":
        return items;
      case "pending":
        return items.filter((i) => i.needsReply);
      case "whatsapp":
      case "email":
        return items.filter((i) => i.channel === filter);
      case "interesado":
        return items.filter((i) => {
          const role = i.contactId ? roleMap.get(i.contactId) : undefined;
          return role != null && INTERESADO_TYPES.includes(role);
        });
      case "dueno":
        return items.filter((i) => {
          const role = i.contactId ? roleMap.get(i.contactId) : undefined;
          return role != null && DUENO_TYPES.includes(role);
        });
      default:
        return items;
    }
  }, [items, filter, roleMap]);

  const pendingTotal = useMemo(() => items.filter((i) => i.needsReply).length, [items]);

  const isLoading = convos.isLoading || emails.isLoading;
  const error = convos.error || emails.error;

  const goTo = (channel: Channel) =>
    navigate(channel === "whatsapp" ? `${base}/crm?tab=whatsapp` : `${base}/crm?tab=correos`);

  const loading = <PageSkeleton variant="list" count={5} />;

  const errorBox = (
    <ErrorState
      message="No se pudo cargar la bandeja."
      onRetry={() => {
        void convos.refetch();
        void emails.refetch();
      }}
      compact
    />
  );

  const empty = <EmptyState title="Bandeja vacía" description="No hay conversaciones recientes." />;

  const subLine = (it: InboxItem): string => {
    const role = it.contactId ? roleMap.get(it.contactId) : undefined;
    const roleLabel = role ? CONTACT_TYPE_LABELS[role] : undefined;
    // Enrich the sub-line with the contact role when we can resolve it.
    return roleLabel ? `${roleLabel} · ${it.sub}` : it.sub;
  };

  const rowFor = (it: InboxItem, divider: boolean) => (
    <Row
      key={it.key}
      divider={divider}
      onClick={() => goTo(it.channel)}
      left={<BrandMark brand={it.channel === "whatsapp" ? "whatsapp" : "email"} size={40} />}
      title={it.title}
      sub={subLine(it)}
      right={
        <div className="flex flex-col items-end gap-1.5">
          {it.needsReply ? (
            <Pill tone="destructive" dot="var(--destructive)">
              Por responder
            </Pill>
          ) : (
            <Pill tone={STATUS_TONE[it.status] ?? "neutral"}>{it.status}</Pill>
          )}
          <span className="text-xs text-faint">{fmt(it.time)}</span>
        </div>
      }
    />
  );

  // The filter chips + list body for the Bandeja tab. `wide` switches to the
  // desktop two-column card grid.
  const bandejaBody = (wide: boolean) => (
    <>
      <Chips className="mb-4 pb-1">
        {FILTERS.map((f) => (
          <Chip
            key={f.id}
            active={f.id === filter}
            count={f.id === "pending" && pendingTotal > 0 ? pendingTotal : undefined}
            onClick={() => setFilter(f.id as FilterId)}
          >
            {f.label}
          </Chip>
        ))}
      </Chips>

      {isLoading && loading}
      {error && errorBox}
      {!isLoading && !error && shown.length === 0 && empty}
      {!isLoading && !error && shown.length > 0 && wide && (
        <div className="overflow-hidden rounded-xl border border-border bg-card xl:grid xl:grid-cols-2">
          {shown.map((it, i) => rowFor(it, i < shown.length - 1))}
        </div>
      )}
      {!isLoading && !error && shown.length > 0 && !wide && (
        <div>{shown.map((it, i) => rowFor(it, i < shown.length - 1))}</div>
      )}
    </>
  );

  // Desktop: full-width app surface. Tabs live next to the header; the body
  // swaps between the three views. Bandeja keeps its dense two-column grid.
  if (isDesktop) {
    return (
      <PageLayout width="app">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <Segmented
            items={tabs}
            value={activeTab}
            onChange={(id) => setTab(id as Tab)}
            className="shrink-0 border-b-0 px-0"
          />
        </div>

        {activeTab === "bandeja" && bandejaBody(true)}
        {activeTab === "pipeline" && <CrmPipeline />}
        {activeTab === "metricas" && <CrmMetrics />}
      </PageLayout>
    );
  }

  // Mobile: capped column, full-width tab bar, stacked views.
  return (
    <PageLayout width="md">
      <div className="mb-4">
        <Segmented items={tabs} value={activeTab} onChange={(id) => setTab(id as Tab)} />
      </div>

      {activeTab === "bandeja" && bandejaBody(false)}
      {activeTab === "pipeline" && <CrmPipeline />}
      {activeTab === "metricas" && <CrmMetrics />}
    </PageLayout>
  );
}
