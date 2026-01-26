/* Install new service worker immediately */
self.addEventListener("install", () => {
  self.skipWaiting();
});

/* Take control of all open tabs */
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* PUSH NOTIFICATIONS (your logic – preserved) */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/jjuclub.png",
      badge: "/jjuclub.png",
      vibrate: [100, 50, 100],
    })
  );
});
