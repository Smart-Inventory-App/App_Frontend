import { Platform } from 'react-native';

export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// El botón de Google existe solo en el celular y solo si hay ID de cliente Web. La librería usa código nativo: en la
// web no funciona (y en Expo Go tampoco). El ID del cliente Android no hace falta acá: Google lo reconoce solo por el
// paquete y la clave de firma de la app.
export const GOOGLE_ENABLED = Platform.OS !== 'web' && !!GOOGLE_WEB_CLIENT_ID;

// La librería se carga recién cuando hace falta, así no se toca el código nativo donde no se usa
function library(): typeof import('@react-native-google-signin/google-signin') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-google-signin/google-signin');
}

let configured = false;

/** Le dice a la librería qué cliente Web usar para pedir el idToken. No hace nada si Google no está habilitado. */
export function configureGoogleSignIn(): void {
  if (!GOOGLE_ENABLED || configured) return;
  library().GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID! });
  configured = true;
}

/**
 * Cierra la sesión de Google en el teléfono. Sin esto, la próxima vez que se toca el botón la librería puede entrar
 * sola con la misma cuenta, sin dejar elegir otra. Si falla no pasa nada: la sesión de la app ya se cerró.
 */
export async function signOutFromGoogle(): Promise<void> {
  if (!GOOGLE_ENABLED) return;
  try {
    await library().GoogleSignin.signOut();
  } catch {
    // nada que hacer
  }
}
