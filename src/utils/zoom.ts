// Cuentas del visor de imágenes con zoom (se separan del componente para poder probarlas).

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
export const DOUBLE_TAP_SCALE = 2.5;
export const DOUBLE_TAP_MS = 300;
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

export function isDoubleTap(now: number, lastTap: number): boolean {
  return lastTap > 0 && now - lastTap <= DOUBLE_TAP_MS;
}

export function nextDoubleTapScale(current: number): number {
  return current > RESET_THRESHOLD ? MIN_SCALE : DOUBLE_TAP_SCALE;
}

export function isResetScale(scale: number): boolean {
  return scale <= RESET_THRESHOLD;
}
