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

export interface EventInput {
  title: string;
  kind?: string;
  starts_at: string;
  ends_at?: string | null;
  location?: string | null;
  property_id?: string | null;
  contact_id?: string | null;
  remind_at?: string | null;
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
  createEvent: (body: EventInput) => apiRequest<unknown>("/v1/events", { method: "POST", body }),
};
