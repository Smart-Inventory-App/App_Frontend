import { Platform } from 'react-native';

// Canal por defecto de Android. Debe coincidir con "defaultChannel" del plugin
// expo-notifications en app.json, que es el canal que usan los push de FCM.
export const ANDROID_CHANNEL_ID = 'default';

/** Cómo está el permiso de notificaciones del sistema. */
export interface PermissionState {
  /** El usuario ya lo dio. */
  granted: boolean;
  /** Todavía se puede mostrar la solicitud del sistema (si el usuario eligió «no volver a preguntar», ya no). */
  canAskAgain: boolean;
}

/**
 * Resultado de pedir el permiso:
 * - `granted`: se puede mandar notificaciones;
 * - `denied`: el usuario no lo dio ahora, pero se le puede volver a preguntar;
 * - `blocked`: el sistema ya no muestra la solicitud (el usuario eligió que nunca se permita): solo se puede
 *   activar desde los Ajustes del teléfono.
 */
export type PermissionResult = 'granted' | 'denied' | 'blocked';

// expo-notifications se carga recién cuando hace falta (en la web no se usa)
function loadNotifications(): typeof import('expo-notifications') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications');
}

// En Android 13+ el diálogo de permiso de notificaciones no aparece hasta que existe un canal.
export async function ensureAndroidChannel(Notifications: typeof import('expo-notifications')): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Alertas',
    importance: Notifications.AndroidImportance.MAX,
  });
}

const fromExpo = (perms: any): PermissionState => ({
  granted: perms.granted ?? perms.status === 'granted',
  canAskAgain: perms.canAskAgain ?? true,
});

/** Mira el permiso sin pedirlo. Si no se puede saber, no molesta al usuario: lo da por concedido. */
export async function getNotificationPermission(): Promise<PermissionState> {
  try {
    if (Platform.OS === 'web') {
      const permission = (globalThis as any).Notification?.permission;
      if (!permission) return { granted: true, canAskAgain: true };
      return { granted: permission === 'granted', canAskAgain: permission === 'default' };
    }
    return fromExpo(await loadNotifications().getPermissionsAsync());
  } catch {
    return { granted: true, canAskAgain: true };
  }
}

/** Muestra la solicitud de permiso del sistema. */
export async function requestNotificationPermission(): Promise<PermissionState> {
  try {
    if (Platform.OS === 'web') {
      const permission = await (globalThis as any).Notification?.requestPermission?.();
      return { granted: permission === 'granted', canAskAgain: permission === 'default' };
    }
    const Notifications = loadNotifications();
    await ensureAndroidChannel(Notifications);
    return fromExpo(await Notifications.requestPermissionsAsync());
  } catch {
    return { granted: false, canAskAgain: true };
  }
}

/**
 * Se asegura de tener el permiso: si ya está, sigue; si no, y el sistema todavía deja preguntar, muestra la
 * solicitud; si el usuario eligió que nunca se permita, avisa que ya no se puede pedir (`blocked`).
 */
export async function ensureNotificationPermission(): Promise<PermissionResult> {
  const current = await getNotificationPermission();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'blocked';
  const asked = await requestNotificationPermission();
  if (asked.granted) return 'granted';
  return asked.canAskAgain ? 'denied' : 'blocked';
}
