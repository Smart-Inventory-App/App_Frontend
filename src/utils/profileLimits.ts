// Límites de los campos del perfil. Son los mismos que valida el backend (`ProfileUpdate`).
export const PROFILE_TEXT_MAX = 20;

export const ALERT_DAYS_MIN = 2;
export const ALERT_DAYS_MAX = 90;
export const DEFAULT_ALERT_DAYS = 7;

export const CHECK_HOUR_MIN = 0;
export const CHECK_HOUR_MAX = 23;
export const DEFAULT_CHECK_HOUR = 5;

/** El número si es entero y está en el rango (inclusive); si no, `null`. */
export function inRange(value: number | null | undefined, min: number, max: number): number | null {
  if (value === null || value === undefined || !Number.isInteger(value)) return null;
  return value >= min && value <= max ? value : null;
}

/** Los días de una alerta guardados; si no están entre 2 y 90, el 7. */
export const alertDaysOrDefault = (value: number | null | undefined): number =>
  inRange(value, ALERT_DAYS_MIN, ALERT_DAYS_MAX) ?? DEFAULT_ALERT_DAYS;

/** La hora del chequeo guardada; si no está entre 0 y 23, la 5. */
export const checkHourOrDefault = (value: number | null | undefined): number =>
  inRange(value, CHECK_HOUR_MIN, CHECK_HOUR_MAX) ?? DEFAULT_CHECK_HOUR;

/** El texto escrito como número entero, o `null` si está vacío o no es un número. */
export function parseWholeNumber(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  return parseInt(text, 10);
}

/** El número después de apretar subir o bajar: sin pasarse de los extremos. */
export function stepValue(text: string, direction: 1 | -1, min: number, max: number): number {
  const current = parseWholeNumber(text);
  if (current === null) return direction === 1 ? min : max;
  return Math.min(max, Math.max(min, current + direction));
}

/** La hora con dos dígitos y los minutos en cero: 5 -> "05:00". */
export const formatHour = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;
