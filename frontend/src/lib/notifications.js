export async function enableNotifications(token) {
  if (!("serviceWorker" in navigator)) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const reg = await navigator.serviceWorker.register("/sw.js");

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY
  });

  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`   // ✅ VERY IMPORTANT
    },
    body: JSON.stringify(sub)
  });
}
