/* Firebase's compat SDK exposes the messaging API inside service workers. */
importScripts("https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAymFMw-ZffxL3RKrXfM5ZggJQzO0YdqxA",
  authDomain: "drivenow-26fef.firebaseapp.com",
  projectId: "drivenow-26fef",
  storageBucket: "drivenow-26fef.firebasestorage.app",
  messagingSenderId: "783664126612",
  appId: "1:783664126612:web:9db6ace3c12ce172413281",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "DriveNow";
  const options = {
    body: payload.notification?.body || "You have a new notification.",
    data: { link: payload.data?.link || "/dashboard" },
    icon: "/favicon.ico",
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.link || "/dashboard", self.location.origin).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.navigate(target);
      return existing.focus();
    }
    return self.clients.openWindow(target);
  })());
});
