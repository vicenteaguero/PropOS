import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EntityCombobox } from "@features/documents/components/entity-combobox";
import { useContacts, useProperties } from "@features/documents/hooks/use-entities";
import { useOpportunities } from "@features/opportunities/hooks/use-opportunities";
import { useTenantMembers } from "@shared/hooks/use-tenant-members";
import { shortName, shortPropertyTitle } from "@shared/utils/display-name";
import { label } from "@shared/lib/labels";
import { STAGE_LABELS } from "@features/opportunities/types";
import { CONTROL_H, FilterSelect, FOCUS_RING, categoryVars } from "@shared/ui";
import { cn } from "@/lib/utils";
import type { EventBehavior } from "../api/calendar-api";
import { useEventTypes } from "../hooks/use-event-types";
import { LocationField } from "./location-field";
import { WhenField } from "./when-field";

/** Minutes before the start. `null` is "no reminder". */
export const REMINDER_OFFSETS: { value: number | null; label: string }[] = [
  { value: null, label: "Sin recordatorio" },
  { value: 15, label: "15 min antes" },
  { value: 60, label: "1 hora antes" },
  { value: 24 * 60, label: "1 día antes" },
];

export const PRIORITY_OPTIONS = [
  { value: "0", label: "Normal" },
  { value: "1", label: "Alta" },
  { value: "2", label: "Crítica" },
];

export const STATUS_OPTIONS = [
  { value: "SCHEDULED", label: "Programado" },
  { value: "DONE", label: "Hecho" },
  { value: "CANCELLED", label: "Cancelado" },
];

export interface EventFormState {
  title: string;
  kind: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location: string;
  description: string;
  status: string;
  priority: number;
  propertyId: string | null;
  propertyLabel: string;
  contactId: string | null;
  contactLabel: string;
  opportunityId: string | null;
  assigneeUser: string | null;
  /** Minutes before the start, or null. */
  remindOffset: number | null;
}

export function emptyEventForm(start: Date, kind = "VISIT"): EventFormState {
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    title: "",
    kind,
    start,
    end,
    allDay: false,
    location: "",
    description: "",
    status: "SCHEDULED",
    priority: 0,
    propertyId: null,
    propertyLabel: "",
    contactId: null,
    contactLabel: "",
    opportunityId: null,
    assigneeUser: null,
    remindOffset: null,
  };
}

type FieldName = "location" | "property" | "contact" | "opportunity" | "assignee" | "description";

/**
 * Which fields a behavior leads with.
 *
 * The rule that makes this safe: a field is visible when the matrix says so
 * **or when it already holds a value**. Changing the type of an event must
 * never hide something the broker typed — that is how data disappears without
 * an error. Everything else lives in one "Más opciones" block, always
 * reachable, never in the way.
 */
const PRIMARY_FIELDS: Record<EventBehavior, FieldName[]> = {
  visit: ["location", "property", "contact"],
  meeting: ["location", "contact", "opportunity"],
  call: ["contact", "opportunity"],
  deadline: ["opportunity", "property"],
  other: ["location"],
};

interface EventFormProps {
  value: EventFormState;
  onChange: (next: EventFormState) => void;
  /** Edit mode exposes the status; a brand-new event is always Programado. */
  showStatus?: boolean;
}

export function EventForm({ value, onChange, showStatus = false }: EventFormProps) {
  const set = <K extends keyof EventFormState>(key: K, next: EventFormState[K]) =>
    onChange({ ...value, [key]: next });

  const { types, resolve } = useEventTypes();
  const behavior = resolve(value.kind).behavior;
  const { data: members } = useTenantMembers();
  const [moreOpen, setMoreOpen] = useState(false);

  const [propertyQuery, setPropertyQuery] = useState(value.propertyLabel);
  const [contactQuery, setContactQuery] = useState(value.contactLabel);
  const { data: properties, isFetching: loadingProperties } = useProperties(propertyQuery);
  const { data: contacts, isFetching: loadingContacts } = useContacts(contactQuery);
  const { data: deals } = useOpportunities();
  // Labels for the deal picker. Both lists are already in cache for this page.
  const { data: allContacts } = useContacts();
  const { data: allProperties } = useProperties();
  const contactName = (id: string | null) =>
    id ? shortName((allContacts ?? []).find((c) => c.id === id)?.full_name) : "";
  const propertyName = (id: string | null) =>
    id ? shortPropertyTitle((allProperties ?? []).find((p) => p.id === id)?.title) : "";

  const visible = useMemo(() => {
    const primary = new Set(PRIMARY_FIELDS[behavior]);
    // Never hide a field that already carries a value.
    if (value.location) primary.add("location");
    if (value.propertyId) primary.add("property");
    if (value.contactId) primary.add("contact");
    if (value.opportunityId) primary.add("opportunity");
    if (value.description) primary.add("description");
    if (value.assigneeUser) primary.add("assignee");
    return primary;
  }, [behavior, value]);

  const typeOptions = types.map((t) => ({
    value: t.key,
    label: t.label,
    icon: (
      <span
        aria-hidden
        className="size-2.5 rounded-full"
        style={{ background: categoryVars(t.color).ink }}
      />
    ),
  }));

  const memberOptions = (members ?? []).map((m) => ({
    value: m.id,
    label: shortName(m.full_name, "Sin nombre"),
    sub: label("role", m.role),
  }));

  // A deal has no title of its own — it is "this person, about this property" —
  // so the picker builds the same label the board does.
  const dealOptions = (deals ?? []).slice(0, 100).map((d) => ({
    value: d.id,
    label:
      [contactName(d.person_id), propertyName(d.property_id)].filter(Boolean).join(" · ") ||
      "Negocio sin nombre",
    sub: STAGE_LABELS[d.pipeline_stage as keyof typeof STAGE_LABELS] ?? d.pipeline_stage,
  }));

  const locationField = (
    <LocationField
      value={value.location}
      onChange={(address) => set("location", address)}
      propertyId={value.propertyId}
      onPickProperty={(id) => {
        if (!id) return set("propertyId", null);
        const hit = (properties ?? []).find((p) => p.id === id);
        onChange({
          ...value,
          propertyId: id,
          propertyLabel: hit ? shortPropertyTitle(hit.title) : value.propertyLabel,
        });
      }}
    />
  );

  const propertyField = (
    <EntityCombobox
      value={propertyQuery}
      onChange={setPropertyQuery}
      onSelect={(p) => {
        if (!p) return onChange({ ...value, propertyId: null, propertyLabel: "" });
        onChange({ ...value, propertyId: p.id, propertyLabel: shortPropertyTitle(p.title) });
        setPropertyQuery(shortPropertyTitle(p.title));
      }}
      items={properties ?? []}
      getLabel={(p) => shortPropertyTitle(p.title)}
      getKey={(p) => p.id}
      loading={loadingProperties}
      placeholder="Buscar propiedad…"
      ariaLabel="Propiedad"
    />
  );

  const contactField = (
    <EntityCombobox
      value={contactQuery}
      onChange={setContactQuery}
      onSelect={(c) => {
        if (!c) return onChange({ ...value, contactId: null, contactLabel: "" });
        onChange({ ...value, contactId: c.id, contactLabel: shortName(c.full_name) });
        setContactQuery(shortName(c.full_name));
      }}
      items={contacts ?? []}
      getLabel={(c) => shortName(c.full_name)}
      getKey={(c) => c.id}
      loading={loadingContacts}
      placeholder="Buscar persona…"
      ariaLabel="Persona"
    />
  );

  const dealField = (
    <FilterSelect
      label="Negocio"
      value={value.opportunityId}
      options={dealOptions}
      onChange={(id) => set("opportunityId", id)}
      allLabel="Sin negocio"
    />
  );

  const assigneeField = (
    <FilterSelect
      label="Responsable"
      value={value.assigneeUser}
      options={memberOptions}
      onChange={(id) => set("assigneeUser", id)}
      allLabel="Sin responsable"
    />
  );

  const descriptionField = (
    <Textarea
      value={value.description}
      onChange={(e) => set("description", e.target.value)}
      placeholder="Notas del evento…"
      aria-label="Notas"
      rows={3}
    />
  );

  const FIELDS: Record<FieldName, React.ReactNode> = {
    location: locationField,
    property: propertyField,
    contact: contactField,
    opportunity: dealField,
    assignee: assigneeField,
    description: descriptionField,
  };

  const order: FieldName[] = [
    "location",
    "property",
    "contact",
    "opportunity",
    "assignee",
    "description",
  ];
  const shown = order.filter((f) => visible.has(f));
  const hidden = order.filter((f) => !visible.has(f));

  return (
    <div className="space-y-3">
      {/* Placeholders, not labels above every field. A form of eight labelled
          rows is twice as tall as the same form without them, and on a phone
          height is the scarce axis. Each control still carries an aria-label. */}
      <Input
        value={value.title}
        onChange={(e) => set("title", e.target.value)}
        placeholder="¿Qué es?"
        aria-label="Título"
        className={cn(CONTROL_H, "text-[15px] font-semibold")}
      />

      <div className={cn("grid gap-2", showStatus ? "grid-cols-3" : "grid-cols-2")}>
        {/* A dropdown, not a chip scroller: the catalog is a tenant's to grow,
            and five chips already overflowed at 360px. */}
        <FilterSelect
          label="Tipo"
          value={value.kind}
          options={typeOptions}
          onChange={(k) => set("kind", k ?? "OTHER")}
        />
        <FilterSelect
          label="Prioridad"
          value={String(value.priority)}
          options={PRIORITY_OPTIONS}
          onChange={(p) => set("priority", Number(p ?? 0))}
        />
        {showStatus && (
          <FilterSelect
            label="Estado"
            value={value.status}
            options={STATUS_OPTIONS}
            onChange={(s) => set("status", s ?? "SCHEDULED")}
          />
        )}
      </div>

      <WhenField
        start={value.start}
        end={value.end}
        allDay={value.allDay}
        onChange={({ start, end, allDay }) => onChange({ ...value, start, end, allDay })}
      />

      {/* An offset, not a second date input. It is one control instead of a
          calendar, and — the part that was actually broken — moving the event
          moves the reminder with it, because the reminder is stored relative. */}
      <FilterSelect
        label="Recordatorio"
        value={value.remindOffset === null ? null : String(value.remindOffset)}
        options={REMINDER_OFFSETS.filter((o) => o.value !== null).map((o) => ({
          value: String(o.value),
          label: o.label,
        }))}
        onChange={(v) => set("remindOffset", v === null ? null : Number(v))}
        allLabel="Sin recordatorio"
      />

      {shown.map((field) => (
        <div key={field}>{FIELDS[field]}</div>
      ))}

      {hidden.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-1 py-2 text-[13px] font-semibold text-muted-foreground transition hover:text-foreground",
              FOCUS_RING,
            )}
          >
            Más opciones
            <ChevronDown
              aria-hidden
              className={cn("size-4 transition-transform", moreOpen && "rotate-180")}
              strokeWidth={2}
            />
          </button>
          {moreOpen && (
            <div className="space-y-2 pt-1">
              {hidden.map((field) => (
                <div key={field}>{FIELDS[field]}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
