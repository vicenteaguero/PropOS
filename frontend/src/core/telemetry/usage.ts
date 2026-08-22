import { supabase } from "@core/supabase/client";
import { getActiveTenantId } from "@shared/api/http";
import { createLogger } from "@core/logging/logger";
import { canonicalPath } from "@core/telemetry/canonical-path";

const logger = createLogger("Usage");

export type UsageKind = "page_view" | "action" | "session_ping";

interface UsageEvent {
  kind: UsageKind;
  key: string;
  meta: Record<string, unknown>;
  occurred_at: string;
}

/** Matches `UsageBatch.events` on the server. A fuller buffer flushes early. */
const MAX_BATCH = 100;
const FLUSH_INTERVAL_MS = 20_000;

let buffer: UsageEvent[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let listenersBound = false;

function enqueue(kind: UsageKind, key: string, meta: Record<string, unknown> = {}) {
  buffer.push({ kind, key, meta, occurred_at: new Date().toISOString() });
  if (buffer.length >= MAX_BATCH) void flush();
}

/** A screen was opened. Called by the router, not by pages. */
export function trackPageView(pathname: string, meta: Record<string, unknown> = {}) {
  enqueue("page_view", canonicalPath(pathname), meta);
}

/**
 * Something was done, as opposed to looked at.
 *
 * Named by hand at the handful of moments that answer "did they actually use
 * it": creating a property, accepting a Propo proposal, uploading a document.
 * Instrumenting every click would produce a stream nobody reads.
 */
export function trackAction(name: string, meta: Record<string, unknown> = {}) {
  enqueue("action", name, meta);
}

/** Emitted while the app is in the foreground, so idle minutes stay uncounted. */
export function trackPing() {
  enqueue("session_ping", "heartbeat");
}

/**
 * `keepalive` rather than `navigator.sendBeacon`.
 *
 * Beacon is the reflex for "send on unload", but it cannot set headers, so the
 * access token would have to ride in the query string -- into access logs, into
 * the Referer of anything the page loads next. `fetch(..., { keepalive: true })`
 * outlives the page the same way and keeps the Authorization header. Its 64 KB
 * cap is far above a 100-event batch.
 */
async function post(events: UsageEvent[]): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return false;

  const tenantId = getActiveTenantId();
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/v1/usage/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
    },
    body: JSON.stringify({ events }),
    keepalive: true,
  });
  return res.ok;
}

export async function flush(): Promise<void> {
  if (buffer.length === 0) return;
  // Taken before the await: an event enqueued mid-flight belongs to the NEXT
  // batch, not to one already on the wire.
  const batch = buffer.slice(0, MAX_BATCH);
  buffer = buffer.slice(batch.length);
  try {
    const ok = await post(batch);
    // Telemetry is not worth a retry storm, but losing a whole afternoon to one
    // dropped request is worse. One putback, and only when the buffer is small
    // enough that a persistent failure cannot grow it without bound.
    if (!ok && buffer.length < MAX_BATCH) buffer = [...batch, ...buffer];
  } catch (err) {
    logger.info("usage", "flush failed", { err: String(err) });
    if (buffer.length < MAX_BATCH) buffer = [...batch, ...buffer];
  }
}

/**
 * Starts the flush timer and the lifecycle hooks. Idempotent.
 *
 * `visibilitychange` matters more than `beforeunload` on a phone: an installed
 * PWA is usually backgrounded, never closed, so `beforeunload` may never fire
 * for days.
 */
export function startUsageTelemetry(): () => void {
  if (timer) return () => {};
  timer = setInterval(() => {
    if (document.visibilityState === "visible") trackPing();
    void flush();
  }, FLUSH_INTERVAL_MS);

  if (!listenersBound) {
    listenersBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void flush();
    });
    window.addEventListener("pagehide", () => void flush());
  }

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}

/** Drops anything unsent. Called on sign-out: the next user is not this one. */
export function resetUsageBuffer() {
  buffer = [];
}
