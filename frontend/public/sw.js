/* Install new service worker immediately */
self.addEventListener("install", () => {
  self.skipWaiting();
});

/* Take control of all open tabs */
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* PUSH NOTIFICATIONS */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/jjuclub.png",          // PWA icon
      badge: "/jjuclub.png",         // small badge icon
      vibrate: [100, 50, 100],       // vibration pattern
      data: data.data || {},         // optional payload for click handling
      tag: data.data?.issueId || "book-reminder",
      renotify: true,
    })
  );
});

/* OPTIONAL: handle clicks (navigate to a URL) */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.openWindow(url)
  );
});
