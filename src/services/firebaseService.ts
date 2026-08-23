import { initializeApp } from "firebase/app";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyD_WgEME_ZsYw3j77m6ubNGD86lLvn9yk0",
  authDomain: "smart-inventory-app-a378a.firebaseapp.com",
  projectId: "smart-inventory-app-a378a",
  storageBucket: "smart-inventory-app-a378a.firebasestorage.app",
  messagingSenderId: "61725210163",
  appId: "1:61725210163:web:e22fe542a732ce90859546"
};

const FIREBASE_VAPID_KEY = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;

const app = initializeApp(firebaseConfig);

// firebase/messaging uses browser APIs — only usable on web
let _messaging: any = null;
if (Platform.OS === "web") {
  const { getMessaging } = require("firebase/messaging");
  _messaging = getMessaging(app);
}

export const messaging = _messaging;

export async function getFirebaseToken(): Promise<string | null> {
  if (Platform.OS !== "web" || !_messaging) return null;
  try {
    const { getToken } = require("firebase/messaging");
    const token = await getToken(_messaging, { vapidKey: FIREBASE_VAPID_KEY });
    return token;
  } catch {
    return null;
  }
}

export async function initNotifications(): Promise<void> {
  if (Platform.OS !== "web") return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(() => {});
    }
    const { onMessage } = require("firebase/messaging");
    onMessage(_messaging, (payload: any) => {
      const title = payload.notification?.title || "Notificación";
      const body = payload.notification?.body || "";
      alert(`${title} - ${body}`);
    });
  } catch {
    // notifications not available
  }
}
