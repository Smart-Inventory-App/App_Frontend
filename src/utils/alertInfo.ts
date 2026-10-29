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

// Fecha de vencimiento como "5 de marzo"
export function getExpiryDate(expiryDate?: string): string {
  const [year, month, day] = (expiryDate ?? '').slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
}

const daysText = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;
const unitsText = (n: number) => `${n} ${n === 1 ? 'unidad' : 'unidades'}`;
// Cuánto alcanza el stock, dicho como una persona: nunca «0 días»
const coverageText = (days: number) => (days <= 0 ? 'menos de 1 día' : daysText(days));
// «Queda 1 ud.» / «Quedan 3 ud.»
const left = (n: number) => `${n === 1 ? 'Queda' : 'Quedan'} ${n} ud.`;
const scopeText = (alert: Alert) => (alert.rule_scope === 'product' ? 'la regla de este producto' : 'tu regla general');

// Descripción que acompaña a la alerta en la lista: entra en dos renglones y dice qué pasa con números concretos
export function getAlertDescription(alert: Alert): string {
  switch (alert.type) {
    case 'expiry': {
      const days = daysUntil(alert.product_expiry);
      const when = getExpiryDate(alert.product_expiry);
      const stock = left(alert.product_stock ?? 0);
      if (days < 0) return `Venció el ${when}. ${stock} que ya no conviene consumir.`;
      const limit = alert.limit_days != null ? ` y tu aviso es con menos de ${daysText(alert.limit_days)}` : ' en stock';
      return `Vence el ${when}. ${stock}${limit}.`;
    }
    case 'stock_low_coverage': {
      const days = coverageText(alert.days_until_stockout ?? 0);
      const minimum = alert.limit_days != null ? ` Mínimo configurado de ${daysText(alert.limit_days)}.` : '';
      const single = alert.product_stock === 1;
      return `${left(alert.product_stock ?? 0)} ${single ? 'restante que alcanza' : 'restantes que alcanzan'} para ${days}.${minimum}`;
    }
    case 'slow_pace': {
      const units = alert.units_wasted ?? 0;
      const verb = units === 1 ? 'se vencerá' : 'se vencerán';
      return `Al ritmo actual, ${unitsText(units)} ${verb} ${whenText(daysUntil(alert.product_expiry))}.`;
    }
    default:
      return '';
  }
}

const PREDICTION_NOTE = 'Calculado por el modelo predictivo con tu historial de consumo.';

// Explicación completa para el detalle de la alerta: un párrafo por idea
export function getAlertDetails(alert: Alert): string[] {
  const critical = alert.level === 'critical';
  switch (alert.type) {
    case 'expiry': {
      const days = daysUntil(alert.product_expiry);
      const when = getExpiryDate(alert.product_expiry);
      const paragraphs: string[] = [];
      if (days < 0) paragraphs.push(`Venció el ${when} (${days === -1 ? 'ayer' : `hace ${daysText(-days)}`}).`);
      else if (days === 0) paragraphs.push(`Vence hoy, ${when}.`);
      else if (days === 1) paragraphs.push(`Vence mañana, ${when}.`);
      else paragraphs.push(`Vence el ${when}, en ${daysText(days)}.`);
      paragraphs.push(`${(alert.product_stock ?? 0) === 1 ? 'Queda' : 'Quedan'} ${unitsText(alert.product_stock ?? 0)} en stock.`);
      // A un producto que ya venció no le sirve "te avisamos cuando falten menos de..."
      if (alert.limit_days != null && days >= 0) {
        paragraphs.push(`Te avisamos cuando faltan menos de ${daysText(alert.limit_days)} para el vencimiento (${scopeText(alert)}).`);
      }
      paragraphs.push(critical
        ? (days < 0 ? 'Ya no conviene consumirlo.' : 'Ya está dentro de ese período: conviene usarlo primero.')
        : 'Todavía no llegó a ese período, pero se acerca.');
      return paragraphs;
    }
    case 'stock_low_coverage': {
      const stock = alert.product_stock ?? 0;
      const subject = stock === 1 ? 'la unidad que queda alcanza' : `las ${unitsText(stock)} que quedan alcanzan`;
      const paragraphs = [`Con tu consumo, ${subject} para ${coverageText(alert.days_until_stockout ?? 0)}.`];
      if (alert.limit_days != null) {
        paragraphs.push(`Tu mínimo es de ${daysText(alert.limit_days)} (${scopeText(alert)}): ${critical ? 'estás por debajo de él.' : 'te estás acercando.'}`);
      }
      if (alert.suggested_qty) paragraphs.push(`Para volver a esa cobertura se sugiere reponer ${unitsText(alert.suggested_qty)}.`);
      paragraphs.push(PREDICTION_NOTE);
      return paragraphs;
    }
    case 'slow_pace': {
      const units = alert.units_wasted ?? 0;
      const paragraphs = [
        getAlertDescription(alert),
        `Estás consumiendo este producto más lento de lo que tarda en vencer, y ${units === 1 ? 'esa unidad quedaría' : 'esas unidades quedarían'} sin usar.`,
      ];
      if (critical) paragraphs.push('Su vencimiento ya está dentro de tu período de aviso.');
      paragraphs.push(PREDICTION_NOTE);
      return paragraphs;
    }
    default:
      return [];
  }
}
