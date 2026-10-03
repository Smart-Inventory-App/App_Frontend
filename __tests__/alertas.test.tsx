import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import AlertasScreen from '../app/(tabs)/alertas';
import { alertService, Alert } from '@/services/alertService';

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
    useFocusEffect: (cb: () => void) => ReactActual.useEffect(cb, [cb]),
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

    fireEvent.press(screen.getByText('Vencimientos'));
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
