import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getMessaging, isSupported, onMessage, onRegistered, register } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp() {
  const missingValues = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missingValues.length > 0) {
    throw new Error("Firebase web configuration is incomplete. Check the frontend environment settings.");
  }
  return getApps()[0] ?? initializeApp(firebaseConfig as FirebaseOptions);
}

export async function registerForPushNotifications() {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("This browser does not support push notifications.");
  }

  if (!(await isSupported())) {
    throw new Error("This browser does not support Firebase push notifications.");
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) throw new Error("The Firebase web push key is missing from frontend configuration.");

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted. You can allow it in your browser settings.");
  }

  const messaging = getMessaging(getFirebaseApp());
  const serviceWorkerRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

  let stopListening = () => {};
  let timeoutId = 0;
  const installationIdPromise = new Promise<string>((resolve, reject) => {
    timeoutId = window.setTimeout(() => {
      stopListening();
      reject(new Error("Firebase did not finish registering this browser. Please try again."));
    }, 20_000);
    stopListening = onRegistered(messaging, (installationId) => {
      window.clearTimeout(timeoutId);
      stopListening();
      resolve(installationId);
    });
  });

  try {
    await register(messaging, { vapidKey, serviceWorkerRegistration });
    return await installationIdPromise;
  } catch (error) {
    window.clearTimeout(timeoutId);
    stopListening();
    throw error;
  }
}

export function listenForForegroundNotifications() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  onMessage(getMessaging(getFirebaseApp()), (payload) => {
    const { title, ...options } = payload.notification ?? {};
    if (!title) return;
    const notification = new Notification(title, options);
    notification.onclick = (event) => {
      event.preventDefault();
      window.open(payload.fcmOptions?.link, "_blank");
    };
  });
}