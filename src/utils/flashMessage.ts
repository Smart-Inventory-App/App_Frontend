// Mensaje de un solo uso que una pantalla deja para que la siguiente lo muestre
// (p. ej. "cuenta creada" al pasar de registro a login). Vive en memoria.
const FLASH_TTL_MS = 10000;

let pending: { key: string; at: number } | null = null;

export function setFlashMessage(key: string): void {
  pending = { key, at: Date.now() };
}

export function peekFlashMessage(): string | null {
  if (!pending) return null;
  if (Date.now() - pending.at > FLASH_TTL_MS) {
    pending = null;
    return null;
  }
  return pending.key;
}

export function clearFlashMessage(): void {
  pending = null;
}
