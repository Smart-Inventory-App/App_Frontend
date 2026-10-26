/**
 * El número con puntos cada tres cifras, como se escribe en Argentina: 35267 -> "35.267", 4564322 -> "4.564.322".
 * No usa `Intl` a propósito: así se ve igual en todos los teléfonos, sin depender de su configuración regional.
 */
export function formatThousands(value: number): string {
  const whole = Math.trunc(Math.abs(value));
  const digits = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return value < 0 && whole !== 0 ? `-${digits}` : digits;
}
