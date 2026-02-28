self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function buildNotificationData(data) {
  if (!data || typeof data !== "object") {
    return {
      title: "AHA",
      body: "Bạn có cập nhật mới.",
      url: "/",
    };
  }

  return {
    title: data.title || "AHA",
    body: data.body || "Bạn có cập nhật mới.",
    url: data.url || "/",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-192.png",
  };
}

self.addEventListener("push", (event) => {
  const data = (() => {
    try {
      return event.data ? event.data.json() : null;
    } catch (error) {
      return null;
    }
  })();

  const payload = buildNotificationData(data);

  const promise = self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    data: payload.url || "/",
    vibrate: [80, 30, 80],
  });

  event.waitUntil(promise);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const matched = clients.find((client) => client.url.includes(new URL(targetUrl, self.location.origin).pathname));
        if (matched) {
          return matched.focus();
        }
        return self.clients.openWindow(targetUrl);
      })
      .catch(() => self.clients.openWindow(targetUrl)),
  );
});
