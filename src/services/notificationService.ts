import { Platform } from "react-native";
import authApi from "./authApi";

// Canal por defecto de Android. Debe coincidir con "defaultChannel" del plugin
// expo-notifications en app.json, que es el canal que usan los push de FCM.
const ANDROID_CHANNEL_ID = "default";

// En Android 13+ el diálogo de permiso de notificaciones no aparece hasta que existe un canal.
async function ensureAndroidChannel(Notifications: typeof import("expo-notifications")): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Alertas",
    importance: Notifications.AndroidImportance.MAX,
  });
}

// getFirebaseToken: web usa el SDK de Firebase, nativo usa expo-notifications
export async function getFirebaseToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return getWebFirebaseToken();
  }
  return getNativeDeviceToken();
}

// Registra el token en el servicio de auth (endpoint autenticado)
export async function registerTokenWithBackend(token: string): Promise<void> {
  try {
    await authApi.patch("/auth/firebase-token", { firebase_token: token });
  } catch {
    // No crítico — el usuario sigue logueado aunque falle
  }
}

// Solicita permisos y obtiene el token FCM nativo (Android) o APNs (iOS)
async function getNativeDeviceToken(): Promise<string | null> {
  try {
    const Notifications = await import("expo-notifications");

    await ensureAndroidChannel(Notifications);

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
  } catch (error) {
    // Sin google-services.json en el build, Android falla acá (FirebaseApp sin inicializar)
    console.warn("[push] No se pudo obtener el token FCM:", error);
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
    void ensureAndroidChannel(Notifications);
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
