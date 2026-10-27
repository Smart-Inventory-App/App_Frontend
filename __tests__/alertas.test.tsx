import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import AlertasScreen from '../app/(tabs)/alertas';
import { alertService, Alert } from '@/services/alertService';

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
    getSummaryAlerts: jest.fn(),
    getCriticalAlerts: jest.fn(),
    getStockAlerts: jest.fn(),
    getExpiryAlerts: jest.fn(),
  },
}));

const mockedAlerts = alertService as jest.Mocked<typeof alertService>;

const alert = (id: number, overrides: Partial<Alert> = {}): Alert => ({
  id, userId: 'u1', productId: 1, type: 'info', level: 'info', product_name: `P${id}`, ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockedAlerts.getSummaryAlerts.mockResolvedValue({ critical: 1, warning: 2, info: 0, total: 3, expiring: 1, low_stock: 1 });
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('AlertasScreen', () => {
  it('loads alerts and the summary on focus', async () => {
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

  it('logs and swallows an error loading the initial alerts', async () => {
    mockedAlerts.getAlerts.mockRejectedValue(new Error('boom'));
    render(<AlertasScreen />);
    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Error fetching alerts:', expect.any(Error)));
  });

  it('filters by critical/stock/expiry/all', async () => {
    mockedAlerts.getAlerts.mockResolvedValue([]);
    mockedAlerts.getCriticalAlerts.mockResolvedValue([alert(2)]);
    mockedAlerts.getStockAlerts.mockResolvedValue([alert(3)]);
    mockedAlerts.getExpiryAlerts.mockResolvedValue([alert(4)]);
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByText('No hay alertas para mostrar.')).toBeTruthy());

    fireEvent.press(screen.getAllByText('Críticas').slice(-1)[0]);
    await waitFor(() => expect(screen.getByText('P2')).toBeTruthy());

    fireEvent.press(screen.getByText('Stock'));
    await waitFor(() => expect(screen.getByText('P3')).toBeTruthy());

    fireEvent.press(screen.getByText('Vencimiento'));
    await waitFor(() => expect(screen.getByText('P4')).toBeTruthy());

    mockedAlerts.getAlerts.mockResolvedValue([alert(5)]);
    fireEvent.press(screen.getByText('Todas'));
    await waitFor(() => expect(screen.getByText('P5')).toBeTruthy());
  });

  it('logs and swallows an error while filtering', async () => {
    mockedAlerts.getAlerts.mockResolvedValue([]);
    mockedAlerts.getCriticalAlerts.mockRejectedValue(new Error('boom'));
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByText('No hay alertas para mostrar.')).toBeTruthy());
    fireEvent.press(screen.getAllByText('Críticas').slice(-1)[0]);
    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Error fetching alerts:', expect.any(Error)));
  });
});

describe('AlertasScreen - shared header', () => {
  it('uses the shared banner with the title "Centro de Alertas"', async () => {
    mockedAlerts.getAlerts.mockResolvedValue([]);
    render(<AlertasScreen />);
    expect(screen.getByTestId('screen-header')).toBeTruthy();
    expect(screen.getByText('Centro de Alertas')).toBeTruthy();
  });
});

describe('AlertasScreen - header', () => {
  it('has the home icon on the left and "Centro de Alertas" on the right, and the icon goes home', async () => {
    mockedAlerts.getAlerts.mockResolvedValue([]);
    render(<AlertasScreen />);
    await waitFor(() => expect(mockedAlerts.getSummaryAlerts).toHaveBeenCalled());
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('header-home')).toBeLessThan(tree.indexOf('Centro de Alertas'));
    fireEvent.press(screen.getByTestId('header-home'));
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/');
  });
});

describe('AlertasScreen - summary and filters look', () => {
  beforeEach(() => {
    mockedAlerts.getAlerts.mockResolvedValue([]);
    mockedAlerts.getSummaryAlerts.mockResolvedValue({ critical: 2, warning: 3, info: 0, total: 5, expiring: 0, low_stock: 0 });
  });

  it('gives the summary boxes room above and below their number and word', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(mockedAlerts.getSummaryAlerts).toHaveBeenCalled());
    const box = StyleSheet.flatten(screen.getByTestId('alert-summary-critical').props.style);
    expect(box.paddingVertical).toBeGreaterThanOrEqual(12);
  });

  it('makes the filter buttons big, with bigger text, and teal when selected', async () => {
    const { Colors } = require('../src/constants/colors');
    render(<AlertasScreen />);
    await waitFor(() => expect(mockedAlerts.getSummaryAlerts).toHaveBeenCalled());
    const button = StyleSheet.flatten(screen.getByTestId('alert-filter-Stock').props.style);
    expect(button.paddingVertical).toBeGreaterThanOrEqual(8);
    expect(StyleSheet.flatten(screen.getByText('Stock').props.style).fontSize).toBeGreaterThanOrEqual(14);
    expect(StyleSheet.flatten(screen.getByTestId('alert-filter-Todas').props.style).backgroundColor).toBe(Colors.primary);
    expect(button.backgroundColor).toBe('#fff');
    fireEvent.press(screen.getByTestId('alert-filter-Stock'));
    expect(StyleSheet.flatten(screen.getByTestId('alert-filter-Stock').props.style).backgroundColor).toBe(Colors.primary);
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

describe('AlertasScreen - coming back to the screen', () => {
  it('shows the filter "Todas" and every alert again after leaving the screen with another filter', async () => {
    const { Colors } = require('../src/constants/colors');
    mockedAlerts.getAlerts.mockResolvedValue([alert(1), alert(2)]);
    mockedAlerts.getStockAlerts.mockResolvedValue([alert(2)]);
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByText('P1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('alert-filter-Stock'));
    await waitFor(() => expect(mockedAlerts.getStockAlerts).toHaveBeenCalled());
    expect(StyleSheet.flatten(screen.getByTestId('alert-filter-Stock').props.style).backgroundColor).toBe(Colors.primary);
    mockedAlerts.getAlerts.mockClear();

    // Salir de la pantalla y volver a entrar: la pestaña sigue montada y se dispara el foco otra vez
    act(() => { mockFocusCallback(); });

    await waitFor(() => expect(mockedAlerts.getAlerts).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('P1')).toBeTruthy());
    expect(screen.getByText('P2')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('alert-filter-Todas').props.style).backgroundColor).toBe(Colors.primary);
    expect(StyleSheet.flatten(screen.getByTestId('alert-filter-Stock').props.style).backgroundColor).toBe('#fff');
  });
});

describe('AlertasScreen - summary text fits its box', () => {
  beforeEach(() => {
    mockedAlerts.getAlerts.mockResolvedValue([]);
    mockedAlerts.getSummaryAlerts.mockResolvedValue({ critical: 12, warning: 345, info: 0, total: 357, expiring: 0, low_stock: 0 });
  });

  it.each(['critical', 'warning', 'total'])('shrinks the word of the %s box instead of overflowing it', async key => {
    render(<AlertasScreen />);
    await waitFor(() => expect(mockedAlerts.getSummaryAlerts).toHaveBeenCalled());
    const word = screen.getByTestId(`alert-summary-text-${key}`);
    expect(word.props.numberOfLines).toBe(1);
    expect(word.props.adjustsFontSizeToFit).toBe(true);
    expect(word.props.minimumFontScale).toBeGreaterThan(0);
    expect(word.props.minimumFontScale).toBeLessThan(1);
    const style = StyleSheet.flatten(word.props.style);
    expect(style.alignSelf).toBe('stretch');
    expect(style.textAlign).toBe('center');
  });

  it('shows the three words (críticas, advertencias and total) and keeps the numbers fitting too', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByText('Advertencias')).toBeTruthy());
    expect(screen.getByTestId('alert-summary-text-critical').props.children).toBe('Críticas');
    expect(screen.getByTestId('alert-summary-text-total').props.children).toBe('Total');
    expect(screen.getByTestId('alert-summary-value-total').props.children).toBe(357);
    expect(screen.getByTestId('alert-summary-value-warning').props.adjustsFontSizeToFit).toBe(true);
    expect(screen.getByTestId('alert-summary-value-warning').props.children).toBe(345);
  });
});

describe('AlertasScreen - rules of the user and alerts of the system', () => {
  const inDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const list = () => [
    alert(2, { type: 'slow_pace', level: 'critical', product_name: 'Miel', units_wasted: 2, product_expiry: inDays(3) }),
    alert(3, { type: 'expiry', level: 'warning', product_name: 'Yogur', product_expiry: inDays(9), product_stock: 3, limit_days: 7, rule_scope: 'general' }),
    alert(4, { type: 'stock_low_coverage', level: 'critical', product_name: 'Leche', product_stock: 1, days_until_stockout: 2, suggested_qty: 5, limit_days: 7, rule_scope: 'general' }),
  ];
  const at = (id: string) => JSON.stringify(screen.toJSON()).indexOf(`"${id}"`);

  it('separates the alerts of the rules of the user from the ones generated by the system', async () => {
    mockedAlerts.getAlerts.mockResolvedValue(list());
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alerts-section-rule')).toBeTruthy());
    const rule = within(screen.getByTestId('alerts-section-rule'));
    const system = within(screen.getByTestId('alerts-section-system'));
    expect(rule.getByText('Según tus reglas')).toBeTruthy();
    expect(rule.getByTestId('alert-item-3')).toBeTruthy();
    expect(rule.getByTestId('alert-item-4')).toBeTruthy();
    expect(rule.queryByTestId('alert-item-2')).toBeNull();
    expect(system.getByText('Generadas por el sistema')).toBeTruthy();
    expect(system.getByTestId('alert-item-2')).toBeTruthy();
  });

  it('puts the ones of the rules at the very beginning of the list, the most serious first', async () => {
    mockedAlerts.getAlerts.mockResolvedValue(list());
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alerts-section-rule')).toBeTruthy());
    expect(at('alerts-section-rule')).toBeLessThan(at('alerts-section-system'));
    expect(at('alert-item-4')).toBeLessThan(at('alert-item-3'));
    expect(at('alert-item-3')).toBeLessThan(at('alert-item-2'));
  });

  it('highlights the alerts of the predictive model wherever they are, and the ones of the rules with the color of the app', async () => {
    mockedAlerts.getAlerts.mockResolvedValue(list());
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alerts-section-rule')).toBeTruthy());
    expect(screen.getByTestId('alert-predictive-4')).toBeTruthy();
    expect(screen.getByTestId('alert-predictive-2')).toBeTruthy();
    expect(screen.queryByTestId('alert-predictive-3')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('alert-row-3').props.style).borderColor).toBe('#2CC4B4');
    expect(StyleSheet.flatten(screen.getByTestId('alert-row-4').props.style).borderColor).toBe('#7c5cff');
  });

  it('shows the stock alert with the units to restock in the same row', async () => {
    mockedAlerts.getAlerts.mockResolvedValue(list());
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByText('Stock restante: 1 ud. · Reponer 5 ud.')).toBeTruthy());
    expect(screen.getByText('Tu mínimo: 7 días · regla general')).toBeTruthy();
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

  it('keeps the two sections when a filter is applied', async () => {
    mockedAlerts.getAlerts.mockResolvedValue([]);
    mockedAlerts.getStockAlerts.mockResolvedValue([
      alert(4, { type: 'stock_low_coverage', level: 'critical', days_until_stockout: 2 }),
    ]);
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByText('No hay alertas para mostrar.')).toBeTruthy());
    fireEvent.press(screen.getByText('Stock'));
    await waitFor(() => expect(screen.getByTestId('alerts-section-rule')).toBeTruthy());
    expect(within(screen.getByTestId('alerts-section-rule')).getByTestId('alert-item-4')).toBeTruthy();
  });

  it('does not render a virtualized list inside the scroll of the screen', async () => {
    mockedAlerts.getAlerts.mockResolvedValue(list());
    const { UNSAFE_queryByType } = render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alerts-section-rule')).toBeTruthy());
    const { FlatList } = require('react-native');
    expect(UNSAFE_queryByType(FlatList)).toBeNull();
  });
});

describe('AlertasScreen - the numbers add up', () => {
  it('shows critical, warning and total, and the total is the sum of the two', async () => {
    mockedAlerts.getAlerts.mockResolvedValue([]);
    mockedAlerts.getSummaryAlerts.mockResolvedValue({ critical: 4, warning: 6, info: 0, total: 10, expiring: 2, low_stock: 1 });
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByTestId('alert-summary-value-total')).toBeTruthy());
    expect(screen.getByTestId('alert-summary-value-critical').props.children).toBe(4);
    expect(screen.getByTestId('alert-summary-value-warning').props.children).toBe(6);
    expect(screen.getByTestId('alert-summary-value-total').props.children).toBe(10);
    expect(screen.queryByText('Info')).toBeNull();
  });

  it('names the filters after what they show', async () => {
    mockedAlerts.getAlerts.mockResolvedValue([]);
    render(<AlertasScreen />);
    ['Todas', 'Críticas', 'Stock', 'Vencimiento'].forEach(name => expect(screen.getByTestId(`alert-filter-${name}`)).toBeTruthy());
  });
});
