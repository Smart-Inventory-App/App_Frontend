// Cuentas del visor de imágenes con zoom (se separan del componente para poder probarlas).

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
// Por debajo de este zoom se considera que la imagen está "sin zoom" y se vuelve al centro
const RESET_THRESHOLD = 1.02;

export interface TouchPoint {
  pageX: number;
  pageY: number;
}

export function distanceBetween(a: TouchPoint, b: TouchPoint): number {
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** Cuánto se puede mover la imagen hacia cada lado sin que se vea el borde de la pantalla. */
export function maxTranslation(size: number, scale: number): number {
  return Math.max(0, ((scale - 1) * size) / 2);
}

export function clampTranslation(value: number, size: number, scale: number): number {
  const max = maxTranslation(size, scale);
  return Math.min(max, Math.max(-max, value));
}

/** El punto medio entre dos dedos. */
export function midpoint(a: TouchPoint, b: TouchPoint): TouchPoint {
  return { pageX: (a.pageX + b.pageX) / 2, pageY: (a.pageY + b.pageY) / 2 };
}

/**
 * Dónde queda la imagen al pellizcar: el punto de la imagen que estaba entre los dedos al empezar sigue entre los dedos
 * mientras se separan o se juntan (el zoom se hace "desde los dedos") y, si los dedos se mueven juntos, la imagen los
 * acompaña (se arrastra con dos dedos). `center` es el centro de la pantalla; `base` y `baseScale`, cómo estaba la
 * imagen al empezar.
 */
export function pinchTranslation(
  base: { x: number; y: number },
  baseScale: number,
  nextScale: number,
  startMid: TouchPoint,
  currentMid: TouchPoint,
  center: TouchPoint,
): { x: number; y: number } {
  const ratio = baseScale > 0 ? nextScale / baseScale : 1;
  return {
    x: currentMid.pageX - center.pageX - (startMid.pageX - center.pageX - base.x) * ratio,
    y: currentMid.pageY - center.pageY - (startMid.pageY - center.pageY - base.y) * ratio,
  };
}

export function isResetScale(scale: number): boolean {
  return scale <= RESET_THRESHOLD;
}
