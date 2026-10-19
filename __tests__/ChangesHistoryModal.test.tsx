import React from 'react';
import { Modal, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ChangesHistoryModal from '../src/components/ChangesHistoryModal';
import { CHANGE_ROW_HEIGHT } from '../src/components/RecentChangeRow';
import { productService } from '@/services/productService';
import { Product, StockChange } from '@/types/product';

jest.mock('@/services/productService', () => ({
  productService: { getRecentChanges: jest.fn() },
}));

const mockedProducts = productService as jest.Mocked<typeof productService>;

const lot = (id: number, overrides: Partial<Product> = {}): Product => ({
  id,
  user_id: 'u1',
  nombre: `Producto ${id}`,
  marca: 'Ser',
  categoria: 'Lacteos',
  stock: 5,
  ...overrides,
});

const change = (n: number, overrides: Partial<StockChange> = {}): StockChange => ({
  id: `event-${n}`,
  kind: 'entrada',
  stock_before: n,
  stock_after: n + 1,
  quantity: 1,
  occurred_at: '2026-10-10T12:00:00Z',
  producto: lot(n),
  ...overrides,
});

const page = (from: number, count: number) => Array.from({ length: count }, (_, i) => change(from + i));

const open = (props: Partial<React.ComponentProps<typeof ChangesHistoryModal>> = {}) => {
  const onClose = jest.fn();
  const utils = render(<ChangesHistoryModal visible onClose={onClose} {...props} />);
  return { onClose, ...utils };
};

const rows = () => screen.queryAllByTestId(/^change-row-/);

beforeEach(() => {
  jest.clearAllMocks();
  mockedProducts.getRecentChanges.mockResolvedValue([]);
});

describe('ChangesHistoryModal - window', () => {
  it('renders nothing while hidden and does not ask for changes', () => {
    render(<ChangesHistoryModal visible={false} onClose={jest.fn()} />);
    expect(screen.queryByText('Historial de Cambios')).toBeNull();
    expect(mockedProducts.getRecentChanges).not.toHaveBeenCalled();
  });

  it('is a full screen window with the title and a back button', async () => {
    const { onClose, UNSAFE_getByType } = open();
    await act(async () => {});
    const modal = UNSAFE_getByType(Modal);
    expect(modal.props.animationType).toBe('slide');
    expect(modal.props.transparent).toBeFalsy();
    expect(modal.props.statusBarTranslucent).toBe(true);
    expect(modal.props.navigationBarTranslucent).toBe(true);
    expect(screen.getByText('Historial de Cambios')).toBeTruthy();
    expect(screen.queryByText('Últimos Cambios')).toBeNull();
    fireEvent.press(screen.getByTestId('changes-history-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
    modal.props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows a loading indicator while the first changes arrive', async () => {
    let resolve: (c: StockChange[]) => void = () => {};
    mockedProducts.getRecentChanges.mockReturnValue(new Promise<StockChange[]>(r => { resolve = r; }));
    open();
    expect(screen.getByTestId('changes-history-loading')).toBeTruthy();
    expect(screen.queryByTestId('changes-history-empty')).toBeNull();
    await act(async () => { resolve(page(1, 2)); });
    expect(screen.queryByTestId('changes-history-loading')).toBeNull();
  });

  it('says so when there are no changes', async () => {
    open();
    await waitFor(() => expect(screen.getByText('No hiciste cambios aún')).toBeTruthy());
    expect(screen.queryByTestId('changes-load-more')).toBeNull();
  });
});

describe('ChangesHistoryModal - list', () => {
  it('asks for the first ten changes', async () => {
    mockedProducts.getRecentChanges.mockResolvedValue(page(1, 10));
    open();
    await waitFor(() => expect(rows()).toHaveLength(10));
    expect(mockedProducts.getRecentChanges).toHaveBeenCalledTimes(1);
    expect(mockedProducts.getRecentChanges).toHaveBeenCalledWith(10, 0);
  });

  it('shows each entry in the same format as the list of the home, with the same height', async () => {
    mockedProducts.getRecentChanges.mockResolvedValue([
      change(1, { kind: 'salida', stock_before: 8, stock_after: 0, occurred_at: '2026-10-10T20:43:23Z' }),
    ]);
    open();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.getByText('Producto 1')).toBeTruthy();
    expect(screen.getByText('Ser')).toBeTruthy();
    expect(screen.getByText('Categoría: Lacteos')).toBeTruthy();
    expect(screen.getByText('Salida de producto')).toBeTruthy();
    expect(screen.getByTestId('change-before-event-1').props.children).toBe('8');
    expect(screen.getByTestId('change-after-event-1').props.children).toBe('0');
    expect(screen.getByTestId('change-date-event-1').props.children).toBe('10/10/2026 17:43');
    expect(StyleSheet.flatten(screen.getByTestId('change-row-event-1').props.style).height).toBe(CHANGE_ROW_HEIGHT);
  });

  it('puts the "Cargar más" button below the ten entries', async () => {
    mockedProducts.getRecentChanges.mockResolvedValue(page(1, 10));
    open();
    await waitFor(() => expect(screen.getByTestId('changes-load-more')).toBeTruthy());
    expect(screen.getByText('Cargar más')).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('change-row-event-10')).toBeLessThan(tree.indexOf('changes-load-more'));
  });

  it('does not show the button when there are fewer than ten changes', async () => {
    mockedProducts.getRecentChanges.mockResolvedValue(page(1, 7));
    open();
    await waitFor(() => expect(rows()).toHaveLength(7));
    expect(screen.queryByTestId('changes-load-more')).toBeNull();
  });

  it('loads ten more when the button is pressed, and keeps the button below everything', async () => {
    mockedProducts.getRecentChanges.mockResolvedValueOnce(page(1, 10)).mockResolvedValueOnce(page(11, 10));
    open();
    await waitFor(() => expect(screen.getByTestId('changes-load-more')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId('changes-load-more'));
    });
    expect(mockedProducts.getRecentChanges).toHaveBeenLastCalledWith(10, 10);
    expect(rows()).toHaveLength(20);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('change-row-event-20')).toBeLessThan(tree.indexOf('changes-load-more'));
    expect(tree.indexOf('change-row-event-10')).toBeLessThan(tree.indexOf('change-row-event-11'));
  });

  it('keeps asking for the following ten each time', async () => {
    mockedProducts.getRecentChanges
      .mockResolvedValueOnce(page(1, 10))
      .mockResolvedValueOnce(page(11, 10))
      .mockResolvedValueOnce(page(21, 10));
    open();
    await waitFor(() => expect(screen.getByTestId('changes-load-more')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('changes-load-more')); });
    await act(async () => { fireEvent.press(screen.getByTestId('changes-load-more')); });
    expect(mockedProducts.getRecentChanges).toHaveBeenLastCalledWith(10, 20);
    expect(rows()).toHaveLength(30);
  });

  it('hides the button once there is nothing else to load', async () => {
    mockedProducts.getRecentChanges.mockResolvedValueOnce(page(1, 10)).mockResolvedValueOnce(page(11, 4));
    open();
    await waitFor(() => expect(screen.getByTestId('changes-load-more')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('changes-load-more')); });
    expect(rows()).toHaveLength(14);
    expect(screen.queryByTestId('changes-load-more')).toBeNull();
  });

  it('hides the button when the next page comes back empty', async () => {
    mockedProducts.getRecentChanges.mockResolvedValueOnce(page(1, 10)).mockResolvedValueOnce([]);
    open();
    await waitFor(() => expect(screen.getByTestId('changes-load-more')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('changes-load-more')); });
    expect(rows()).toHaveLength(10);
    expect(screen.queryByTestId('changes-load-more')).toBeNull();
  });

  it('shows a loading state on the button and ignores a second press while loading', async () => {
    let resolve: (c: StockChange[]) => void = () => {};
    mockedProducts.getRecentChanges
      .mockResolvedValueOnce(page(1, 10))
      .mockReturnValueOnce(new Promise<StockChange[]>(r => { resolve = r; }));
    open();
    await waitFor(() => expect(screen.getByTestId('changes-load-more')).toBeTruthy());
    fireEvent.press(screen.getByTestId('changes-load-more'));
    expect(screen.getByTestId('changes-more-loading')).toBeTruthy();
    fireEvent.press(screen.getByTestId('changes-load-more'));
    expect(mockedProducts.getRecentChanges).toHaveBeenCalledTimes(2);
    await act(async () => { resolve(page(11, 10)); });
    expect(screen.queryByTestId('changes-more-loading')).toBeNull();
    expect(rows()).toHaveLength(20);
  });

  it('does not repeat an entry that was already in the list', async () => {
    mockedProducts.getRecentChanges
      .mockResolvedValueOnce(page(1, 10))
      .mockResolvedValueOnce([change(10), ...page(11, 9)]);
    open();
    await waitFor(() => expect(screen.getByTestId('changes-load-more')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('changes-load-more')); });
    expect(rows()).toHaveLength(19);
  });

  it('shows a readable error if the first changes cannot be loaded', async () => {
    mockedProducts.getRecentChanges.mockRejectedValue(new Error('boom'));
    open();
    await waitFor(() => expect(screen.getByText('No se pudieron cargar los cambios. Intentá de nuevo.')).toBeTruthy());
    expect(screen.queryByTestId('changes-history-empty')).toBeNull();
  });

  it('keeps the list and the button when loading more fails, and lets the user try again', async () => {
    mockedProducts.getRecentChanges
      .mockResolvedValueOnce(page(1, 10))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(page(11, 10));
    open();
    await waitFor(() => expect(screen.getByTestId('changes-load-more')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('changes-load-more')); });
    expect(screen.getByText('No se pudieron cargar los cambios. Intentá de nuevo.')).toBeTruthy();
    expect(rows()).toHaveLength(10);
    await act(async () => { fireEvent.press(screen.getByTestId('changes-load-more')); });
    expect(screen.queryByTestId('changes-history-error')).toBeNull();
    expect(rows()).toHaveLength(20);
  });

  it('starts from the first ten again every time it is opened', async () => {
    mockedProducts.getRecentChanges.mockResolvedValue(page(1, 10));
    const { rerender } = open();
    await waitFor(() => expect(rows()).toHaveLength(10));
    rerender(<ChangesHistoryModal visible={false} onClose={jest.fn()} />);
    rerender(<ChangesHistoryModal visible onClose={jest.fn()} />);
    await waitFor(() => expect(mockedProducts.getRecentChanges).toHaveBeenCalledTimes(2));
    expect(mockedProducts.getRecentChanges).toHaveBeenLastCalledWith(10, 0);
    await waitFor(() => expect(rows()).toHaveLength(10));
  });

  it('ignores the answer of an old load after the window was closed and opened again', async () => {
    let resolveOld: (c: StockChange[]) => void = () => {};
    mockedProducts.getRecentChanges
      .mockReturnValueOnce(new Promise<StockChange[]>(r => { resolveOld = r; }))
      .mockResolvedValueOnce(page(100, 2));
    const { rerender } = open();
    rerender(<ChangesHistoryModal visible={false} onClose={jest.fn()} />);
    rerender(<ChangesHistoryModal visible onClose={jest.fn()} />);
    await waitFor(() => expect(rows()).toHaveLength(2));
    await act(async () => { resolveOld(page(1, 10)); });
    expect(rows()).toHaveLength(2);
    expect(screen.getByText('Producto 100')).toBeTruthy();
  });
});

describe('ChangesHistoryModal - product information', () => {
  it('opens the information of the product of an entry, without the "Stock total" button', async () => {
    mockedProducts.getRecentChanges.mockResolvedValue([change(1, { producto: lot(1, { nombre: 'Leche', descripcion: 'Entera' }) })]);
    open({ generalRules: { coverageDays: 7, expiryDays: 10 } });
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.press(screen.getByTestId('change-info-event-1'));
    expect(screen.getByTestId('product-detail-card')).toBeTruthy();
    expect(screen.getByTestId('detail-nombre').props.children).toBe('Leche');
    expect(screen.getByTestId('detail-descripcion').props.children).toEqual('Entera');
    expect(screen.getByTestId('detail-stock-minimo').props.children).toEqual('7 unidades');
    expect(screen.queryByTestId('detail-total-button')).toBeNull();
    expect(screen.queryByText('Stock total')).toBeNull();
  });

  it('closes the information and goes back to the list', async () => {
    mockedProducts.getRecentChanges.mockResolvedValue(page(1, 2));
    open();
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.press(screen.getByTestId('change-info-event-2'));
    fireEvent.press(screen.getByTestId('product-detail-close'));
    expect(screen.queryByTestId('product-detail-card')).toBeNull();
    expect(rows()).toHaveLength(2);
  });

  it('opens the product image full screen', async () => {
    mockedProducts.getRecentChanges.mockResolvedValue([change(1, { producto: lot(1, { imagen_url: 'https://cdn/a.jpg' }) })]);
    open();
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.press(screen.getByTestId('product-image-button'));
    expect(screen.getByTestId('zoom-image').props.source).toEqual({ uri: 'https://cdn/a.jpg' });
  });

  it('opens the product information when the stock part of an entry is tapped', async () => {
    mockedProducts.getRecentChanges.mockResolvedValue([change(1, { producto: lot(1, { nombre: 'Leche' }) })]);
    open();
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.press(screen.getByTestId('change-stock-event-1'));
    expect(screen.getByText('Información del Producto')).toBeTruthy();
    expect(screen.getByTestId('detail-nombre').props.children).toBe('Leche');
    expect(screen.queryByTestId('detail-total-button')).toBeNull();
  });
});
