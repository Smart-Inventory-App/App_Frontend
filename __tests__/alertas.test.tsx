import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import AlertasScreen from '../app/(tabs)/alertas';
import { alertService, Alert } from '@/services/alertService';
import { requestAlertFilter } from '@/utils/alertFilterRequest';

const mockNavigate = jest.fn();
let mockFocusCallback: () => void = () => {};

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
    router: { navigate: (...args: any[]) => mockNavigate(...args) },
    useFocusEffect: (cb: () => void) => {
      mockFocusCallback = cb;
      ReactActual.useEffect(cb, [cb]);
    },
  };
});

jest.mock('@/services/alertService', () => ({
  alertService: {
    getAlerts: jest.fn(),
  },
}));

const mockedAlerts = alertService as jest.Mocked<typeof alertService>;

const alert = (id: number, overrides: Partial<Alert> = {}): Alert => ({
  id, user_id: 'u1', product_id: 1, type: 'info', level: 'info', product_name: `P${id}`, ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const at = (id: string) => JSON.stringify(screen.toJSON()).indexOf(`"${id}"`);

// Una mezcla de alertas: dos de stock (una crítica, una advertencia), dos de vencimiento y un ritmo lento
const mixed = () => [
  alert(1, { type: 'stock_low_coverage', level: 'critical', product_name: 'Leche', product_stock: 1, days_until_stockout: 2, limit_days: 7, rule_scope: 'general' }),
  alert(2, { type: 'stock_low_coverage', level: 'warning', product_name: 'Arroz', product_stock: 5, days_until_stockout: 8, limit_days: 7 }),
  alert(3, { type: 'expiry', level: 'critical', product_name: 'Yogur', product_stock: 3, product_expiry: inDays(2), limit_days: 7 }),
  alert(4, { type: 'expiry', level: 'warning', product_name: 'Queso', product_stock: 2, product_expiry: inDays(9), limit_days: 7 }),
  alert(5, { type: 'slow_pace', level: 'warning', product_name: 'Miel', units_wasted: 2, product_expiry: inDays(20) }),
];
const value = (key: string) => screen.getByTestId(`alert-summary-value-${key}`).props.children;
const shown = (ids: number[]) => ids.forEach(id => expect(screen.getByTestId(`alert-item-${id}`)).toBeTruthy());
const hidden = (ids: number[]) => ids.forEach(id => expect(screen.queryByTestId(`alert-item-${id}`)).toBeNull());

describe('AlertasScreen', () => {
  it('loads every alert on focus', async () => {
    mockedAlerts.getAlerts.mockResolvedValue([alert(1)]);
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByText('P1')).toBeTruthy());
    expect(screen.getAllByText('Críticas').length).toBeGreaterThan(0);
  });

  it('shows an empty state when there are no alerts', async () => {
    mockedAlerts.getAlerts.mockResolvedValue([]);
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByText('No hay alertas para mostrar.')).toBeTruthy());
  });

  it('logs and swallows an error loading the alerts', async () => {
    mockedAlerts.getAlerts.mockRejectedValue(new Error('boom'));
    render(<AlertasScreen />);
    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Error fetching alerts:', expect.any(Error)));
  });

  it('loads the alerts once: the filters are applied on screen, with no new request', async () => {
    mockedAlerts.getAlerts.mockResolvedValue(mixed());
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('alert-filter-Stock'));
    fireEvent.press(screen.getByTestId('alert-summary-critical'));
    fireEvent.press(screen.getByTestId('alert-filter-Vencimiento'));
    expect(mockedAlerts.getAlerts).toHaveBeenCalledTimes(1);
  });
});

describe('AlertasScreen - header', () => {
  it('uses the shared banner with the title "Centro de Alertas"', async () => {
    mockedAlerts.getAlerts.mockResolvedValue([]);
    render(<AlertasScreen />);
    expect(screen.getByTestId('screen-header')).toBeTruthy();
    expect(screen.getByText('Centro de Alertas')).toBeTruthy();
  });

  it('has the home icon on the left and "Centro de Alertas" on the right, and the icon goes home', async () => {
    mockedAlerts.getAlerts.mockResolvedValue([]);
    render(<AlertasScreen />);
    await waitFor(() => expect(mockedAlerts.getAlerts).toHaveBeenCalled());
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('header-home')).toBeLessThan(tree.indexOf('Centro de Alertas'));
    fireEvent.press(screen.getByTestId('header-home'));
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/');
  });
});

describe('AlertasScreen - type options', () => {
  beforeEach(() => mockedAlerts.getAlerts.mockResolvedValue(mixed()));

  it('has only three options: Todas, Stock and Vencimiento (no "Críticas" option)', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    ['Todas', 'Stock', 'Vencimiento'].forEach(name => expect(screen.getByTestId(`alert-filter-${name}`)).toBeTruthy());
    expect(screen.queryByTestId('alert-filter-Críticas')).toBeNull();
    expect(screen.queryByTestId('alert-filter-Stocks')).toBeNull();
    expect(screen.queryByTestId('alert-filter-Vencidos')).toBeNull();
  });

  it('writes "Vencimiento" in a single line', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    const word = screen.getByText('Vencimiento');
    expect(word.props.numberOfLines).toBe(1);
    expect(word.props.adjustsFontSizeToFit).toBe(true);
  });

  it('shows every alert with "Todas"', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    shown([1, 2, 3, 4, 5]);
  });

  it('shows only the stock alerts with "Stock"', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('alert-filter-Stock'));
    shown([1, 2]);
    hidden([3, 4, 5]);
  });

  it('shows the expiry alerts, and the slow pace ones, with "Vencimiento"', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('alert-filter-Vencimiento'));
    shown([3, 4, 5]);
    hidden([1, 2]);
  });

  it('makes the filter buttons big, with bigger text, and teal when selected', async () => {
    const { Colors } = require('../src/constants/colors');
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    const button = StyleSheet.flatten(screen.getByTestId('alert-filter-Stock').props.style);
    expect(button.paddingVertical).toBeGreaterThanOrEqual(8);
    expect(StyleSheet.flatten(screen.getByText('Stock').props.style).fontSize).toBeGreaterThanOrEqual(14);
    expect(StyleSheet.flatten(screen.getByTestId('alert-filter-Todas').props.style).backgroundColor).toBe(Colors.primary);
    expect(button.backgroundColor).toBe('#fff');
    fireEvent.press(screen.getByTestId('alert-filter-Stock'));
    expect(StyleSheet.flatten(screen.getByTestId('alert-filter-Stock').props.style).backgroundColor).toBe(Colors.primary);
  });
});

describe('AlertasScreen - critical and warning boxes', () => {
  beforeEach(() => mockedAlerts.getAlerts.mockResolvedValue(mixed()));

  it('has only two boxes, critical and warning: no total', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    expect(screen.getByTestId('alert-summary-critical')).toBeTruthy();
    expect(screen.getByTestId('alert-summary-warning')).toBeTruthy();
    expect(screen.queryByTestId('alert-summary-total')).toBeNull();
    expect(screen.queryByText('Total')).toBeNull();
    expect(screen.queryByText('Info')).toBeNull();
    expect(screen.getByTestId('alert-summary-text-critical').props.children).toBe('Críticas');
    expect(screen.getByTestId('alert-summary-text-warning').props.children).toBe('Advertencias');
  });

  it('counts exactly the alerts that are on screen', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    expect([value('critical'), value('warning')]).toEqual([2, 3]);
  });

  it('shows only the critical alerts when "Críticas" is tapped, and all of them again when tapped a second time', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('alert-summary-critical'));
    shown([1, 3]);
    hidden([2, 4, 5]);
    fireEvent.press(screen.getByTestId('alert-summary-critical'));
    shown([1, 2, 3, 4, 5]);
  });

  it('shows only the warnings when "Advertencias" is tapped, and switches between the two boxes', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('alert-summary-warning'));
    shown([2, 4, 5]);
    hidden([1, 3]);
    fireEvent.press(screen.getByTestId('alert-summary-critical'));
    shown([1, 3]);
    hidden([2, 4, 5]);
  });

  it('marks the box that is selected', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-summary-critical')).toBeTruthy());
    expect(screen.getByTestId('alert-summary-critical').props.accessibilityState).toMatchObject({ selected: false });
    fireEvent.press(screen.getByTestId('alert-summary-critical'));
    expect(screen.getByTestId('alert-summary-critical').props.accessibilityState).toMatchObject({ selected: true });
    // el contorno es rojo para las críticas y amarillo para las advertencias
    expect(StyleSheet.flatten(screen.getByTestId('alert-summary-critical').props.style).borderColor).toBe('#e5484d');
    expect(StyleSheet.flatten(screen.getByTestId('alert-summary-warning').props.style).borderColor).toBe('transparent');
    fireEvent.press(screen.getByTestId('alert-summary-warning'));
    expect(StyleSheet.flatten(screen.getByTestId('alert-summary-warning').props.style).borderColor).toBe('#fbbc05');
    expect(StyleSheet.flatten(screen.getByTestId('alert-summary-critical').props.style).borderColor).toBe('transparent');
  });

  it('paints the two boxes with a softer background than before, so the outline stands out', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-summary-critical')).toBeTruthy());
    expect(StyleSheet.flatten(screen.getByTestId('alert-summary-critical').props.style).backgroundColor).toBe('#e5484d40');
    expect(StyleSheet.flatten(screen.getByTestId('alert-summary-warning').props.style).backgroundColor).toBe('#fbbc0540');
  });

  it('combines the box with the type option: the numbers follow the option and match what is shown', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('alert-filter-Stock'));
    expect([value('critical'), value('warning')]).toEqual([1, 1]);
    fireEvent.press(screen.getByTestId('alert-summary-warning'));
    shown([2]);
    hidden([1, 3, 4, 5]);
    fireEvent.press(screen.getByTestId('alert-filter-Vencimiento'));
    expect([value('critical'), value('warning')]).toEqual([1, 2]);
    shown([4, 5]);
    hidden([1, 2, 3]);
  });

  it('says there is nothing to show when the option and the box leave no alert', async () => {
    mockedAlerts.getAlerts.mockResolvedValue([alert(1, { type: 'expiry', level: 'warning', product_expiry: inDays(9) })]);
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('alert-summary-critical'));
    expect(screen.getByText('No hay alertas para mostrar.')).toBeTruthy();
    expect(value('critical')).toBe(0);
  });

  it('gives the boxes room above and below their number and word, with a gap between them', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    const box = StyleSheet.flatten(screen.getByTestId('alert-summary-critical').props.style);
    expect(box.paddingVertical).toBeGreaterThanOrEqual(12);
    expect(box.borderRadius).toBeGreaterThan(0);
  });

  it.each(['critical', 'warning'])('shrinks the word of the %s box instead of overflowing it', async key => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    const word = screen.getByTestId(`alert-summary-text-${key}`);
    expect(word.props.numberOfLines).toBe(1);
    expect(word.props.adjustsFontSizeToFit).toBe(true);
    expect(word.props.minimumFontScale).toBeGreaterThan(0);
    expect(word.props.minimumFontScale).toBeLessThan(1);
    const style = StyleSheet.flatten(word.props.style);
    expect(style.alignSelf).toBe('stretch');
    expect(style.textAlign).toBe('center');
    expect(screen.getByTestId(`alert-summary-value-${key}`).props.adjustsFontSizeToFit).toBe(true);
  });
});

describe('AlertasScreen - sections', () => {
  beforeEach(() => mockedAlerts.getAlerts.mockResolvedValue(mixed()));

  it('separates the alerts of the rules of the user from the ones generated by the system', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alerts-section-rule')).toBeTruthy());
    const rule = within(screen.getByTestId('alerts-section-rule'));
    const system = within(screen.getByTestId('alerts-section-system'));
    ['alert-item-1', 'alert-item-2', 'alert-item-3', 'alert-item-4'].forEach(id => expect(rule.getByTestId(id)).toBeTruthy());
    expect(rule.queryByTestId('alert-item-5')).toBeNull();
    expect(system.getByTestId('alert-item-5')).toBeTruthy();
  });

  it('puts the ones of the rules at the very beginning of the list, the most serious first', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alerts-section-rule')).toBeTruthy());
    expect(at('alerts-section-rule')).toBeLessThan(at('alerts-section-system'));
    expect(at('alert-item-1')).toBeLessThan(at('alert-item-2'));
    expect(at('alert-item-3')).toBeLessThan(at('alert-item-4'));
    expect(at('alert-item-4')).toBeLessThan(at('alert-item-5'));
  });

  it('titles the first section "Según tus reglas" with a one-line note, and no icon that looks like a button', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alerts-section-rule')).toBeTruthy());
    const rule = within(screen.getByTestId('alerts-section-rule'));
    expect(rule.getByText('Según tus reglas')).toBeTruthy();
    const note = rule.getByText('Vencimiento y stock mínimo configurado.');
    expect(note.props.numberOfLines).toBe(1);
    expect(rule.queryByText(/límites que configuraste/)).toBeNull();
  });

  it('titles the second section "Generado por el sistema" with a one-line note', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alerts-section-system')).toBeTruthy());
    const system = within(screen.getByTestId('alerts-section-system'));
    expect(system.getByText('Generado por el sistema')).toBeTruthy();
    expect(system.getByText('Predicciones con tu flujo de productos.').props.numberOfLines).toBe(1);
    expect(screen.queryByText('Generadas por el sistema')).toBeNull();
  });

  it('has no icon in the titles of the sections', async () => {
    const { Ionicons } = require('@expo/vector-icons');
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alerts-section-rule')).toBeTruthy());
    const names = screen.UNSAFE_getAllByType(Ionicons).map((icon: any) => icon.props.name);
    expect(names).not.toContain('options-outline');
    expect(names).not.toContain('sparkles-outline');
  });

  it('shows every entry on a plain white background, and the badge only on the predictive ones', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alerts-section-rule')).toBeTruthy());
    [1, 2, 3, 4, 5].forEach(id => {
      const row = StyleSheet.flatten(screen.getByTestId(`alert-row-${id}`).props.style);
      expect(row.backgroundColor).toBe('#fff');
      expect(row.borderWidth).toBeUndefined();
    });
    [1, 2, 5].forEach(id => expect(screen.getByTestId(`alert-predictive-${id}`)).toBeTruthy());
    [3, 4].forEach(id => expect(screen.queryByTestId(`alert-predictive-${id}`)).toBeNull());
  });

  it('hides a section that has no alerts', async () => {
    mockedAlerts.getAlerts.mockResolvedValue([alert(3, { type: 'expiry', level: 'warning', product_expiry: inDays(9) })]);
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alerts-section-rule')).toBeTruthy());
    expect(screen.queryByTestId('alerts-section-system')).toBeNull();
  });

  it('uses the origin the backend sends over the type of the alert', async () => {
    mockedAlerts.getAlerts.mockResolvedValue([alert(5, { type: 'slow_pace', level: 'warning', origin: 'rule', product_expiry: inDays(9), units_wasted: 1 })]);
    render(<AlertasScreen />);
    await waitFor(() => expect(within(screen.getByTestId('alerts-section-rule')).getByTestId('alert-item-5')).toBeTruthy());
  });

  it('does not render a virtualized list inside the scroll of the screen', async () => {
    const { FlatList } = require('react-native');
    const { UNSAFE_queryByType } = render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alerts-section-rule')).toBeTruthy());
    expect(UNSAFE_queryByType(FlatList)).toBeNull();
  });
});

describe('AlertasScreen - alert detail window', () => {
  beforeEach(() => {
    mockedAlerts.getAlerts.mockResolvedValue([
      alert(1, { product_category: 'Lacteos', product_brand: 'Sancor', product_stock: 4 }),
    ]);
  });

  it('opens the detail of the alert that was tapped, and closes it', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    expect(screen.queryByTestId('alert-detail-card')).toBeNull();

    fireEvent.press(screen.getByTestId('alert-item-1'));

    expect(screen.getByTestId('alert-detail-nombre').props.children).toBe('P1');
    expect(screen.getByTestId('alert-detail-categoria').props.children).toBe('Lacteos');
    expect(screen.getByTestId('alert-detail-marca').props.children).toBe('Sancor');

    fireEvent.press(screen.getByTestId('alert-detail-close'));
    expect(screen.queryByTestId('alert-detail-card')).toBeNull();
  });
});

describe('AlertasScreen - count of alerts and products', () => {
  // Cinco alertas sobre cuatro productos: el producto 10 tiene una de stock y una de vencimiento
  const data = () => [
    alert(1, { product_id: 10, type: 'stock_low_coverage', level: 'critical', product_name: 'Leche' }),
    alert(2, { product_id: 10, type: 'expiry', level: 'warning', product_name: 'Leche', product_expiry: inDays(9), limit_days: 7 }),
    alert(3, { product_id: 11, type: 'expiry', level: 'critical', product_name: 'Yogur', product_expiry: inDays(2), limit_days: 7 }),
    alert(4, { product_id: 12, type: 'stock_low_coverage', level: 'warning', product_name: 'Arroz' }),
    alert(5, { product_id: 13, type: 'slow_pace', level: 'warning', product_name: 'Miel', product_expiry: inDays(20) }),
  ];
  const text = () => screen.getByTestId('alerts-count').props.children;

  it('says how many alerts there are and for how many different products, under the type options and before the first section', async () => {
    mockedAlerts.getAlerts.mockResolvedValue(data());
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alerts-count')).toBeTruthy());
    expect(text()).toBe('5 alertas para 4 productos');
    expect(at('alert-filter-Vencimiento')).toBeLessThan(at('alerts-count'));
    expect(at('alerts-count')).toBeLessThan(at('alerts-section-rule'));
  });

  it('follows the type option and the level box that are selected', async () => {
    mockedAlerts.getAlerts.mockResolvedValue(data());
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alerts-count')).toBeTruthy());
    fireEvent.press(screen.getByTestId('alert-filter-Stock'));
    expect(text()).toBe('2 alertas para 2 productos');
    fireEvent.press(screen.getByTestId('alert-summary-critical'));
    expect(text()).toBe('1 alerta para 1 producto');
    fireEvent.press(screen.getByTestId('alert-summary-critical'));
    fireEvent.press(screen.getByTestId('alert-filter-Vencimiento'));
    expect(text()).toBe('3 alertas para 3 productos');
  });

  it('counts a product once even if it has two alerts', async () => {
    mockedAlerts.getAlerts.mockResolvedValue(data().slice(0, 2));
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alerts-count')).toBeTruthy());
    expect(text()).toBe('2 alertas para 1 producto');
  });

  it('is not shown when there is nothing to show', async () => {
    mockedAlerts.getAlerts.mockResolvedValue([]);
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByText('No hay alertas para mostrar.')).toBeTruthy());
    expect(screen.queryByTestId('alerts-count')).toBeNull();
  });
});

describe('AlertasScreen - opened from the home', () => {
  beforeEach(() => mockedAlerts.getAlerts.mockResolvedValue(mixed()));

  it.each(['Vencimiento', 'Stock'] as const)('opens with the %s option already selected', async name => {
    const { Colors } = require('../src/constants/colors');
    requestAlertFilter(name);
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId(`alert-filter-${name}`)).toBeTruthy());
    expect(StyleSheet.flatten(screen.getByTestId(`alert-filter-${name}`).props.style).backgroundColor).toBe(Colors.primary);
    expect(StyleSheet.flatten(screen.getByTestId('alert-filter-Todas').props.style).backgroundColor).toBe('#fff');
  });

  it('shows only that kind of alerts, and the next time it opens shows all of them again', async () => {
    requestAlertFilter('Stock');
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    expect(screen.queryAllByTestId(/alert-item-/).length).toBeLessThan(5);
    act(() => { mockFocusCallback(); });
    await waitFor(() => shown([1, 2, 3, 4, 5]));
  });
});

describe('AlertasScreen - coming back to the screen', () => {
  it('shows every alert again, with no filter, after leaving the screen with a type option and a box selected', async () => {
    const { Colors } = require('../src/constants/colors');
    mockedAlerts.getAlerts.mockResolvedValue(mixed());
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-item-1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('alert-filter-Stock'));
    fireEvent.press(screen.getByTestId('alert-summary-critical'));
    hidden([2, 3]);
    mockedAlerts.getAlerts.mockClear();

    // Salir de la pantalla y volver a entrar: la pestaña sigue montada y se dispara el foco otra vez
    act(() => { mockFocusCallback(); });

    await waitFor(() => expect(mockedAlerts.getAlerts).toHaveBeenCalledTimes(1));
    await waitFor(() => shown([1, 2, 3, 4, 5]));
    expect(StyleSheet.flatten(screen.getByTestId('alert-filter-Todas').props.style).backgroundColor).toBe(Colors.primary);
    expect(StyleSheet.flatten(screen.getByTestId('alert-filter-Stock').props.style).backgroundColor).toBe('#fff');
    expect(screen.getByTestId('alert-summary-critical').props.accessibilityState).toMatchObject({ selected: false });
  });
});
