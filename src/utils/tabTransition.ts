import { Animated, Dimensions, Easing } from 'react-native';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';

type Transition = Pick<BottomTabNavigationOptions, 'transitionSpec' | 'sceneStyleInterpolator'>;

// Cuánto dura el deslizamiento entre dos pestañas
export const TAB_SLIDE_DURATION_MS = 280;

// Mientras está en true, el próximo cambio de pestaña es instantáneo (sin deslizamiento)
let skipNext = false;
let skipTimer: ReturnType<typeof setTimeout> | null = null;
// Margen para que el cambio se resuelva antes de volver a animar
const SKIP_WINDOW_MS = 600;

/**
 * Hace que el próximo cambio de pestaña no se deslice. Sirve para los botones que cambian de pestaña como parte de
 * otra acción (por ejemplo «Ver inventario» después de registrar un producto).
 */
export function skipNextTabAnimation(): void {
  skipNext = true;
  if (skipTimer) clearTimeout(skipTimer);
  skipTimer = setTimeout(() => {
    skipNext = false;
    skipTimer = null;
  }, SKIP_WINDOW_MS);
  (skipTimer as { unref?: () => void }).unref?.();
}

/** Las pestañas cuyo banner queda fijo al cambiar entre ellas (el de Inicio es distinto y se desliza con su pantalla). */
export const BANNER_TABS = ['inventario', 'cargar', 'alertas', 'perfil'] as const;

/** Si el banner de las dos pestañas se queda quieto en el cambio (solo cuando ninguna de las dos es Inicio). */
export function isFixedBannerChange(from: string, to: string): boolean {
  return (BANNER_TABS as readonly string[]).includes(from) && (BANNER_TABS as readonly string[]).includes(to);
}

// ── Banner fijo ──────────────────────────────────────────────────────────────────────────────────────────────
// El estado del banner fijo vive acá y no en el layout de las pestañas: si el layout cambiara de estado en medio de un
// deslizamiento, el navegador volvería a armar sus opciones y reiniciaría la animación (la pantalla que sale
// desaparecería de golpe). Así solo se vuelve a dibujar el banner.
type BannerListener = (tab: string | null) => void;
const bannerListeners = new Set<BannerListener>();
let lastTab = 'index';

const notifyBanner = (tab: string | null) => bannerListeners.forEach(listener => listener(tab));

/** Empieza un cambio de pestaña: avisa si el banner debe quedar fijo (y con el título de qué pestaña). */
export function startTabTransition(target: string): void {
  const previous = lastTab;
  lastTab = target;
  notifyBanner(isFixedBannerChange(previous, target) ? target : null);
}

/** Terminó el cambio de pestaña: el banner fijo se va y queda el de la pantalla. */
export function endTabTransition(): void {
  notifyBanner(null);
}

/** Para enterarse de cuándo el banner fijo debe mostrarse. Devuelve la función para dejar de escuchar. */
export function subscribeFixedBanner(listener: BannerListener): () => void {
  bannerListeners.add(listener);
  return () => {
    bannerListeners.delete(listener);
  };
}

/** Vuelve al estado inicial (se usa en los tests). */
export function resetTabTransition(): void {
  lastTab = 'index';
  bannerListeners.clear();
}

/**
 * Cambio de pestaña con deslizamiento. `progress` vale -1 para una pantalla que está a la izquierda de la que se ve
 * (su pestaña viene antes), 0 para la que se ve y 1 para una a la derecha. Entonces:
 * - al ir a una pestaña de más a la derecha, la pantalla nueva entra por la derecha y la actual sale hacia la izquierda;
 * - al ir a una de más a la izquierda (por ejemplo, tocar el ícono de inicio del banner), pasa al revés.
 * El ancho se lee al animar, así sigue funcionando si la pantalla gira o cambia de tamaño.
 */
export const slideTransition: Transition = {
  transitionSpec: {
    animation: 'timing',
    config: {
      // Se lee cada vez que empieza un cambio: 0 si se pidió saltear la animación
      get duration() {
        return skipNext ? 0 : TAB_SLIDE_DURATION_MS;
      },
      easing: Easing.inOut(Easing.ease),
    },
  },
  sceneStyleInterpolator: ({ current }) => {
    const width = Dimensions.get('window').width;
    return {
      sceneStyle: {
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [-width, 0, width],
            }) as Animated.AnimatedInterpolation<number>,
          },
        ],
      },
    };
  },
};
