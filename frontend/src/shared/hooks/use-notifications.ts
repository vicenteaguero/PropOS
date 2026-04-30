// TODO: producción — refactor cuando se conecte a feature real (revisar VAPID flow, error handling, retry, suscripción dedup).
import { useState, useCallback, useEffect } from "react";

type PermissionState = NotificationPermission | "unsupported";

interface UseNotificationsReturn {
  permission: PermissionState;
  requestPermission: () => Promise<void>;
  sendTestNotification: () => void;
}

export function useNotifications(): UseNotificationsReturn {
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  });

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setPermission(Notification.permission);
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  const sendTestNotification = useCallback(() => {
    if (permission !== "granted") return;

    new Notification("PropOS", {
      body: "Test notification from PWA Test Lab",
      icon: "/pwa-192x192.png",
    });
  }, [permission]);

  return { permission, requestPermission, sendTestNotification };
}
