import { Platform } from "react-native";
import api from "./api";

// getFirebaseToken: web usa el SDK de Firebase, nativo usa expo-notifications
export async function getFirebaseToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return getWebFirebaseToken();
  }
  return getNativeDeviceToken();
}

// Registra el token en el backend (endpoint autenticado)
export async function registerTokenWithBackend(token: string): Promise<void> {
  try {
    await api.patch("/auth/firebase-token", { firebase_token: token });
  } catch {
    // No crítico — el usuario sigue logueado aunque falle
  }
}

// Solicita permisos y obtiene el token FCM nativo (Android) o APNs (iOS)
async function getNativeDeviceToken(): Promise<string | null> {
  try {
    const Notifications = await import("expo-notifications");

    const perms = (await Notifications.getPermissionsAsync()) as any;
    let granted: boolean = perms.granted ?? perms.status === "granted";

    if (!granted) {
      const result = (await Notifications.requestPermissionsAsync()) as any;
      granted = result.granted ?? result.status === "granted";
    }

    if (!granted) return null;

    // getDevicePushTokenAsync devuelve el FCM token en Android
    const tokenData = await Notifications.getDevicePushTokenAsync();
    return tokenData.data ?? null;
  } catch {
    return null;
  }
}

// Obtiene el token FCM vía SDK web de Firebase (solo en web)
async function getWebFirebaseToken(): Promise<string | null> {
  try {
    const { getFirebaseToken: webToken } = await import("./firebaseService");
    return webToken();
  } catch {
    return null;
  }
}

// Configura el handler de notificaciones en primer plano
export function setupForegroundHandler(): void {
  if (Platform.OS === "web") return;
  import("expo-notifications").then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  });
}

// Escucha rotaciones del token y las sincroniza con el backend
export function subscribeToTokenRefresh(): () => void {
  if (Platform.OS === "web") return () => {};
  let subscription: any;
  import("expo-notifications").then((Notifications) => {
    subscription = Notifications.addPushTokenListener(async (tokenData) => {
      if (tokenData.data) {
        await registerTokenWithBackend(tokenData.data);
      }
    });
  });
  return () => subscription?.remove?.();
}
