import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import HomeScreen from '../app/(tabs)/index';
import { useAuth } from '@/context/AuthContext';
import { productService } from '@/services/productService';
import { profileService } from '@/services/profileService';
import { Product, StockChange } from '@/types/product';
import { resetWelcome } from '../src/utils/welcomeState';
import { Colors } from '../src/constants/colors';

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
    useFocusEffect: (cb: () => void) => ReactActual.useEffect(cb, [cb]),
    router: { navigate: jest.fn() },
  };
});

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/productService', () => ({
  productService: { getProducts: jest.fn(), getRecentChanges: jest.fn() },
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

const change = (overrides: Partial<StockChange> = {}): StockChange => ({
  id: 'event-1',
  kind: 'entrada',
  stock_before: 78,
  stock_after: 82,
  quantity: 4,
  occurred_at: '2026-10-10T12:00:00Z',
  producto: product({ id: 1, nombre: 'Leche', marca: 'Ser', imagen_url: 'https://cdn/leche.jpg' }),
  ...overrides,
});

const profile = (overrides: Record<string, unknown> = {}) => ({
  sub: 'u1', coverageDaysThreshold: 5, expiryDaysThreshold: 7, alertCheckHour: 8, userType: 'individuo' as const, ...overrides,
});

const load = async (options: { products?: Product[]; changes?: StockChange[]; profile?: Record<string, unknown> } = {}) => {
  mockedProducts.getProducts.mockResolvedValue(options.products ?? []);
  mockedProducts.getRecentChanges.mockResolvedValue(options.changes ?? []);
  mockedProfile.getProfile.mockResolvedValue(profile(options.profile) as any);
  const utils = render(<HomeScreen />);
  await waitFor(() => expect(screen.getByTestId('home-section-recent')).toBeTruthy());
  return utils;
};

const at = (id: string) => JSON.stringify(screen.toJSON()).indexOf(`"${id}"`);

beforeEach(() => {
  jest.clearAllMocks();
  resetWelcome();
  (useAuth as jest.Mock).mockReturnValue({ token: 'tok' });
});

describe('HomeScreen - data', () => {
  it('does not fetch when there is no token', () => {
    (useAuth as jest.Mock).mockReturnValue({ token: null });
    render(<HomeScreen />);
    expect(mockedProducts.getProducts).not.toHaveBeenCalled();
    expect(mockedProducts.getRecentChanges).not.toHaveBeenCalled();
  });

  it('shows empty states when there are no products and no changes', async () => {
    await load();
    expect(screen.getByText('No tenés productos cargados')).toBeTruthy();
    expect(screen.getByText('No hiciste cambios aún')).toBeTruthy();
  });

  it('asks for the latest five stock changes', async () => {
    await load();
    expect(mockedProducts.getRecentChanges).toHaveBeenCalledWith(5);
  });

  it('keeps working when the latest changes cannot be loaded', async () => {
    mockedProducts.getProducts.mockResolvedValue([product({ id: 1, nombre: 'Leche' })]);
    mockedProducts.getRecentChanges.mockRejectedValue(new Error('boom'));
    mockedProfile.getProfile.mockResolvedValue(profile() as any);
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    expect(screen.getByText('No hiciste cambios aún')).toBeTruthy();
  });

  it('silently handles a load failure', async () => {
    mockedProducts.getProducts.mockRejectedValue(new Error('boom'));
    mockedProducts.getRecentChanges.mockResolvedValue([]);
    mockedProfile.getProfile.mockResolvedValue(profile() as any);
    render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText('No tenés productos cargados')).toBeTruthy());
  });
});

describe('HomeScreen - header and greeting', () => {
  it('shows the logo of the app instead of the app name', async () => {
    await load();
    expect(screen.getByTestId('home-logo')).toBeTruthy();
    expect(screen.queryByText('Smart Inventory')).toBeNull();
    expect(screen.queryByText('SMART INVENTORY')).toBeNull();
  });

  it('says "Bienvenido," on one line and the name on the line below', async () => {
    await load({ profile: { username: 'ana' } });
    expect(screen.getByTestId('home-greeting').props.children).toBe('Bienvenido,');
    expect(screen.getByTestId('home-name').props.children).toBe('ana');
    expect(at('home-greeting')).toBeLessThan(at('home-name'));
  });

  it('falls back to the first name when there is no username', async () => {
    await load({ profile: { firstName: 'Ana' } });
    expect(screen.getByTestId('home-name').props.children).toBe('Ana');
  });

  it('cuts a name longer than 20 characters and adds "..."', async () => {
    await load({ profile: { username: 'Nombre de usuario larguisimo de verdad' } });
    expect(screen.getByTestId('home-name').props.children).toBe('Nombre de usuario la...');
  });

  it('keeps a name of exactly 20 characters whole', async () => {
    await load({ profile: { username: '12345678901234567890' } });
    expect(screen.getByTestId('home-name').props.children).toBe('12345678901234567890');
  });

  it('only says the greeting, with no comma and no second line, when there is no name', async () => {
    await load();
    expect(screen.getByTestId('home-greeting').props.children).toBe('Bienvenido');
    expect(screen.queryByTestId('home-name')).toBeNull();
  });

  it('says "Tu estado," when the user leaves the home and comes back', async () => {
    const { unmount } = await load({ profile: { username: 'ana' } });
    expect(screen.getByTestId('home-greeting').props.children).toBe('Bienvenido,');
    unmount();

    await load({ profile: { username: 'ana' } });
    expect(screen.getByTestId('home-greeting').props.children).toBe('Tu estado,');
    expect(screen.getByTestId('home-name').props.children).toBe('ana');
  });

  it('says "Bienvenido," again after a new login', async () => {
    const { unmount } = await load({ profile: { username: 'ana' } });
    unmount();
    resetWelcome();

    await load({ profile: { username: 'ana' } });
    expect(screen.getByTestId('home-greeting').props.children).toBe('Bienvenido,');
  });

  it('is a banner of the teal of the app with rounded bottom corners, and the greeting in white', async () => {
    await load({ profile: { username: 'ana' } });
    const style = StyleSheet.flatten(screen.getByTestId('home-header').props.style);
    expect(style.borderBottomLeftRadius).toBeGreaterThan(0);
    expect(style.backgroundColor).toBe(Colors.primary);
    expect(StyleSheet.flatten(screen.getByTestId('home-greeting').props.style).color).toBe('#fff');
    expect(StyleSheet.flatten(screen.getByTestId('home-name').props.style).color).toBe('#fff');
  });

  it('writes the section titles in the dark gray of the rest of the app', async () => {
    await load();
    expect(StyleSheet.flatten(screen.getByTestId('home-section-changes').props.style).color).toBe(Colors.textPrimary);
    expect(StyleSheet.flatten(screen.getByTestId('home-section-recent').props.style).color).toBe(Colors.textPrimary);
  });

  it('paints the arrows of the sections in that same dark gray', async () => {
    const { Ionicons } = require('@expo/vector-icons');
    await load();
    const dark = screen.UNSAFE_getAllByType(Ionicons).filter((n: any) => n.props.name === 'chevron-forward' && n.props.color === Colors.textPrimary);
    expect(dark).toHaveLength(2);
  });

  it('has the same background as the rest of the screens, not a blue one', async () => {
    const { ScrollView } = require('react-native');
    await load();
    expect(StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.style).backgroundColor).toBe('#f2f3f6');
  });
});

describe('HomeScreen - cards', () => {
  const cards = ['stat-products', 'stat-stock', 'stat-expiring', 'stat-low'];

  it('shows the four cards in this order: products, products in stock, expiring soon and low stock', async () => {
    await load();
    expect(cards.map(at).every(i => i > 0)).toBe(true);
    expect([...cards.map(at)].sort((a, b) => a - b)).toEqual(cards.map(at));
    ['Productos', 'Productos en stock', 'Por vencer', 'Stock bajo'].forEach(title => expect(screen.getByText(title)).toBeTruthy());
  });

  it('counts the products, the units in stock, the low stock and the ones about to expire', async () => {
    const soon = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const past = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    await load({
      products: [
        product({ id: 1, nombre: 'Leche', stock: 2, stock_minimo: 5, vencimiento: soon }),
        product({ id: 2, nombre: 'Yogur', stock: 10 }),
        product({ id: 3, nombre: 'Viejo', stock: 8, vencimiento: past }),
      ],
    });
    expect(screen.getByTestId('stat-products-value').props.children).toBe('3');
    expect(screen.getByTestId('stat-stock-value').props.children).toBe('20');
    expect(screen.getByTestId('stat-expiring-value').props.children).toBe('1');
    expect(screen.getByTestId('stat-low-value').props.children).toBe('1');
  });

  it('takes the user to the inventory from "Productos" and from "Productos en stock"', async () => {
    await load();
    fireEvent.press(screen.getByTestId('stat-products'));
    fireEvent.press(screen.getByTestId('stat-stock'));
    expect(router.navigate).toHaveBeenNthCalledWith(1, '/(tabs)/inventario');
    expect(router.navigate).toHaveBeenNthCalledWith(2, '/(tabs)/inventario');
  });

  it('takes the user to the alerts from "Por vencer" and from "Stock bajo"', async () => {
    await load();
    fireEvent.press(screen.getByTestId('stat-expiring'));
    fireEvent.press(screen.getByTestId('stat-low'));
    expect(router.navigate).toHaveBeenNthCalledWith(1, '/(tabs)/alertas');
    expect(router.navigate).toHaveBeenNthCalledWith(2, '/(tabs)/alertas');
  });

  it('shows the thresholds of the profile in the labels', async () => {
    await load({ profile: { coverageDaysThreshold: 9, expiryDaysThreshold: 12 } });
    expect(screen.getByText('Próximos 12 días')).toBeTruthy();
    expect(screen.getByText('Próximos 9 días')).toBeTruthy();
  });
});

describe('HomeScreen - latest changes and recent products', () => {
  it('shows the latest changes first and the recent products below', async () => {
    await load({ changes: [change()], products: [product({ id: 2, nombre: 'Yogur' })] });
    expect(screen.getByText('Últimos Cambios')).toBeTruthy();
    expect(screen.getByText('Productos Recientes')).toBeTruthy();
    expect(at('home-section-changes')).toBeLessThan(at('change-row-event-1'));
    expect(at('change-row-event-1')).toBeLessThan(at('home-section-recent'));
    expect(at('home-section-recent')).toBeLessThan(at('lot-row-2'));
  });

  it('shows every change with its name, brand, category, reason and stock change', async () => {
    await load({
      changes: [
        change({ id: 'event-1', kind: 'entrada', stock_before: 78, stock_after: 82 }),
        change({ id: 'event-2', kind: 'salida', stock_before: 8, stock_after: 0, producto: product({ id: 2, nombre: 'Yogur', marca: 'Ser' }) }),
        change({ id: 'event-3', kind: 'modificacion', stock_before: 0, stock_after: 8, producto: product({ id: 3, nombre: 'Agua' }) }),
      ],
    });
    expect(screen.getByText('Entrada de producto')).toBeTruthy();
    expect(screen.getByText('Salida de producto')).toBeTruthy();
    expect(screen.getByText('Modificación del producto')).toBeTruthy();
    expect(screen.getByTestId('change-before-event-1').props.children).toBe('78');
    expect(screen.getByTestId('change-after-event-1').props.children).toBe('82');
    expect(screen.getByTestId('change-before-event-2').props.children).toBe('8');
    expect(screen.getByTestId('change-after-event-2').props.children).toBe('0');
  });

  it('shows the three most recent products with their load date highlighted', async () => {
    await load({
      products: [
        product({ id: 1, nombre: 'P1', created_at: '2026-10-05T15:30:00Z' }),
        product({ id: 2, nombre: 'P2' }), product({ id: 3, nombre: 'P3' }), product({ id: 4, nombre: 'P4' }),
      ],
    });
    expect(screen.getByText('P3')).toBeTruthy();
    expect(screen.queryByText('P4')).toBeNull();
    expect(screen.getByText('Fecha de carga: 05/10/2026 12:30')).toBeTruthy();
  });

  it('shows the product images, which open full screen', async () => {
    await load({ changes: [change()] });
    fireEvent.press(screen.getByTestId('product-image-button'));
    expect(screen.getByTestId('zoom-image').props.source).toEqual({ uri: 'https://cdn/leche.jpg' });
  });

  it('opens the product information from a change, without the "Stock total" button', async () => {
    await load({ changes: [change()] });
    fireEvent.press(screen.getByTestId('change-info-event-1'));
    expect(screen.getByTestId('product-detail-card')).toBeTruthy();
    expect(screen.getByTestId('detail-nombre').props.children).toBe('Leche');
    expect(screen.queryByTestId('detail-total-button')).toBeNull();
  });

  it('opens the product information from a recent product, without the "Stock total" button', async () => {
    await load({ products: [product({ id: 2, nombre: 'Yogur', marca: 'Ser' })] });
    fireEvent.press(screen.getByTestId('lot-info-2'));
    expect(screen.getByTestId('detail-nombre').props.children).toBe('Yogur');
    expect(screen.queryByTestId('detail-total-button')).toBeNull();
    expect(screen.queryByText('Stock total')).toBeNull();
  });

  it('shows the general alert rules of the profile in the information window', async () => {
    await load({ products: [product({ id: 2, nombre: 'Yogur' })], profile: { coverageDaysThreshold: 6, expiryDaysThreshold: 11 } });
    fireEvent.press(screen.getByTestId('lot-info-2'));
    expect(screen.getByTestId('detail-stock-minimo').props.children).toEqual('6 unidades');
    expect(screen.getByTestId('detail-dias-alerta').props.children).toEqual('11 días');
  });

  it('closes the information window', async () => {
    await load({ products: [product({ id: 2, nombre: 'Yogur' })] });
    fireEvent.press(screen.getByTestId('lot-info-2'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('product-detail-close'));
    });
    expect(screen.queryByTestId('product-detail-card')).toBeNull();
  });
});

describe('HomeScreen - numbers, row sizes, dates and arrows', () => {
  it('writes the numbers of the cards with a dot every three digits', async () => {
    await load({ products: [product({ id: 1, stock: 1255 }), product({ id: 2, stock: 3140657 })] });
    expect(screen.getByTestId('stat-stock-value').props.children).toBe('3.141.912');
    expect(screen.getByTestId('stat-products-value').props.children).toBe('2');
  });

  it('formats the count of products too when there are over a thousand', async () => {
    const many = Array.from({ length: 1255 }, (_, i) => product({ id: i + 1, nombre: `P${i}`, stock: 1 }));
    await load({ products: many });
    expect(screen.getByTestId('stat-products-value').props.children).toBe('1.255');
    expect(screen.getByTestId('stat-stock-value').props.children).toBe('1.255');
  });

  it('writes a big number smaller so it fits in its card', async () => {
    await load({ products: [product({ id: 1, stock: 3141912 })] });
    const big = StyleSheet.flatten(screen.getByTestId('stat-stock-value').props.style).fontSize;
    const small = StyleSheet.flatten(screen.getByTestId('stat-products-value').props.style).fontSize;
    expect(big).toBeLessThan(small);
  });

  it('writes the stock changes with their dots', async () => {
    await load({ changes: [change({ stock_before: 1255, stock_after: 3141912 })] });
    expect(screen.getByTestId('change-before-event-1').props.children).toBe('1.255');
    expect(screen.getByTestId('change-after-event-1').props.children).toBe('3.141.912');
  });

  it('gives every change the same height, while every recent product adapts to its own data', async () => {
    await load({
      changes: [
        change({ id: 'event-1' }),
        change({ id: 'event-2', producto: product({ id: 2, nombre: 'Un nombre larguísimo que no entra en un solo renglón de la tarjeta', marca: 'Marca con nombre extenso' }) }),
      ],
      products: [
        product({ id: 5, nombre: 'Corto' }),
        product({ id: 6, nombre: 'Otro nombre muy largo para probar el alto de la fila', marca: 'Ser', ubicacion: 'Alacena grande', vencimiento: '2027-01-01', created_at: '2026-10-05T15:30:00Z' }),
      ],
    });
    const height = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).height;
    expect(height('change-row-event-1')).toBeGreaterThan(0);
    expect(height('change-row-event-1')).toBe(height('change-row-event-2'));
    expect(height('lot-row-5')).toBeUndefined();
    expect(height('lot-row-6')).toBeUndefined();
  });

  it('shows the date and time of every change', async () => {
    await load({ changes: [change({ occurred_at: '2026-10-10T20:43:23Z' })] });
    expect(screen.getByTestId('change-date-event-1').props.children).toBe('10/10/2026 17:43');
  });

  it('has an arrow on the right of "Productos recientes" that goes to the inventory', async () => {
    await load();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('home-section-recent')).toBeLessThan(tree.indexOf('home-recent-more'));
    fireEvent.press(screen.getByTestId('home-recent-more'));
    expect(router.navigate).toHaveBeenCalledWith('/(tabs)/inventario');
  });

  it('has an arrow on the right of "Últimos Cambios"', async () => {
    await load({ changes: [change()] });
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('home-section-changes')).toBeLessThan(tree.indexOf('home-changes-more'));
  });

  it('opens the full screen history of changes from that arrow, asking for ten, and goes back', async () => {
    await load({ changes: [change()] });
    expect(screen.queryByTestId('changes-history-list')).toBeNull();
    fireEvent.press(screen.getByTestId('home-changes-more'));
    await waitFor(() => expect(mockedProducts.getRecentChanges).toHaveBeenCalledWith(10, 0));
    expect(screen.getByTestId('changes-history-list')).toBeTruthy();
    expect(router.navigate).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByTestId('changes-history-back'));
    });
    expect(screen.queryByTestId('changes-history-list')).toBeNull();
  });

  it('shows the product information, without "Stock total", from an entry of that history', async () => {
    await load({ changes: [change()] });
    fireEvent.press(screen.getByTestId('home-changes-more'));
    await waitFor(() => expect(screen.getAllByTestId('change-info-event-1')).toHaveLength(2), { timeout: 5000 });
    fireEvent.press(screen.getAllByTestId('change-info-event-1')[1]);
    expect(screen.getByTestId('detail-nombre').props.children).toBe('Leche');
    expect(screen.queryByTestId('detail-total-button')).toBeNull();
  });

  it('highlights the load date of the recent products in the teal of the app', async () => {
    await load({ products: [product({ id: 5, nombre: 'Corto', created_at: '2026-10-05T15:30:00Z' })] });
    const text = screen.getByText('Fecha de carga: 05/10/2026 12:30');
    expect(StyleSheet.flatten(text.props.style).color).toBe(Colors.primary);
  });
});

describe('HomeScreen - empty lists', () => {
  it('tells the user in each list when there is nothing to show', async () => {
    await load();
    expect(screen.getByText('No hiciste cambios aún')).toBeTruthy();
    expect(screen.getByText('No tenés productos cargados')).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('home-section-changes')).toBeLessThan(tree.indexOf('No hiciste cambios aún'));
    expect(tree.indexOf('No hiciste cambios aún')).toBeLessThan(tree.indexOf('home-section-recent'));
    expect(tree.indexOf('home-section-recent')).toBeLessThan(tree.indexOf('No tenés productos cargados'));
  });

  it('only shows the message of the list that is empty', async () => {
    await load({ changes: [change()] });
    expect(screen.queryByText('No hiciste cambios aún')).toBeNull();
    expect(screen.getByText('No tenés productos cargados')).toBeTruthy();
  });

  it('shows the message of the changes alone when there are products', async () => {
    await load({ products: [product({ id: 2, nombre: 'Yogur' })] });
    expect(screen.getByText('No hiciste cambios aún')).toBeTruthy();
    expect(screen.queryByText('No tenés productos cargados')).toBeNull();
  });
});

describe('HomeScreen - titles and the stock part of the entries', () => {
  it('keeps "Últimos Cambios" as the title of the section of the home', async () => {
    await load({ changes: [change()] });
    expect(screen.getByText('Últimos Cambios')).toBeTruthy();
    expect(screen.queryByText('Historial de Cambios')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('home-section-changes').props.style).textTransform).toBe('uppercase');
  });

  it('opens the product information when the stock part of a change is tapped', async () => {
    await load({ changes: [change()] });
    fireEvent.press(screen.getByTestId('change-stock-event-1'));
    expect(screen.getByTestId('product-detail-card')).toBeTruthy();
    expect(screen.getByText('Información del Producto')).toBeTruthy();
    expect(screen.getByTestId('detail-nombre').props.children).toBe('Leche');
  });

  it('opens the product information when the stock of a recent product is tapped', async () => {
    await load({ products: [product({ id: 2, nombre: 'Yogur', stock: 9 })] });
    fireEvent.press(screen.getByText('Stock: 9'));
    expect(screen.getByTestId('detail-nombre').props.children).toBe('Yogur');
  });

  it('calls the history window "Historial de Cambios" and the information window "Información del Producto"', async () => {
    await load({ changes: [change()] });
    fireEvent.press(screen.getByTestId('home-changes-more'));
    await waitFor(() => expect(screen.getByText('Historial de Cambios')).toBeTruthy());
    fireEvent.press(screen.getAllByTestId('change-stock-event-1')[1]);
    expect(screen.getByText('Información del Producto')).toBeTruthy();
  });
});
