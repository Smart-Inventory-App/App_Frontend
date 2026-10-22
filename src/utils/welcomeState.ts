// El inicio saluda con "Bienvenido" cuando el usuario inicia sesión o vuelve a abrir la app, y con "Tu estado" si
// cambia de pantalla y regresa. Vive en memoria: al cerrar la app o la sesión, vuelve a empezar.
let welcomePending = true;

export function shouldWelcome(): boolean {
  return welcomePending;
}

export function markWelcomeSeen(): void {
  welcomePending = false;
}

export function resetWelcome(): void {
  welcomePending = true;
}
