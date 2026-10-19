import React from 'react';
import { Modal, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import StockTotalModal from '../src/components/StockTotalModal';
import { productService } from '@/services/productService';
import { Product, ProductGroupDetail } from '@/types/product';

jest.mock('@/services/productService', () => ({
  productService: {
    suggestGroups: jest.fn(),
    getProductGroup: jest.fn(),
  },
}));

const mockedProducts = productService as jest.Mocked<typeof productService>;

const lot = (overrides: Partial<Product> = {}): Product => ({
  id: 1,
  user_id: 'u1',
  nombre: 'Leche',
  marca: 'Ser',
  categoria: 'Lacteos',
  stock: 4,
  ubicacion: 'Heladera',
  vencimiento: '2027-03-01',
  imagen_url: 'https://cdn/a.jpg',
  ...overrides,
});

const GROUP: ProductGroupDetail = {
  nombre: 'Leche',
  categoria: 'Lacteos',
  stock_total: 12,
  lotes: 3,
  proximo_vencimiento: '2027-01-01',
  productos: [
    lot({ id: 1, stock: 4, vencimiento: '2027-01-01', ubicacion: 'Heladera' }),
    lot({ id: 2, stock: 6, vencimiento: '2027-03-01', ubicacion: 'Freezer', imagen_url: undefined }),
    lot({ id: 3, stock: 2, vencimiento: undefined, ubicacion: undefined }),
  ],
};

const SUGGESTIONS = [
  { nombre: 'Leche', categoria: 'Lacteos', stock_total: 12, lotes: 3 },
  { nombre: 'Leche entera', categoria: 'Lacteos', stock_total: 50, lotes: 1 },
];

const open = (props: Partial<React.ComponentProps<typeof StockTotalModal>> = {}) => {
  const onClose = jest.fn();
  const utils = render(<StockTotalModal visible onClose={onClose} {...props} />);
  return { onClose, ...utils };
};

const type = async (text: string) => {
  fireEvent.changeText(screen.getByTestId('stock-total-input'), text);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(350);
  });
};

const pick = async (index = 0) => {
  mockedProducts.getProductGroup.mockResolvedValue(GROUP);
  await type('Lec');
  await act(async () => {
    fireEvent.press(screen.getByTestId(`stock-total-suggestion-${index}`));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockedProducts.suggestGroups.mockResolvedValue(SUGGESTIONS);
  mockedProducts.getProductGroup.mockResolvedValue(GROUP);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('StockTotalModal - window', () => {
  it('renders nothing while hidden', () => {
    render(<StockTotalModal visible={false} onClose={jest.fn()} />);
    expect(screen.queryByText('Stock Total de Producto')).toBeNull();
  });

  it('is a full screen window with the title and a back button', () => {
    const { onClose, UNSAFE_getByType } = open();
    const modal = UNSAFE_getByType(Modal);
    expect(modal.props.animationType).toBe('slide');
    expect(modal.props.transparent).toBeFalsy();
    expect(modal.props.statusBarTranslucent).toBe(true);
    expect(modal.props.navigationBarTranslucent).toBe(true);
    expect(screen.getByText('Stock Total de Producto')).toBeTruthy();
    fireEvent.press(screen.getByTestId('stock-total-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
    modal.props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('lets a suggestion be tapped with the keyboard open', () => {
    const { UNSAFE_getByType } = open();
    const { ScrollView } = require('react-native');
    expect(UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('starts empty each time it is opened', async () => {
    const { rerender } = open();
    await pick();
    rerender(<StockTotalModal visible={false} onClose={jest.fn()} />);
    rerender(<StockTotalModal visible onClose={jest.fn()} />);
    expect(screen.getByTestId('stock-total-input').props.value).toBe('');
    expect(screen.queryByTestId('stock-total-summary')).toBeNull();
  });
});

describe('StockTotalModal - search by name', () => {
  it('suggests products while the name is typed, with their total stock', async () => {
    open();
    await type('Lec');
    expect(mockedProducts.suggestGroups).toHaveBeenCalledWith('Lec');
    expect(screen.getByTestId('stock-total-suggestion-0')).toBeTruthy();
    expect(screen.getByText('Leche')).toBeTruthy();
    expect(screen.getByText('Leche entera')).toBeTruthy();
    expect(screen.getByText('Lacteos · Stock total: 12')).toBeTruthy();
    expect(screen.queryByText(/Ser/)).toBeNull();
  });

  it('does not search with less than two letters', async () => {
    open();
    await type('L');
    expect(mockedProducts.suggestGroups).not.toHaveBeenCalled();
    expect(screen.queryByTestId('stock-total-suggestions')).toBeNull();
    expect(screen.queryByTestId('stock-total-no-results')).toBeNull();
  });

  it('says so when no product has that name', async () => {
    mockedProducts.suggestGroups.mockResolvedValue([]);
    open();
    await type('zzz');
    expect(screen.getByText('No hay productos con ese nombre')).toBeTruthy();
  });

  it('shows no hint if the search fails', async () => {
    mockedProducts.suggestGroups.mockRejectedValue(new Error('boom'));
    open();
    await type('Lec');
    expect(screen.queryByTestId('stock-total-suggestions')).toBeNull();
    expect(screen.queryByTestId('stock-total-no-results')).toBeNull();
  });

  it('shows the name, category and total stock of the chosen product, without the brand', async () => {
    open();
    await pick();
    expect(mockedProducts.getProductGroup).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Leche', categoria: 'Lacteos' }));
    expect(screen.getByTestId('stock-total-nombre').props.children).toBe('Leche');
    expect(screen.queryByTestId('stock-total-marca')).toBeNull();
    expect(within(screen.getByTestId('stock-total-summary')).getByText('Categoría: Lacteos')).toBeTruthy();
    expect(screen.getByTestId('stock-total-value').props.children).toBe('12 unidades');
    expect(screen.getByTestId('stock-total-lots').props.children).toBe('3 productos con el mismo nombre y categoría');
    expect(screen.getByTestId('stock-total-input').props.value).toBe('Leche');
    expect(screen.queryByTestId('stock-total-suggestions')).toBeNull();
  });

  it('highlights the total stock with the main color of the app', async () => {
    const { Colors } = require('../src/constants/colors');
    open();
    await pick();
    expect(StyleSheet.flatten(screen.getByTestId('stock-total-value').props.style).color).toBe(Colors.primary);
  });

  it('uses the singular for one unit and one product', async () => {
    mockedProducts.getProductGroup.mockResolvedValue({
      nombre: 'Agua', categoria: 'Bebidas', stock_total: 1, lotes: 1, productos: [lot({ id: 9, nombre: 'Agua', marca: undefined, stock: 1 })],
    });
    open({ initial: { nombre: 'Agua', categoria: 'Bebidas' } });
    await act(async () => {});
    expect(screen.getByTestId('stock-total-value').props.children).toBe('1 unidad');
    expect(screen.getByTestId('stock-total-lots').props.children).toBe('1 producto con el mismo nombre y categoría');
  });

  it('gives every product of the list the same height', async () => {
    open();
    await pick();
    const heights = ['lot-row-1', 'lot-row-2', 'lot-row-3'].map(id => StyleSheet.flatten(screen.getByTestId(id).props.style).height);
    expect(heights[0]).toBeGreaterThan(0);
    expect(new Set(heights).size).toBe(1);
  });

  it('scrolls only the list of found products: the name and the summary stay fixed', async () => {
    open();
    await pick();
    const scroll = within(screen.getByTestId('stock-total-lots-scroll'));
    ['lot-row-1', 'lot-row-2', 'lot-row-3'].forEach(id => expect(scroll.getByTestId(id)).toBeTruthy());
    expect(scroll.queryByTestId('stock-total-summary')).toBeNull();
    expect(scroll.queryByTestId('stock-total-input')).toBeNull();
    expect(scroll.queryByText('Productos encontrados')).toBeNull();
    expect(screen.getByTestId('stock-total-summary')).toBeTruthy();
    expect(screen.getByTestId('stock-total-input')).toBeTruthy();
  });

  it('keeps the search field in place while the user types after choosing a product', async () => {
    open();
    await pick();
    const input = screen.getByTestId('stock-total-input');
    fireEvent.changeText(input, 'Yog');
    expect(screen.getByTestId('stock-total-input')).toBe(input);
    expect(screen.queryByTestId('stock-total-lots-scroll')).toBeNull();
  });

  it('lists every product found below the summary, under the title "Productos encontrados"', async () => {
    open();
    await pick();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('stock-total-summary')).toBeLessThan(tree.indexOf('Productos encontrados'));
    expect(tree.indexOf('Productos encontrados')).toBeLessThan(tree.indexOf('lot-row-1'));
    expect(screen.queryByText(/mismo nombre, marca/i)).toBeNull();
    ['lot-row-1', 'lot-row-2', 'lot-row-3'].forEach(id => expect(screen.getByTestId(id)).toBeTruthy());
    expect(screen.getByText('Stock: 6')).toBeTruthy();
    expect(screen.getByText('Vence: 2027-03-01')).toBeTruthy();
    expect(screen.getByText(/Freezer/)).toBeTruthy();
  });

  it('opens the image of a product full screen', async () => {
    open();
    await pick();
    fireEvent.press(screen.getAllByTestId('product-image-button')[0]);
    expect(screen.getByTestId('zoom-image').props.source).toEqual({ uri: 'https://cdn/a.jpg' });
  });

  it('opens the product information window from a product, without the "Stock total" button', async () => {
    open({ generalRules: { coverageDays: 7, expiryDays: 10 } });
    await pick();
    fireEvent.press(screen.getByTestId('lot-info-2'));
    expect(screen.getByTestId('product-detail-card')).toBeTruthy();
    expect(screen.getByTestId('detail-nombre').props.children).toBe('Leche');
    expect(screen.getByTestId('detail-stock').props.children).toEqual('6');
    expect(screen.getByTestId('detail-stock-minimo').props.children).toEqual('7 unidades');
    expect(screen.queryByTestId('detail-total-button')).toBeNull();
    fireEvent.press(screen.getByTestId('product-detail-close'));
    expect(screen.queryByTestId('product-detail-card')).toBeNull();
  });

  it('forgets the chosen product when the name is edited, and suggests again', async () => {
    open();
    await pick();
    await type('Lech');
    expect(screen.queryByTestId('stock-total-summary')).toBeNull();
    expect(mockedProducts.suggestGroups).toHaveBeenLastCalledWith('Lech');
    expect(screen.getByTestId('stock-total-suggestion-0')).toBeTruthy();
  });

  it('shows a readable error when the total cannot be loaded, and clears it when the name is edited', async () => {
    mockedProducts.getProductGroup.mockRejectedValue(new Error('boom'));
    open();
    await type('Lec');
    await act(async () => {
      fireEvent.press(screen.getByTestId('stock-total-suggestion-0'));
    });
    expect(screen.getByText('No se pudo cargar el stock total. Intentá de nuevo.')).toBeTruthy();
    expect(screen.queryByTestId('stock-total-loading')).toBeNull();
    await type('Lech');
    expect(screen.queryByTestId('stock-total-error')).toBeNull();
  });

  it('ignores the answer of an old selection if the name was edited meanwhile', async () => {
    let resolveGroup: (g: ProductGroupDetail) => void = () => {};
    mockedProducts.getProductGroup.mockReturnValue(new Promise<ProductGroupDetail>(resolve => { resolveGroup = resolve; }));
    open();
    await type('Lec');
    fireEvent.press(screen.getByTestId('stock-total-suggestion-0'));
    expect(screen.getByTestId('stock-total-loading')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('stock-total-input'), 'Otra cosa');
    await act(async () => { resolveGroup(GROUP); });
    expect(screen.queryByTestId('stock-total-summary')).toBeNull();
  });
});

describe('StockTotalModal - coming from a product', () => {
  it('opens straight on the total of that product', async () => {
    open({ initial: { nombre: 'Leche', categoria: 'Lacteos' } });
    await waitFor(() => expect(screen.getByTestId('stock-total-value')).toBeTruthy());
    expect(mockedProducts.getProductGroup).toHaveBeenCalledWith({ nombre: 'Leche', categoria: 'Lacteos' });
    expect(screen.getByTestId('stock-total-input').props.value).toBe('Leche');
    expect(screen.getByTestId('stock-total-value').props.children).toBe('12 unidades');
    expect(mockedProducts.suggestGroups).not.toHaveBeenCalled();
    expect(screen.getByTestId('lot-row-1')).toBeTruthy();
  });

  it('shows the total with no search when it is opened without a product', () => {
    open({ initial: null });
    expect(mockedProducts.getProductGroup).not.toHaveBeenCalled();
    expect(screen.getByTestId('stock-total-input').props.value).toBe('');
  });
});

describe('StockTotalModal - choosing which products add up', () => {
  const checked = (id: number) => screen.getByTestId(`lot-check-${id}`).props.accessibilityState.checked;
  const totalText = () => screen.getByTestId('stock-total-value').props.children;
  const countText = () => screen.getByTestId('stock-total-lots').props.children;
  const toggle = (id: number) => fireEvent.press(screen.getByTestId(`lot-check-${id}`));

  it('has a checkbox on every product, all of them checked at the start', async () => {
    open();
    await pick();
    [1, 2, 3].forEach(id => expect(checked(id)).toBe(true));
    expect(totalText()).toBe('12 unidades');
    expect(countText()).toBe('3 productos con el mismo nombre y categoría');
  });

  it('puts the checkbox on the right of each product', async () => {
    open();
    await pick();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('"lot-info-1"')).toBeLessThan(tree.indexOf('"lot-check-1"'));
  });

  it('recalculates the total stock and the number of products when one is unchecked', async () => {
    open();
    await pick();
    toggle(2);
    expect(checked(2)).toBe(false);
    expect(checked(1)).toBe(true);
    expect(totalText()).toBe('6 unidades');
    expect(countText()).toBe('2 productos con el mismo nombre y categoría');
  });

  it('adds the product back when it is checked again', async () => {
    open();
    await pick();
    toggle(2);
    toggle(2);
    expect(checked(2)).toBe(true);
    expect(totalText()).toBe('12 unidades');
    expect(countText()).toBe('3 productos con el mismo nombre y categoría');
  });

  it('adds up only the checked ones, and uses the singular for a single one', async () => {
    open();
    await pick();
    toggle(1);
    toggle(3);
    expect(totalText()).toBe('6 unidades');
    expect(countText()).toBe('1 producto con el mismo nombre y categoría');
  });

  it('shows zero when every product is unchecked, and the list stays there', async () => {
    open();
    await pick();
    [1, 2, 3].forEach(toggle);
    expect(totalText()).toBe('0 unidades');
    expect(countText()).toBe('0 productos con el mismo nombre y categoría');
    expect(screen.getByTestId('lot-row-1')).toBeTruthy();
  });

  it('checks every product again when another product is searched', async () => {
    open();
    await pick();
    toggle(1);
    await type('Lech');
    mockedProducts.getProductGroup.mockResolvedValue(GROUP);
    await act(async () => {
      fireEvent.press(screen.getByTestId('stock-total-suggestion-0'));
    });
    [1, 2, 3].forEach(id => expect(checked(id)).toBe(true));
    expect(totalText()).toBe('12 unidades');
  });

  it('keeps the checkbox from opening the product information, and the information from changing the selection', async () => {
    open();
    await pick();
    toggle(2);
    expect(screen.queryByTestId('product-detail-card')).toBeNull();
    fireEvent.press(screen.getByTestId('lot-info-2'));
    expect(screen.getByTestId('product-detail-card')).toBeTruthy();
    fireEvent.press(screen.getByTestId('product-detail-close'));
    expect(checked(2)).toBe(false);
  });
});
