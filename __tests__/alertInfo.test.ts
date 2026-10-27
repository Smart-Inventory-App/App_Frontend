import { Alert } from '../src/services/alertService';
import {
  alertOrigin, daysUntil, getAlertLines, getAlertType, getExpiryDate, isPredictive, splitByOrigin, whenText,
} from '../src/utils/alertInfo';

const alert = (id: number, overrides: Partial<Alert> = {}): Alert => ({
  id, userId: 'u1', productId: 1, type: 'info', level: 'info', product_name: `P${id}`, ...overrides,
});

// Fecha de calendario (AAAA-MM-DD) a tantos días de hoy, en la zona del dispositivo
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('alertOrigin', () => {
  it('trusts the origin the backend sends', () => {
    expect(alertOrigin(alert(1, { type: 'slow_pace', origin: 'rule' }))).toBe('rule');
    expect(alertOrigin(alert(2, { type: 'expiry', origin: 'system' }))).toBe('system');
  });

  it('without an origin, the expiry and stock-minimum alerts come from the rules of the user and the rest from the system', () => {
    expect(alertOrigin(alert(1, { type: 'expiry' }))).toBe('rule');
    expect(alertOrigin(alert(2, { type: 'stock_low_coverage' }))).toBe('rule');
    expect(alertOrigin(alert(3, { type: 'slow_pace' }))).toBe('system');
    expect(alertOrigin(alert(5, { type: 'info' }))).toBe('system');
  });
});

describe('isPredictive', () => {
  it('marks the alerts the predictive model calculates', () => {
    expect(isPredictive(alert(1, { type: 'stock_low_coverage' }))).toBe(true);
    expect(isPredictive(alert(2, { type: 'slow_pace' }))).toBe(true);
    expect(isPredictive(alert(3, { type: 'expiry' }))).toBe(false);
    expect(isPredictive(alert(4, { type: 'info' }))).toBe(false);
  });
});

describe('splitByOrigin', () => {
  it('separates the alerts of the rules from the ones of the system, the most serious first in each group', () => {
    const list = [
      alert(1, { type: 'slow_pace', level: 'warning' }),
      alert(2, { type: 'expiry', level: 'warning' }),
      alert(3, { type: 'slow_pace', level: 'critical' }),
      alert(4, { type: 'stock_low_coverage', level: 'critical' }),
      alert(5, { type: 'expiry', level: 'info' }),
    ];
    const { rule, system } = splitByOrigin(list);
    expect(rule.map(a => a.id)).toEqual([4, 2, 5]);
    expect(system.map(a => a.id)).toEqual([3, 1]);
  });

  it('puts an unknown level last and does not touch the original list', () => {
    const list = [alert(1, { type: 'expiry', level: 'raro' as any }), alert(2, { type: 'expiry', level: 'critical' })];
    expect(splitByOrigin(list).rule.map(a => a.id)).toEqual([2, 1]);
    expect(list.map(a => a.id)).toEqual([1, 2]);
  });

  it('gives two empty groups when there are no alerts', () => {
    expect(splitByOrigin([])).toEqual({ rule: [], system: [] });
  });
});

describe('daysUntil and whenText', () => {
  it('counts calendar days from today, with or without a time, negative when it already passed', () => {
    expect(daysUntil(inDays(0))).toBe(0);
    expect(daysUntil(inDays(1))).toBe(1);
    expect(daysUntil(`${inDays(5)}T00:00:00Z`)).toBe(5);
    expect(daysUntil(inDays(-3))).toBe(-3);
    expect(daysUntil('2026-03-10', new Date(2026, 2, 1, 23, 59))).toBe(9);
  });

  it('never says "en 0 días"', () => {
    expect(whenText(0)).toBe('hoy');
    expect(whenText(-2)).toBe('hoy');
    expect(whenText(1)).toBe('mañana');
    expect(whenText(4)).toBe('en 4 días');
  });
});

describe('getAlertType', () => {
  it('says how close the expiry is, with every case of the calendar', () => {
    const expiry = (days: number) => alert(1, { type: 'expiry', product_expiry: inDays(days) });
    expect(getAlertType(expiry(5))).toBe('Vence en 5 días');
    expect(getAlertType(expiry(1))).toBe('Vence mañana');
    expect(getAlertType(expiry(0))).toBe('Vence hoy');
    expect(getAlertType(expiry(-1))).toBe('Venció ayer');
    expect(getAlertType(expiry(-4))).toBe('Venció hace 4 días');
  });

  it('says when the stock runs out, never in zero days', () => {
    const stock = (days: number) => alert(1, { type: 'stock_low_coverage', days_until_stockout: days });
    expect(getAlertType(stock(4))).toBe('Se agota en 4 días');
    expect(getAlertType(stock(1))).toBe('Se agota mañana');
    expect(getAlertType(stock(0))).toBe('Se agota hoy');
    expect(getAlertType(alert(1, { type: 'stock_low_coverage' }))).toBe('Se agota hoy');
  });

  it('titles the slow pace and any other alert', () => {
    expect(getAlertType(alert(1, { type: 'slow_pace' }))).toBe('Riesgo de vencimiento');
    expect(getAlertType(alert(1, { type: 'info' }))).toBe('Información');
  });
});

describe('getAlertLines', () => {
  it('an expiry gives the stock and the rule that was applied', () => {
    const lines = getAlertLines(alert(1, { type: 'expiry', product_stock: 3, limit_days: 7, rule_scope: 'general' }));
    expect(lines).toEqual(['Stock restante: 3 ud.', 'Tu límite: 7 días · regla general']);
  });

  it('says when the rule is the one of the product, and uses the singular', () => {
    const lines = getAlertLines(alert(1, { type: 'expiry', product_stock: 1, limit_days: 1, rule_scope: 'product' }));
    expect(lines).toEqual(['Stock restante: 1 ud.', 'Tu límite: 1 día · regla de este producto']);
  });

  it('a low stock gives the stock, how many to restock and the minimum that was applied', () => {
    const lines = getAlertLines(alert(1, {
      type: 'stock_low_coverage', product_stock: 2, suggested_qty: 12, limit_days: 7, rule_scope: 'general', days_until_stockout: 3,
    }));
    expect(lines).toEqual(['Stock restante: 2 ud. · Reponer 12 ud.', 'Tu mínimo: 7 días · regla general']);
  });

  it('a low stock without a suggested quantity does not talk about restocking', () => {
    const lines = getAlertLines(alert(1, { type: 'stock_low_coverage', product_stock: 2, limit_days: 7 }));
    expect(lines).toEqual(['Stock restante: 2 ud.', 'Tu mínimo: 7 días · regla general']);
  });

  it('the slow pace is a single line that only talks about the pace', () => {
    const lines = getAlertLines(alert(1, { type: 'slow_pace', units_wasted: 4, product_expiry: inDays(10) }));
    expect(lines).toEqual(['Al ritmo actual, 4 unidades se vencerán en 10 días']);
    expect(getAlertLines(alert(1, { type: 'slow_pace', units_wasted: 1, product_expiry: inDays(1) })))
      .toEqual(['Al ritmo actual, 1 unidad se vencerá mañana']);
  });

  it('has no extra lines for an alert of type info', () => {
    expect(getAlertLines(alert(1, { type: 'info' }))).toEqual([]);
  });
});

describe('getExpiryDate', () => {
  it('writes the date as day and month', () => {
    expect(getExpiryDate('2027-03-05')).toMatch(/5 de marzo/);
  });
});
