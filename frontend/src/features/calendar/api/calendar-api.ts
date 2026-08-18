import { apiRequest } from "@features/documents/api/http";

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
}

/** Mirrors the backend `EventKind` enum (events/schemas.py). */
export type EventKind = "VISIT" | "MEETING" | "CALL" | "DEADLINE" | "OTHER";

export interface EventInput {
  title: string;
  kind?: EventKind;
  starts_at: string;
  ends_at?: string | null;
  location?: string | null;
  property_id?: string | null;
  contact_id?: string | null;
  remind_at?: string | null;
}

/** PATCH body. `EventUpdate` has no `remind_at`, so edits never touch reminders. */
export type EventPatch = Partial<Omit<EventInput, "remind_at">>;

/** Full row from `GET /v1/events/{id}` — the calendar feed omits location/description. */
export interface EventDetail {
  id: string;
  kind: EventKind;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  status: string;
  property_id: string | null;
  contact_id: string | null;
}

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const calendarApi = {
  feed: (from: string, to: string) =>
    apiRequest<CalendarItem[]>(`/v1/events/calendar${qs({ from, to })}`),
  getEvent: (id: string) => apiRequest<EventDetail>(`/v1/events/${id}`),
  createEvent: (body: EventInput) => apiRequest<unknown>("/v1/events", { method: "POST", body }),
  updateEvent: (id: string, body: EventPatch) =>
    apiRequest<EventDetail>(`/v1/events/${id}`, { method: "PATCH", body }),
  deleteEvent: (id: string) => apiRequest<void>(`/v1/events/${id}`, { method: "DELETE" }),
};
