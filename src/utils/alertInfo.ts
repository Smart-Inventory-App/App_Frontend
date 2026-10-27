import { Alert } from '@/services/alertService';

const DAY_MS = 1000 * 60 * 60 * 24;

// Colores de cada nivel de alerta: fondo suave y texto oscuro (los mismos del resumen del Centro de Alertas)
export const ALERT_TONES = {
  critical: { background: '#e5484d8f', text: '#671a1c' },
  warning: { background: '#fbbc059d', text: '#564209' },
  info: { background: '#2db7a352', text: '#14554b' },
} as const;

export const alertTone = (alert: Alert) => ALERT_TONES[alert.level] ?? ALERT_TONES.info;

export type AlertOrigin = 'rule' | 'system';

// Las que salen de una regla que el usuario configura (días de anticipación del vencimiento y stock mínimo, en su
// perfil o en cada producto); el resto las genera el sistema a partir de su consumo
const RULE_TYPES: Alert['type'][] = ['expiry', 'stock_low_coverage'];

// Las que calcula el modelo predictivo con el consumo del usuario: se destacan siempre
const PREDICTIVE_TYPES: Alert['type'][] = ['stock_low_coverage', 'slow_pace'];

export const alertOrigin = (alert: Alert): AlertOrigin => alert.origin ?? (RULE_TYPES.includes(alert.type) ? 'rule' : 'system');

export const isPredictive = (alert: Alert): boolean => PREDICTIVE_TYPES.includes(alert.type);

const LEVEL_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

/** Separa las alertas de las reglas del usuario de las del sistema, cada grupo con las más graves primero. */
export function splitByOrigin(alerts: Alert[]): { rule: Alert[]; system: Alert[] } {
  const bySeverity = (a: Alert, b: Alert) => (LEVEL_ORDER[a.level] ?? 3) - (LEVEL_ORDER[b.level] ?? 3);
  return {
    rule: alerts.filter(a => alertOrigin(a) === 'rule').sort(bySeverity),
    system: alerts.filter(a => alertOrigin(a) === 'system').sort(bySeverity),
  };
}

/** Días de calendario que faltan para una fecha (AAAA-MM-DD, con o sin hora); negativo si ya pasó. */
export function daysUntil(date?: string, now: Date = new Date()): number {
  const [year, month, day] = (date ?? '').slice(0, 10).split('-').map(Number);
  const target = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

/** «hoy», «mañana» o «en N días»: nunca «en 0 días». */
export function whenText(days: number): string {
  if (days <= 0) return 'hoy';
  if (days === 1) return 'mañana';
  return `en ${days} días`;
}

// Qué le pasa al producto, en pocas palabras: «Vence en 3 días», «Se agota mañana»...
export function getAlertType(alert: Alert): string {
  switch (alert.type) {
    case 'stock_low_coverage':
      return `Se agota ${whenText(alert.days_until_stockout ?? 0)}`;
    case 'expiry': {
      const days = daysUntil(alert.product_expiry);
      if (days < -1) return `Venció hace ${-days} días`;
      if (days === -1) return 'Venció ayer';
      if (days === 0) return 'Vence hoy';
      if (days === 1) return 'Vence mañana';
      return `Vence en ${days} días`;
    }
    case 'slow_pace':
      return 'Riesgo de vencimiento';
    default:
      return 'Información';
  }
}

// De qué regla sale la alerta: el límite que configuró el usuario y si es el de ese producto o el general
function ruleNote(alert: Alert, label: string): string[] {
  if (alert.limit_days == null) return [];
  const scope = alert.rule_scope === 'product' ? 'regla de este producto' : 'regla general';
  return [`${label}: ${alert.limit_days} ${alert.limit_days === 1 ? 'día' : 'días'} · ${scope}`];
}

// Fecha de vencimiento como "5 de marzo"
export function getExpiryDate(expiryDate?: string): string {
  const [year, month, day] = (expiryDate ?? '').slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

// Renglones con la información que acompaña a la alerta: el stock, la regla que se aplicó y, si corresponde, qué hacer
export function getAlertLines(alert: Alert): string[] {
  switch (alert.type) {
    case 'expiry':
      return [`Stock restante: ${alert.product_stock} ud.`, ...ruleNote(alert, 'Tu límite')];
    case 'stock_low_coverage': {
      const restock = alert.suggested_qty ? ` · Reponer ${alert.suggested_qty} ud.` : '';
      return [`Stock restante: ${alert.product_stock} ud.${restock}`, ...ruleNote(alert, 'Tu mínimo')];
    }
    case 'slow_pace': {
      const units = alert.units_wasted ?? 0;
      const verb = units === 1 ? 'unidad se vencerá' : 'unidades se vencerán';
      return [`Al ritmo actual, ${units} ${verb} ${whenText(daysUntil(alert.product_expiry))}`];
    }
    default:
      return [];
  }
}
