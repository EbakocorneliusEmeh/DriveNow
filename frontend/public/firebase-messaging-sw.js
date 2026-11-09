/* Firebase's compat SDK exposes the messaging API inside service workers. */
importScripts("https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js");

(async () => {
  try {
    const configResponse = await fetch(new URL("/api/firebase-config", self.location.origin));
    if (!configResponse.ok) {
      throw new Error("Firebase web config is unavailable");
    }

    const firebaseConfig = await configResponse.json();
    firebase.initializeApp(firebaseConfig);

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
  } catch (error) {
    console.error("Firebase service worker setup failed:", error);
  }
})();
