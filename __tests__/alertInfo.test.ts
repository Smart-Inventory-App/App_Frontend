import { Alert } from '../src/services/alertService';
import {
  alertOrigin, daysUntil, getAlertDescription, getAlertDetails, getAlertType, getExpiryDate, isPredictive, splitByOrigin, whenText,
} from '../src/utils/alertInfo';

const alert = (id: number, overrides: Partial<Alert> = {}): Alert => ({
  id, user_id: 'u1', product_id: 1, type: 'info', level: 'info', product_name: `P${id}`, ...overrides,
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

describe('getAlertDescription', () => {
  it('an expiry says the date, the stock and the limit of the user', () => {
    const text = getAlertDescription(alert(1, { type: 'expiry', product_expiry: '2027-03-05', product_stock: 3, limit_days: 7, rule_scope: 'general' }));
    expect(text).toBe('Vence el 5 de marzo. Quedan 3 ud. y tu aviso es con menos de 7 días.');
  });

  it('an expiry without a limit only says the date and the stock, and an expired one says it no longer should be eaten', () => {
    expect(getAlertDescription(alert(1, { type: 'expiry', product_expiry: inDays(9), product_stock: 2 }))).toMatch(/^Vence el .+\. Quedan 2 ud\. en stock\.$/);
    expect(getAlertDescription(alert(1, { type: 'expiry', product_expiry: '2020-01-10', product_stock: 2 })))
      .toBe('Venció el 10 de enero. Quedan 2 ud. que ya no conviene consumirlo.'.replace('consumirlo', 'consumir'));
  });

  it('a low stock says what is left, how long it lasts and the minimum that was configured', () => {
    const text = getAlertDescription(alert(1, {
      type: 'stock_low_coverage', product_stock: 2, days_until_stockout: 3, suggested_qty: 12, limit_days: 7,
    }));
    expect(text).toBe('Quedan 2 ud. restantes que alcanzan para 3 días. Mínimo configurado de 7 días.');
  });

  it('a low stock without a limit stays short, uses the singular, and never says zero days', () => {
    expect(getAlertDescription(alert(1, { type: 'stock_low_coverage', product_stock: 2, days_until_stockout: 1 })))
      .toBe('Quedan 2 ud. restantes que alcanzan para 1 día.');
    expect(getAlertDescription(alert(1, { type: 'stock_low_coverage', product_stock: 1, days_until_stockout: 2 })))
      .toBe('Queda 1 ud. restante que alcanza para 2 días.');
    expect(getAlertDescription(alert(1, { type: 'stock_low_coverage', product_stock: 2, days_until_stockout: 0 })))
      .toBe('Quedan 2 ud. restantes que alcanzan para menos de 1 día.');
    expect(getAlertDescription(alert(1, { type: 'stock_low_coverage', product_stock: 4, days_until_stockout: 5, limit_days: 1 })))
      .toBe('Quedan 4 ud. restantes que alcanzan para 5 días. Mínimo configurado de 1 día.');
  });

  it('the slow pace is a sentence about the pace', () => {
    expect(getAlertDescription(alert(1, { type: 'slow_pace', units_wasted: 4, product_expiry: inDays(45) })))
      .toBe('Al ritmo actual, 4 unidades se vencerán en 45 días.');
    expect(getAlertDescription(alert(1, { type: 'slow_pace', units_wasted: 1, product_expiry: inDays(1) })))
      .toBe('Al ritmo actual, 1 unidad se vencerá mañana.');
  });

  it('has no description for an alert of type info', () => {
    expect(getAlertDescription(alert(1, { type: 'info' }))).toBe('');
  });
});

describe('getAlertDetails', () => {
  it('explains an expiry: the date, the stock, the rule that was applied and where it stands', () => {
    const lines = getAlertDetails(alert(1, {
      type: 'expiry', level: 'critical', product_expiry: inDays(3), product_stock: 1, limit_days: 7, rule_scope: 'product',
    }));
    expect(lines[0]).toMatch(/^Vence el .+, en 3 días\.$/);
    expect(lines).toContain('Queda 1 unidad en stock.');
    expect(lines).toContain('Te avisamos cuando faltan menos de 7 días para el vencimiento (la regla de este producto).');
    expect(lines).toContain('Ya está dentro de ese período: conviene usarlo primero.');
  });

  it('says it when the expiry is near the limit but still outside it', () => {
    const lines = getAlertDetails(alert(1, { type: 'expiry', level: 'warning', product_expiry: inDays(9), product_stock: 4, limit_days: 7, rule_scope: 'general' }));
    expect(lines).toContain('Te avisamos cuando faltan menos de 7 días para el vencimiento (tu regla general).');
    expect(lines).toContain('Todavía no llegó a ese período, pero se acerca.');
  });

  it.each([
    [1, /^Vence mañana, /],
    [0, /^Vence hoy, /],
    [-1, /^Venció el .+ \(ayer\)\.$/],
    [-3, /^Venció el .+ \(hace 3 días\)\.$/],
  ])('describes an expiry %i days away', (days, pattern) => {
    expect(getAlertDetails(alert(1, { type: 'expiry', level: 'critical', product_expiry: inDays(days), product_stock: 2 }))[0]).toMatch(pattern);
  });

  it('an expired product is no longer worth eating', () => {
    expect(getAlertDetails(alert(1, { type: 'expiry', level: 'critical', product_expiry: inDays(-2), product_stock: 2 })))
      .toContain('Ya no conviene consumirlo.');
  });

  it('does not say "te avisamos cuando faltan menos de..." about a product that already expired', () => {
    const expired = getAlertDetails(alert(1, { type: 'expiry', level: 'critical', product_expiry: inDays(-2), product_stock: 2, limit_days: 7, rule_scope: 'general' }));
    expect(expired.join(' ')).not.toMatch(/te avisamos/i);
    expect(expired).toHaveLength(3);
    // el que vence hoy sí lo dice: todavía no venció
    const today = getAlertDetails(alert(1, { type: 'expiry', level: 'critical', product_expiry: inDays(0), product_stock: 2, limit_days: 7, rule_scope: 'general' }));
    expect(today.join(' ')).toMatch(/Te avisamos cuando faltan menos de 7 días/);
  });

  it('explains a low stock: what is left, the minimum, how much to restock and that a model calculated it', () => {
    const lines = getAlertDetails(alert(1, {
      type: 'stock_low_coverage', level: 'critical', product_stock: 2, days_until_stockout: 3, suggested_qty: 12, limit_days: 7, rule_scope: 'general',
    }));
    expect(lines).toEqual([
      'Con tu consumo, las 2 unidades que quedan alcanzan para 3 días.',
      'Tu mínimo es de 7 días (tu regla general): estás por debajo de él.',
      'Para volver a esa cobertura se sugiere reponer 12 unidades.',
      'Calculado por el modelo predictivo con tu historial de consumo.',
    ]);
  });

  it('a low stock near the minimum says it is getting close', () => {
    const lines = getAlertDetails(alert(1, { type: 'stock_low_coverage', level: 'warning', product_stock: 1, days_until_stockout: 8, limit_days: 7 }));
    expect(lines).toContain('Tu mínimo es de 7 días (tu regla general): te estás acercando.');
    expect(lines).toContain('Con tu consumo, la unidad que queda alcanza para 8 días.');
  });

  it('explains the slow pace: the sentence of the list, why, and that a model calculated it', () => {
    const lines = getAlertDetails(alert(1, { type: 'slow_pace', level: 'warning', units_wasted: 4, product_expiry: inDays(45) }));
    expect(lines).toEqual([
      'Al ritmo actual, 4 unidades se vencerán en 45 días.',
      'Estás consumiendo este producto más lento de lo que tarda en vencer, y esas unidades quedarían sin usar.',
      'Calculado por el modelo predictivo con tu historial de consumo.',
    ]);
  });

  it('a critical slow pace says the expiry is already inside the period of the notice', () => {
    const lines = getAlertDetails(alert(1, { type: 'slow_pace', level: 'critical', units_wasted: 1, product_expiry: inDays(3) }));
    expect(lines).toContain('Su vencimiento ya está dentro de tu período de aviso.');
    expect(lines[1]).toContain('esa unidad quedaría sin usar');
  });

  it('has no details for an alert of type info', () => {
    expect(getAlertDetails(alert(1, { type: 'info' }))).toEqual([]);
  });
});

describe('getExpiryDate', () => {
  it('writes the date as day and month', () => {
    expect(getExpiryDate('2027-03-05')).toMatch(/5 de marzo/);
  });
});
