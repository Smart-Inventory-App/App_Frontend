export type AlertTypeFilter = 'Todas' | 'Stock' | 'Vencimiento';

// Opción de tipo que el Centro de Alertas debe mostrar la próxima vez que se abra (desde el home). Se usa una sola vez:
// al volver a entrar por el menú se ven todas las alertas.
let requested: AlertTypeFilter | null = null;

export function requestAlertFilter(filter: AlertTypeFilter) {
  requested = filter;
}

export function takeRequestedAlertFilter(): AlertTypeFilter | null {
  const filter = requested;
  requested = null;
  return filter;
}
