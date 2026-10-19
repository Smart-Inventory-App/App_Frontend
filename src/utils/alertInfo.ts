import { Alert } from '@/services/alertService';

const DAY_MS = 1000 * 60 * 60 * 24;

// Colores de cada nivel de alerta: fondo suave y texto oscuro (los mismos del resumen del Centro de Alertas)
export const ALERT_TONES = {
  critical: { background: '#e5484d8f', text: '#671a1c' },
  warning: { background: '#fbbc059d', text: '#564209' },
  info: { background: '#2db7a352', text: '#14554b' },
} as const;

export const alertTone = (alert: Alert) => ALERT_TONES[alert.level] ?? ALERT_TONES.info;

// Título corto del motivo: "Stock crítico", "Vence en 3 días", "Vence mañana", "Vencido"...
export function getAlertType(alert: Alert): string {
  switch (alert.type) {
    case 'stock_low_coverage':
      return 'Stock crítico';
    case 'expiry': {
      const daysUntilExpiry = Math.ceil((new Date(alert.product_expiry!).getTime() - Date.now()) / DAY_MS);
      if (daysUntilExpiry > 1) return `Vence en ${daysUntilExpiry} días`;
      if (daysUntilExpiry === 1) return 'Vence mañana';
      return 'Vencido';
    }
    default:
      return 'Información';
  }
}

// Fecha de vencimiento como "5 de marzo"
export function getExpiryDate(expiryDate?: string): string {
  return new Date(expiryDate!).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

// Renglones con la información que acompaña al motivo de la alerta
export function getAlertLines(alert: Alert): string[] {
  switch (alert.type) {
    case 'expiry':
      return [`Stock Restante: ${alert.product_stock} ud.`, `Fecha Límite: ${getExpiryDate(alert.product_expiry)}`];
    case 'stock_low_coverage':
      return [`Stock Restante: ${alert.product_stock} ud.`, `El stock actual alcanza para ${alert.days_until_stockout} días`];
    case 'slow_pace': {
      const days = Math.ceil((new Date(alert.product_expiry!).getTime() - Date.now()) / DAY_MS);
      return [
        `Stock en conflicto: ${alert.units_wasted} ud.`,
        `Al ritmo actual, ${alert.units_wasted} unidades se vencerán en ${days} días`,
      ];
    }
    default:
      return [];
  }
}
