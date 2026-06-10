import { useCallback, useEffect, useState } from "react";

import { ENV } from "@core/config/env";
import { apiRequest } from "@features/documents/api/http";

type PermissionState = NotificationPermission | "unsupported";

interface UsePushSubscriptionReturn {
  /** Browser Notification permission (or "unsupported"). */
  permission: PermissionState;
  /** Whether this device currently has an active push subscription. */
  subscribed: boolean;
  /** Push is usable here (SW + PushManager + a configured VAPID key). */
  supported: boolean;
  busy: boolean;
  error: string | null;
  /** Request permission (if needed) and register a web-push subscription. */
  enable: () => Promise<void>;
  /** Remove the subscription locally and on the server. */
  disable: () => Promise<void>;
  /** Fire a server-side test push to the current user. */
  sendTest: () => Promise<void>;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function keyToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function usePushSubscription(): UsePushSubscriptionReturn {
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    Boolean(ENV.VAPID_PUBLIC_KEY);

  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  });
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setSubscribed(Boolean(sub));
      })
      .catch(() => {
        /* ignore — treat as not subscribed */
      });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    setError(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        throw new Error("Permiso de notificaciones denegado");
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(ENV.VAPID_PUBLIC_KEY),
        }));

      await apiRequest("/v1/notifications/subscribe", {
        method: "POST",
        body: {
          endpoint: sub.endpoint,
          p256dh: keyToBase64(sub.getKey("p256dh")),
          auth_key: keyToBase64(sub.getKey("auth")),
        },
      });
      setSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar");
      throw err;
    } finally {
      setBusy(false);
    }
  }, [supported]);

  const disable = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiRequest("/v1/notifications/subscribe", {
          method: "DELETE",
          body: { endpoint: sub.endpoint },
        }).catch(() => {
          /* best-effort: still unsubscribe locally */
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desactivar");
      throw err;
    } finally {
      setBusy(false);
    }
  }, [supported]);

  const sendTest = useCallback(async () => {
    await apiRequest("/v1/notifications/send", {
      method: "POST",
      body: { title: "PropOS", body: "Notificación de prueba", url: "/" },
    });
  }, []);

  return { permission, subscribed, supported, busy, error, enable, disable, sendTest };
}
