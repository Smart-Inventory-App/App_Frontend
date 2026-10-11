import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import HomeScreen from '../app/(tabs)/index';
import { useAuth } from '@/context/AuthContext';
import { productService } from '@/services/productService';
import { profileService } from '@/services/profileService';
import { Product } from '@/types/product';

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
    useFocusEffect: (cb: () => void) => ReactActual.useEffect(cb, [cb]),
  };
});

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/productService', () => ({
  productService: { getProducts: jest.fn() },
}));

jest.mock('@/services/profileService', () => ({
  profileService: { getProfile: jest.fn() },
}));

const mockedProducts = productService as jest.Mocked<typeof productService>;
const mockedProfile = profileService as jest.Mocked<typeof profileService>;

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 1,
  user_id: 'u1',
  nombre: 'Leche',
  categoria: 'Lacteos',
  stock: 3,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ token: 'tok' });
});

describe('HomeScreen (tabs/index)', () => {
  it('does not fetch when there is no token', () => {
    (useAuth as jest.Mock).mockReturnValue({ token: null });
    render(<HomeScreen />);
    expect(mockedProducts.getProducts).not.toHaveBeenCalled();
  });

  it('shows an empty state and default welcome when there are no products/profile name', async () => {
    mockedProducts.getProducts.mockResolvedValue([]);
    mockedProfile.getProfile.mockResolvedValue({
      sub: 'u1', coverageDaysThreshold: 5, expiryDaysThreshold: 7, alertCheckHour: 8, userType: 'individuo',
    });
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText('No hay productos cargados aún')).toBeTruthy());
    expect(screen.getByText('Bienvenido')).toBeTruthy();
  });

  it('shows stats and a personalized welcome using the username', async () => {
    mockedProducts.getProducts.mockResolvedValue([
      product({ id: 1, nombre: 'Leche', stock: 2, stock_minimo: 5 }),
      product({ id: 2, nombre: 'Yogur', stock: 10 }),
    ]);
    mockedProfile.getProfile.mockResolvedValue({
      sub: 'u1', username: 'ana', coverageDaysThreshold: 5, expiryDaysThreshold: 7, alertCheckHour: 8, userType: 'individuo',
    });
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText('Bienvenido, ana')).toBeTruthy());
    expect(screen.getByText('Leche')).toBeTruthy();
    expect(screen.getByText('Yogur')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy(); // total stock
  });

  it('falls back to firstName when there is no username', async () => {
    mockedProducts.getProducts.mockResolvedValue([]);
    mockedProfile.getProfile.mockResolvedValue({
      sub: 'u1', firstName: 'Ana', coverageDaysThreshold: 5, expiryDaysThreshold: 7, alertCheckHour: 8, userType: 'individuo',
    });
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText('Bienvenido, Ana')).toBeTruthy());
  });

  it('counts products expiring within the threshold window', async () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    mockedProducts.getProducts.mockResolvedValue([
      product({ id: 1, nombre: 'Vence pronto', vencimiento: soon }),
      product({ id: 2, nombre: 'Ya vencido', vencimiento: past }),
      product({ id: 3, nombre: 'Sin vencimiento' }),
    ]);
    mockedProfile.getProfile.mockResolvedValue({
      sub: 'u1', coverageDaysThreshold: 5, expiryDaysThreshold: 7, alertCheckHour: 8, userType: 'individuo',
    });
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText('Vence pronto')).toBeTruthy());
  });

  it('silently handles a load failure', async () => {
    mockedProducts.getProducts.mockRejectedValue(new Error('boom'));
    mockedProfile.getProfile.mockResolvedValue({
      sub: 'u1', coverageDaysThreshold: 5, expiryDaysThreshold: 7, alertCheckHour: 8, userType: 'individuo',
    });
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText('No hay productos cargados aún')).toBeTruthy());
  });

  it('only shows the first three recent products', async () => {
    mockedProducts.getProducts.mockResolvedValue([
      product({ id: 1, nombre: 'P1' }), product({ id: 2, nombre: 'P2' }),
      product({ id: 3, nombre: 'P3' }), product({ id: 4, nombre: 'P4' }),
    ]);
    mockedProfile.getProfile.mockResolvedValue({
      sub: 'u1', coverageDaysThreshold: 5, expiryDaysThreshold: 7, alertCheckHour: 8, userType: 'individuo',
    });
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText('P3')).toBeTruthy());
    expect(screen.queryByText('P4')).toBeNull();
  });
});

describe('HomeScreen - shared header', () => {
  it('uses the shared banner with the welcome message and the app name on the right', async () => {
    mockedProducts.getProducts.mockResolvedValue([]);
    mockedProfile.getProfile.mockResolvedValue({
      sub: 'u1', username: 'ana', coverageDaysThreshold: 5, expiryDaysThreshold: 7, alertCheckHour: 8, userType: 'individuo',
    });
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText('Bienvenido, ana')).toBeTruthy());
    expect(screen.getByTestId('screen-header')).toBeTruthy();
    // el nombre de la app va a la izquierda y el saludo queda a la derecha
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Smart Inventory')).toBeLessThan(tree.indexOf('Bienvenido, ana'));
  });
});
