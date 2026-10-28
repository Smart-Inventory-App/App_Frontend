import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import TrendsModal from '../src/components/TrendsModal';
import { productService } from '@/services/productService';
import { TrendsResponse } from '@/types/product';

jest.mock('@/services/productService', () => ({
  productService: { getTrends: jest.fn() },
}));

const mockedProducts = productService as jest.Mocked<typeof productService>;

// Los últimos `n` días terminando en `end` (por defecto, el 22 de octubre de 2026); `quantities` son los últimos días y el
// resto va en cero
const lastDays = (n: number, quantities: number[] = [], end = new Date(2026, 9, 22)) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (n - 1 - i));
    const fromEnd = n - 1 - i;
    return {
      day: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      quantity: fromEnd < quantities.length ? quantities[quantities.length - 1 - fromEnd] : 0,
    };
  });

// 22 de octubre: 3 · 21: 7 · 20: 0 · 19: 2
const QUANTITIES = [2, 0, 7, 3];

const response = (period: number, overrides: Partial<TrendsResponse> = {}): TrendsResponse => ({
  period_days: period,
  total_consumido: 12,
  total_entradas: 20,
  consumo_por_dia: lastDays(period, QUANTITIES),
  top_productos: [
    { product_id: 1, nombre: 'Leche', cantidad: 8 },
    { product_id: 2, nombre: 'Pan', cantidad: 4 },
  ],
  productos_menos_usados: [],
  ...overrides,
});

// La ventana pide siempre dos veces seguidas: primero el período y después el doble, para comparar. El doble incluye lo
// consumido en el período anterior (`previous` unidades más)
const respond = (previous: number | null = 12, overrides: Partial<TrendsResponse> = {}) => {
  let calls = 0;
  mockedProducts.getTrends.mockImplementation(async (period = 14) => {
    calls += 1;
    const wide = calls % 2 === 0;
    if (wide && previous === null) throw new Error('boom');
    return response(period, { ...overrides, total_consumido: (overrides.total_consumido ?? 12) + (wide ? previous ?? 0 : 0) });
  });
};

const open = async (visible = true) => {
  const onClose = jest.fn();
  const utils = render(<TrendsModal visible={visible} onClose={onClose} />);
  if (visible) await waitFor(() => expect(screen.queryByTestId('trends-loading')).toBeNull());
  return { onClose, ...utils };
};

const settle = () => waitFor(() => expect(screen.queryByTestId('trends-loading')).toBeNull());

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TrendsModal - window', () => {
  beforeEach(() => respond());

  it('is a window that slides up from the bottom, like the history of changes', async () => {
    const { Modal } = require('react-native');
    const { UNSAFE_getByType } = await open();
    expect(UNSAFE_getByType(Modal).props.animationType).toBe('slide');
  });

  it('has the back arrow at the top left and the title "Tendencias de Consumo" at the top right', async () => {
    await open();
    expect(screen.getByText('Tendencias de Consumo')).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('trends-back')).toBeLessThan(tree.indexOf('Tendencias de Consumo'));
  });

  it('closes with the arrow and with the system back button', async () => {
    const { Modal } = require('react-native');
    const { onClose, UNSAFE_getByType } = await open();
    fireEvent.press(screen.getByTestId('trends-back'));
    act(() => { UNSAFE_getByType(Modal).props.onRequestClose(); });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows nothing and asks for nothing while it is closed', async () => {
    await open(false);
    expect(screen.queryByTestId('trends-scroll')).toBeNull();
    expect(mockedProducts.getTrends).not.toHaveBeenCalled();
  });
});

describe('TrendsModal - period', () => {
  beforeEach(() => respond());

  it('offers 7, 14, 30 and 90 days, starting at 14', async () => {
    await open();
    [7, 14, 30, 90].forEach(n => expect(screen.getByTestId(`trends-period-${n}`)).toBeTruthy());
    expect(screen.getByTestId('trends-period-14').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('trends-period-7').props.accessibilityState).toMatchObject({ selected: false });
    expect(mockedProducts.getTrends).toHaveBeenCalledWith(14);
    expect(mockedProducts.getTrends).toHaveBeenCalledWith(28);
  });

  it.each([7, 30, 90])('asks for the %i days, and for twice as many to compare, when that period is chosen', async period => {
    await open();
    mockedProducts.getTrends.mockClear();
    fireEvent.press(screen.getByTestId(`trends-period-${period}`));
    await waitFor(() => expect(mockedProducts.getTrends).toHaveBeenCalledWith(period));
    expect(mockedProducts.getTrends).toHaveBeenCalledWith(period * 2);
    await settle();
    expect(screen.getByTestId(`trends-period-${period}`).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId(`trends-bar-${period - 1}`)).toBeTruthy();
    expect(screen.queryByTestId(`trends-bar-${period}`)).toBeNull();
  });

  it('draws one bar per day of the period', async () => {
    await open();
    expect(screen.getByTestId('trends-bar-13')).toBeTruthy();
    expect(screen.queryByTestId('trends-bar-14')).toBeNull();
  });
});

describe('TrendsModal - summary', () => {
  it('shows what was consumed and restocked, the average per day and the busiest day', async () => {
    respond();
    await open();
    expect(screen.getByTestId('trends-consumed').props.children).toBe(12);
    expect(screen.getByTestId('trends-restocked').props.children).toBe(20);
    expect(screen.getByTestId('trends-average').props.children).toBe(0.9);
    expect(screen.getByTestId('trends-peak').props.children).toBe(7);
    expect(screen.getByText('Mayor consumo (21 oct)')).toBeTruthy();
  });

  it('says it consumed the same when the previous period was the same', async () => {
    respond(12);
    await open();
    expect(screen.getByTestId('trends-change-text').props.children).toBe('Consumiste lo mismo que en los 14 días anteriores.');
  });

  it('says it consumed more when the previous period was smaller', async () => {
    respond(6);
    await open();
    expect(screen.getByTestId('trends-change-text').props.children).toBe('Consumiste 100% más que en los 14 días anteriores.');
    expect(StyleSheet.flatten(screen.getByTestId('trends-change').props.style).backgroundColor).toBe('#fff4e0');
  });

  it('says it consumed less when the previous period was bigger', async () => {
    respond(28);
    await open();
    expect(screen.getByTestId('trends-change-text').props.children).toBe('Consumiste 57% menos que en los 14 días anteriores.');
    expect(StyleSheet.flatten(screen.getByTestId('trends-change').props.style).backgroundColor).toBe('#e6f7f5');
  });

  it('says there is nothing to compare with when there was no consumption in the previous period', async () => {
    respond(0);
    await open();
    expect(screen.getByTestId('trends-change-text').props.children).toBe('Todavía no hay consumo en el período anterior para comparar.');
  });

  it('still works when the previous period cannot be loaded', async () => {
    respond(null);
    await open();
    expect(screen.getByTestId('trends-consumed').props.children).toBe(12);
    expect(screen.getByTestId('trends-change-text').props.children).toBe('Todavía no hay consumo en el período anterior para comparar.');
  });

  it('shows a dash for the busiest day when nothing was consumed, and says so', async () => {
    respond(12, { total_consumido: 0, consumo_por_dia: lastDays(14), top_productos: [] });
    await open();
    expect(screen.getByTestId('trends-peak').props.children).toBe('–');
    expect(screen.getByTestId('trends-empty-period').props.children).toBe('No hubo consumo en estos 14 días.');
    expect(screen.getByTestId('trends-day-hint').props.children).toBe('Tocá una barra para ver cuánto se consumió ese día.');
  });
});

describe('TrendsModal - interactive chart', () => {
  beforeEach(() => respond());

  it('starts with the busiest day selected, telling how many units were consumed', async () => {
    await open();
    expect(screen.getByTestId('trends-day-title').props.children).toBe('Miércoles 21 de octubre');
    expect(screen.getByTestId('trends-day-units').props.children).toBe('Se consumieron 7 unidades');
    expect(screen.getByTestId('trends-bar-12').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('shows how much was consumed on the day whose bar is tapped', async () => {
    await open();
    fireEvent.press(screen.getByTestId('trends-bar-10'));
    expect(screen.getByTestId('trends-day-title').props.children).toBe('Lunes 19 de octubre');
    expect(screen.getByTestId('trends-day-units').props.children).toBe('Se consumieron 2 unidades');
    expect(screen.getByTestId('trends-bar-10').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('trends-bar-12').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('uses the singular for a single unit and says when a day had no consumption', async () => {
    respond(12, { consumo_por_dia: lastDays(14, [0, 1, 4]) });
    await open();
    fireEvent.press(screen.getByTestId('trends-bar-12'));
    expect(screen.getByTestId('trends-day-units').props.children).toBe('Se consumió 1 unidad');
    fireEvent.press(screen.getByTestId('trends-bar-0'));
    expect(screen.getByTestId('trends-day-units').props.children).toBe('Ese día no hubo consumo');
  });

  it('draws the highest day with the highest bar, and a day without consumption with a short grey one', async () => {
    await open();
    const bar = (index: number) => StyleSheet.flatten(screen.getByTestId(`trends-bar-fill-${index}`).props.style);
    expect(bar(12).height).toBeGreaterThan(bar(13).height);
    expect(bar(13).height).toBeGreaterThan(bar(11).height);
    expect(bar(11).backgroundColor).toBe('#dfe3e8');
    expect(bar(11).height).toBe(3);
  });

  it('writes the month over each part of the chart', async () => {
    await open();
    fireEvent.press(screen.getByTestId('trends-period-30'));
    await settle();
    const months = screen.getAllByTestId(/trends-month-/);
    expect(months.length).toBe(2);
    expect(within(months[0]).getByText('Septiembre')).toBeTruthy();
    expect(within(months[1]).getByText('Octubre')).toBeTruthy();
  });

  it('abbreviates the month when its part of the chart is narrow', async () => {
    // 90 días que terminan el 2 de octubre: octubre ocupa solo dos barras
    respond(12, { consumo_por_dia: lastDays(90, [1], new Date(2026, 9, 2)) });
    await open();
    fireEvent.press(screen.getByTestId('trends-period-90'));
    await settle();
    const labels = screen.getAllByTestId(/trends-month-/).map(node => within(node).getByText(/./).props.children);
    expect(labels).toEqual(['Julio', 'Agosto', 'Septiembre', 'Oct']);
  });

  it('can be scrolled sideways, starting on the latest days', async () => {
    await open();
    const scroll = screen.getByTestId('trends-chart-scroll');
    expect(scroll.props.horizontal).toBe(true);
    expect(typeof scroll.props.onContentSizeChange).toBe('function');
    act(() => { scroll.props.onContentSizeChange(); });
  });

  it('lets a screen reader hear the day and the units of each bar', async () => {
    await open();
    expect(screen.getByTestId('trends-bar-12').props.accessibilityLabel).toBe('Miércoles 21 de octubre: 7 unidades');
    expect(screen.getByTestId('trends-bar-11').props.accessibilityLabel).toBe('Martes 20 de octubre: 0 unidades');
  });
});

describe('TrendsModal - rankings', () => {
  it('shows the most consumed products with a bar proportional to the first one', async () => {
    respond();
    await open();
    expect(screen.getByText('Más consumidos')).toBeTruthy();
    expect(within(screen.getByTestId('trends-top-0')).getByText('Leche')).toBeTruthy();
    expect(within(screen.getByTestId('trends-top-0')).getByText('8 unidades')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('trends-top-bar-0').props.style).width).toBe('100%');
    expect(StyleSheet.flatten(screen.getByTestId('trends-top-bar-1').props.style).width).toBe('50%');
  });

  it('says there is not enough history when no product was consumed', async () => {
    respond(12, { top_productos: [] });
    await open();
    expect(screen.getByTestId('trends-no-top').props.children).toBe('Todavía no hay suficiente historial.');
  });

  it('shows the least used products only when there are some', async () => {
    respond(12, { productos_menos_usados: [{ product_id: 9, nombre: 'Sal', cantidad: 1 }] });
    await open();
    expect(screen.getByText('Menos usados')).toBeTruthy();
    expect(within(screen.getByTestId('trends-low-0')).getByText('1 unidad')).toBeTruthy();
    respond();
    fireEvent.press(screen.getByTestId('trends-period-7'));
    await waitFor(() => expect(screen.queryByText('Menos usados')).toBeNull());
  });
});

describe('TrendsModal - loading and errors', () => {
  // Cada pedido queda pendiente hasta que el test lo resuelve
  const pending = () => {
    const calls: { period: number; resolve: (value: TrendsResponse) => void }[] = [];
    mockedProducts.getTrends.mockImplementation((period = 14) => new Promise<TrendsResponse>(resolve => { calls.push({ period, resolve }); }));
    return calls;
  };

  it('shows a loading indicator while the data comes', async () => {
    const calls = pending();
    render(<TrendsModal visible onClose={jest.fn()} />);
    expect(screen.getByTestId('trends-loading')).toBeTruthy();
    await act(async () => { calls.forEach(call => call.resolve(response(call.period))); });
    await settle();
    expect(screen.getByTestId('trends-consumed')).toBeTruthy();
  });

  it('says it could not load, and loads again when the user retries', async () => {
    mockedProducts.getTrends.mockRejectedValue(new Error('boom'));
    await open();
    expect(screen.getByTestId('trends-error').props.children).toBe('No se pudieron cargar las tendencias.');
    expect(screen.queryByTestId('trends-consumed')).toBeNull();
    respond();
    await act(async () => { fireEvent.press(screen.getByTestId('trends-retry')); });
    await waitFor(() => expect(screen.getByTestId('trends-consumed')).toBeTruthy());
    expect(screen.queryByTestId('trends-error')).toBeNull();
  });

  it('ignores an old answer when the period was changed meanwhile', async () => {
    const calls = pending();
    render(<TrendsModal visible onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('trends-period-7'));
    expect(calls).toHaveLength(4);
    await act(async () => {
      // primero llegan las respuestas nuevas (7 días) y después las viejas (14 días)
      calls[2].resolve(response(7, { total_consumido: 5 }));
      calls[3].resolve(response(14, { total_consumido: 5 }));
      calls[0].resolve(response(14, { total_consumido: 99 }));
      calls[1].resolve(response(28, { total_consumido: 99 }));
    });
    await settle();
    expect(screen.getByTestId('trends-consumed').props.children).toBe(5);
  });

  it('forgets a pending answer when the window is closed', async () => {
    const calls = pending();
    const { rerender } = render(<TrendsModal visible onClose={jest.fn()} />);
    rerender(<TrendsModal visible={false} onClose={jest.fn()} />);
    await act(async () => { calls.forEach(call => call.resolve(response(call.period))); });
    expect(screen.queryByTestId('trends-consumed')).toBeNull();
  });
});
