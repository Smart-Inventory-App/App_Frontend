// Import the functions you need from the SDKs you need
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");
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

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging(app);

messaging.onBackgroundMessage((payload) => {
  console.log("deberia mostrar algo")
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/firebase-logo.png"
  });
});

self.addEventListener("push", (event) => {
  console.log("Push genérico recibido:", event);
  const data = event.data?.json() || {};
  self.registration.showNotification(data.notification?.title || "Test", {
    body: data.notification?.body || "Mensaje de prueba",
    icon: "/firebase-logo.png"
  });
});
