// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage} from "firebase/messaging"
import { Platform } from "react-native";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD_WgEME_ZsYw3j77m6ubNGD86lLvn9yk0",
  authDomain: "smart-inventory-app-a378a.firebaseapp.com",
  projectId: "smart-inventory-app-a378a",
  storageBucket: "smart-inventory-app-a378a.firebasestorage.app",
  messagingSenderId: "61725210163",
  appId: "1:61725210163:web:e22fe542a732ce90859546"
};

const FIREBASE_VAPID_KEY = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app)
export async function getFirebaseToken() {
  const token = await getToken(messaging, { vapidKey: FIREBASE_VAPID_KEY })
  console.log("obteniendo token")
  return token
}

export async function initNotifications() {
  const permission = await Notification.requestPermission();
  console.log("funcionan las notis? ", permission)
  if (permission === "granted") {
    console.log("Permiso de notificación concedido");
  } else {
    console.warn("Permiso de notificación denegado");
  }

  if (Platform.OS === "web" && "serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/firebase-messaging-sw.js")
      .then((registration) => {
        console.log("Service Worker registrado:", registration);
    })
    .catch((err) => {
      console.error("Error al registrar Service Worker:", err);
    });
  }
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title || "Notificación";
    const body = payload.notification?.body || "";
    alert(`${title} - ${body}`);
  });

}