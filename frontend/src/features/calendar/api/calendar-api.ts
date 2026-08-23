import { apiRequest } from "@shared/api/http";
import { qs } from "@shared/lib/query-string";

export interface CalendarItem {
  tenant_id: string;
  item_type: "EVENT" | "TASK" | "PAYMENT";
  id: string;
  title: string | null;
  start_at: string | null;
  end_at: string | null;
  all_day: boolean | null;
  status: string | null;
  kind: string | null;
  property_id: string | null;
  contact_id: string | null;
  amount_cents: number | null;
  /**
   * Where it happens: the linked property's address, or the event's own free
   * text when there is no property. Added to the feed view so the home screen
   * can offer directions without a request per item — the reason the only
   * Waze/Maps links in the product used to live on a property page nobody opens
   * on their way out the door.
   */
  location?: string | null;
  /** The deal this belongs to, if any. Added in 20240601000077. */
  opportunity_id?: string | null;
  /**
   * 0 normal · 1 alta · 2 crítica. Carried since 20240601000083: before that
   * the event form could set a priority that nothing ever read, which is the
   * same as not having one.
   */
  priority?: number | null;
}

/**
 * An event's type, as a key.
 *
 * No longer a closed union: `events.kind` stopped being a Postgres enum in
 * migration 20240601000080, so a tenant can add "TASACION" from Configuración
 * without a deploy. The five system keys are still named because the seeder,
 * the agent and the notification templates reference them.
 */
export type EventKind = string;

export const SYSTEM_EVENT_KINDS = ["VISIT", "MEETING", "CALL", "DEADLINE", "OTHER"] as const;

/**
 * What a type does, as opposed to what it is called. The event form reads this
 * — never the key — so a tenant's "Tasación" declared as `visit` inherits the
 * whole visit layout instead of falling back to the blandest possible form.
 */
export type EventBehavior = "visit" | "meeting" | "call" | "deadline" | "other";

export interface EventType {
  id: string;
  tenant_id: string;
  key: string;
  label: string;
  /** A name from the fixed categorical palette, never a hex. */
  color: string;
  icon: string | null;
  behavior: EventBehavior;
  position: number;
  active: boolean;
  /** The five seeded types, which cannot be deleted. */
  is_system: boolean;
}

export interface EventTypeInput {
  key: string;
  label: string;
  color?: string;
  icon?: string | null;
  behavior?: EventBehavior;
  position?: number;
  active?: boolean;
}

export interface EventInput {
  title: string;
  kind?: EventKind;
  description?: string | null;
  starts_at: string;
  ends_at?: string | null;
  all_day?: boolean;
  status?: EventStatus;
  location?: string | null;
  property_id?: string | null;
  contact_id?: string | null;
  project_id?: string | null;
  opportunity_id?: string | null;
  assignee_user?: string | null;
  /** 0 normal · 1 alta · 2 crítica. */
  priority?: number;
  remind_at?: string | null;
}

export type EventStatus = "SCHEDULED" | "DONE" | "CANCELLED";

/**
 * PATCH body. `remind_at` is included: moving an event used to leave its
 * reminder ringing on the old day, because the update schema had no way to say
 * anything about reminders at all. `clear_reminder` removes it.
 */
export type EventPatch = Partial<EventInput> & { clear_reminder?: boolean };

/** Full row from `GET /v1/events/{id}` — the calendar feed omits location/description. */
export interface EventDetail {
  id: string;
  kind: EventKind;
  priority?: number;
  assignee_user?: string | null;
  project_id?: string | null;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  status: string;
  property_id: string | null;
  contact_id: string | null;
  opportunity_id?: string | null;
}

export const calendarApi = {
  types: () => apiRequest<EventType[]>("/v1/events/types"),
  allTypes: () => apiRequest<EventType[]>("/v1/settings/event-types"),
  createType: (body: EventTypeInput) =>
    apiRequest<EventType>("/v1/settings/event-types", { method: "POST", body }),
  updateType: (id: string, body: Partial<Omit<EventTypeInput, "key">>) =>
    apiRequest<EventType>(`/v1/settings/event-types/${id}`, { method: "PUT", body }),
  deleteType: (id: string) =>
    apiRequest<void>(`/v1/settings/event-types/${id}`, { method: "DELETE" }),
  feed: (from: string, to: string) =>
    apiRequest<CalendarItem[]>(`/v1/events/calendar${qs({ from, to })}`),
  getEvent: (id: string) => apiRequest<EventDetail>(`/v1/events/${id}`),
  createEvent: (body: EventInput) => apiRequest<unknown>("/v1/events", { method: "POST", body }),
  updateEvent: (id: string, body: EventPatch) =>
    apiRequest<EventDetail>(`/v1/events/${id}`, { method: "PATCH", body }),
  deleteEvent: (id: string) => apiRequest<void>(`/v1/events/${id}`, { method: "DELETE" }),
};
