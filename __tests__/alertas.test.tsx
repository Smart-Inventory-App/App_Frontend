import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

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
  mockedAlerts.getSummaryAlerts.mockResolvedValue({ critical: 1, warning: 2, info: 3 });
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('AlertasScreen', () => {
  it('loads alerts and the summary on focus', async () => {
    mockedAlerts.getAlerts.mockResolvedValue([alert(1)]);
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByText('P1 - Información')).toBeTruthy());
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
    await waitFor(() => expect(screen.getByText('P2 - Información')).toBeTruthy());

    fireEvent.press(screen.getByText('Stocks'));
    await waitFor(() => expect(screen.getByText('P3 - Información')).toBeTruthy());

    fireEvent.press(screen.getByText('Vencidos'));
    await waitFor(() => expect(screen.getByText('P4 - Información')).toBeTruthy());

    mockedAlerts.getAlerts.mockResolvedValue([alert(5)]);
    fireEvent.press(screen.getByText('Todas'));
    await waitFor(() => expect(screen.getByText('P5 - Información')).toBeTruthy());
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
    mockedAlerts.getSummaryAlerts.mockResolvedValue({ critical: 2, warning: 3, info: 4 });
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
    const button = StyleSheet.flatten(screen.getByTestId('alert-filter-Stocks').props.style);
    expect(button.paddingVertical).toBeGreaterThanOrEqual(8);
    expect(StyleSheet.flatten(screen.getByText('Stocks').props.style).fontSize).toBeGreaterThanOrEqual(14);
    expect(StyleSheet.flatten(screen.getByTestId('alert-filter-Todas').props.style).backgroundColor).toBe(Colors.primary);
    expect(button.backgroundColor).toBe('#fff');
    fireEvent.press(screen.getByTestId('alert-filter-Stocks'));
    expect(StyleSheet.flatten(screen.getByTestId('alert-filter-Stocks').props.style).backgroundColor).toBe(Colors.primary);
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
    await waitFor(() => expect(screen.getByText('P1 - Información')).toBeTruthy());
    fireEvent.press(screen.getByTestId('alert-filter-Stocks'));
    await waitFor(() => expect(mockedAlerts.getStockAlerts).toHaveBeenCalled());
    expect(StyleSheet.flatten(screen.getByTestId('alert-filter-Stocks').props.style).backgroundColor).toBe(Colors.primary);
    mockedAlerts.getAlerts.mockClear();

    // Salir de la pantalla y volver a entrar: la pestaña sigue montada y se dispara el foco otra vez
    act(() => { mockFocusCallback(); });

    await waitFor(() => expect(mockedAlerts.getAlerts).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('P1 - Información')).toBeTruthy());
    expect(screen.getByText('P2 - Información')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('alert-filter-Todas').props.style).backgroundColor).toBe(Colors.primary);
    expect(StyleSheet.flatten(screen.getByTestId('alert-filter-Stocks').props.style).backgroundColor).toBe('#fff');
  });
});

describe('AlertasScreen - summary text fits its box', () => {
  beforeEach(() => {
    mockedAlerts.getAlerts.mockResolvedValue([]);
    mockedAlerts.getSummaryAlerts.mockResolvedValue({ critical: 12, warning: 345, info: 6 });
  });

  it.each(['critical', 'warning', 'info'])('shrinks the word of the %s box instead of overflowing it', async key => {
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

  it('shows the three words and keeps the numbers fitting too', async () => {
    render(<AlertasScreen />);
    await waitFor(() => expect(screen.getByText('Advertencias')).toBeTruthy());
    expect(screen.getByTestId('alert-summary-text-critical').props.children).toBe('Críticas');
    expect(screen.getByTestId('alert-summary-text-info').props.children).toBe('Info');
    expect(screen.getByTestId('alert-summary-value-warning').props.adjustsFontSizeToFit).toBe(true);
    expect(screen.getByTestId('alert-summary-value-warning').props.children).toBe(345);
  });
});
