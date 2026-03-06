/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data: { title?: string; body?: string; icon?: string };
  try {
    data = event.data.json();
  } catch {
    data = { title: "PropOS", body: event.data.text() };
  }

  const title = data.title ?? "PropOS";
  const options: NotificationOptions = {
    body: data.body ?? "",
    icon: data.icon ?? "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        return clients[0]!.focus();
      }
      return self.clients.openWindow("/");
    }),
  );
});
