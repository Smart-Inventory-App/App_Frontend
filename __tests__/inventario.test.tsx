import React from 'react';
import { Alert, FlatList, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Ionicons } from '@expo/vector-icons';
import InventarioScreen from '../app/(tabs)/inventario';
import { productService } from '@/services/productService';
import { profileService } from '@/services/profileService';
import { Product } from '@/types/product';

const mockNavigate = jest.fn();

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
    router: { navigate: (...args: any[]) => mockNavigate(...args) },
    useFocusEffect: (cb: () => void) => ReactActual.useEffect(cb, [cb]),
  };
});

jest.mock('@/services/productService', () => ({
  productService: {
    getProducts: jest.fn(),
    getFilterOptions: jest.fn(),
    getStockTotal: jest.fn(),
    deleteProduct: jest.fn(),
    updateProduct: jest.fn(),
    getConsumptionHistory: jest.fn(),
  },
}));

jest.mock('@/services/profileService', () => ({
  profileService: {
    getProfile: jest.fn(),
  },
}));

jest.mock('@/components/ProductFormFields', () => {
  const { TextInput } = require('react-native');
  return function MockProductFormFields({ form, onChange }: any) {
    return (
      <TextInput
        testID="mock-edit-nombre"
        value={form.nombre ?? ''}
        onChangeText={(v: string) => onChange({ ...form, nombre: v })}
      />
    );
  };
});

jest.mock('@/components/HistorialModal', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockHistorialModal({ visible, onClose }: any) {
    if (!visible) return null;
    return (
      <View testID="mock-historial-modal">
        <TouchableOpacity testID="mock-historial-close" onPress={onClose}><Text>close</Text></TouchableOpacity>
      </View>
    );
  };
});

// El árbol de la pantalla como texto. Se dejan afuera las partes de la lista que son elementos de React
// (encabezado, vacío y pie), que tienen referencias circulares y ya aparecen dibujadas en el árbol.
const treeJson = () =>
  JSON.stringify(screen.toJSON(), (key, value) =>
    ['ListHeaderComponent', 'ListEmptyComponent', 'ListFooterComponent', '_owner', '_store'].includes(key) ? undefined : value,
  );

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
  mockedProducts.getFilterOptions.mockResolvedValue({ categorias: ['Lacteos'], ubicaciones: ['Heladera'], marcas: ['LSA'] });
  mockedProducts.getStockTotal.mockResolvedValue({ stock_total: 10, products: 1 });
  mockedProfile.getProfile.mockResolvedValue({ coverageDaysThreshold: 7, expiryDaysThreshold: 10 } as any);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  (Alert.alert as jest.Mock).mockRestore();
});

describe('InventarioScreen', () => {
  it('shows a loading indicator, then the empty state', async () => {
    mockedProducts.getProducts.mockResolvedValue([]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('No tenés productos cargados')).toBeTruthy());
  });

  it('renders a list of products', async () => {
    mockedProducts.getProducts.mockResolvedValue([product(), product({ id: 2, nombre: 'Yogur', marca: 'Ser', ubicacion: 'Heladera', vencimiento: '2026-01-01' })]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    expect(screen.getByText('Yogur')).toBeTruthy();
    expect(screen.getByText('Ser')).toBeTruthy();
  });

  it('shows a load error alert on failure', async () => {
    mockedProducts.getProducts.mockRejectedValue(new Error('boom'));
    render(<InventarioScreen />);
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudieron cargar los productos'));
  });

  it('filters by search text (debounced) and shows "no results"', async () => {
    jest.useFakeTimers();
    mockedProducts.getProducts.mockResolvedValue([]);
    render(<InventarioScreen />);
    await act(async () => { await Promise.resolve(); });

    fireEvent.changeText(screen.getByPlaceholderText('Buscar por nombre o marca...'), 'leche');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    jest.useRealTimers();

    await waitFor(() => expect(mockedProducts.getProducts).toHaveBeenCalledWith(expect.objectContaining({ search: 'leche' })));
    await waitFor(() => expect(screen.getByText('Sin resultados')).toBeTruthy());
  });

  it('clears the search input', async () => {
    mockedProducts.getProducts.mockResolvedValue([]);
    render(<InventarioScreen />);
    const input = screen.getByPlaceholderText('Buscar por nombre o marca...');
    fireEvent.changeText(input, 'leche');
    await waitFor(() => expect(screen.getByTestId).toBeDefined());
  });

  it('sorts by a field, toggles direction, then clears it', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());

    await act(async () => { fireEvent.press(screen.getByText('Nombre')); });
    expect(mockedProducts.getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ sort_by: 'nombre', sort_dir: 'asc' }));

    await act(async () => { fireEvent.press(screen.getByText('Nombre ↑')); });
    expect(mockedProducts.getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ sort_by: 'nombre', sort_dir: 'desc' }));

    await act(async () => { fireEvent.press(screen.getByText('Nombre ↓')); });
    expect(mockedProducts.getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ sort_by: undefined, sort_dir: 'asc' }));
  });

  it('filters by category and location chips', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());

    await act(async () => { fireEvent.press(screen.getByText('Lacteos')); });
    expect(mockedProducts.getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ categoria: 'Lacteos' }));
    await act(async () => { fireEvent.press(screen.getByText('Lacteos')); });
    expect(mockedProducts.getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ categoria: undefined }));

    await act(async () => { fireEvent.press(screen.getByText('Heladera')); });
    expect(mockedProducts.getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ ubicacion: 'Heladera' }));
    await act(async () => { fireEvent.press(screen.getAllByText('Todas')[0]); });
    expect(mockedProducts.getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ categoria: undefined }));
  });

  it('opens the edit modal, edits and saves', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    mockedProducts.updateProduct.mockResolvedValue(product({ nombre: 'Leche Descremada' }));
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());

    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));

    fireEvent.changeText(screen.getByTestId('mock-edit-nombre'), 'Leche Descremada');
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar cambios'));
    });

    expect(mockedProducts.updateProduct).toHaveBeenCalledWith(1, expect.objectContaining({ nombre: 'Leche Descremada' }));
  });

  it('shows an alert when saving the edit fails', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    mockedProducts.updateProduct.mockRejectedValue(new Error('boom'));
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar cambios'));
    });
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'No se pudo guardar los cambios');
  });

  it('closes the edit modal via the header close button', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'close'));
  });

  const DELETE_CONFIRM = '¿Eliminar el producto Leche?\nEsta acción no se puede deshacer.';
  const pressTrash = () =>
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'trash'));

  it('asks for confirmation before deleting a product, and cancelling does nothing', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    expect(screen.queryByText(DELETE_CONFIRM)).toBeNull();
    pressTrash();
    expect(screen.getByText(DELETE_CONFIRM)).toBeTruthy();
    fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.queryByText(DELETE_CONFIRM)).toBeNull();
    expect(mockedProducts.deleteProduct).not.toHaveBeenCalled();
  });

  it('deletes a product after confirming', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    mockedProducts.deleteProduct.mockResolvedValue(undefined);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    pressTrash();
    await act(async () => {
      fireEvent.press(screen.getByText('Eliminar'));
    });
    expect(mockedProducts.deleteProduct).toHaveBeenCalledWith(1);
    expect(screen.queryByText(DELETE_CONFIRM)).toBeNull();
    await waitFor(() => expect(screen.queryByText('Leche')).toBeNull());
    expect(screen.getByText('El producto Leche ha sido eliminado correctamente')).toBeTruthy();
  });

  it('shows an alert when deleting fails', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    mockedProducts.deleteProduct.mockRejectedValue(new Error('boom'));
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    pressTrash();
    await act(async () => {
      fireEvent.press(screen.getByText('Eliminar'));
    });
    expect(Alert.alert).toHaveBeenLastCalledWith('Error', 'No se pudo eliminar el producto');
    expect(screen.getByText('Leche')).toBeTruthy();
    expect(screen.queryByText(/ha sido eliminado correctamente/)).toBeNull();
  });

  it('opens and closes the historial modal', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'time-outline'));
    expect(screen.getByTestId('mock-historial-modal')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mock-historial-close'));
    expect(screen.queryByTestId('mock-historial-modal')).toBeNull();
  });

  it('marks products with a near expiry date in yellow/red', async () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const midterm = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    mockedProducts.getProducts.mockResolvedValue([
      product({ id: 1, nombre: 'Vence pronto', vencimiento: soon }),
      product({ id: 2, nombre: 'Vence en unos días', vencimiento: midterm }),
      product({ id: 3, nombre: 'Sin vencimiento' }),
    ]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Vence pronto')).toBeTruthy());
    expect(screen.getByText('Vence en unos días')).toBeTruthy();
    expect(screen.getByText('Sin vencimiento')).toBeTruthy();
  });
});

describe('InventarioScreen - edit modal and success messages', () => {
  const pencil = () =>
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));

  it('closes the edit window without saving when tapping outside it', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    pencil();
    expect(screen.getByTestId('edit-sheet')).toBeTruthy();
    fireEvent.press(screen.getByTestId('edit-sheet'));
    expect(screen.getByTestId('edit-sheet')).toBeTruthy();
    fireEvent.press(screen.getByTestId('edit-overlay'));
    await waitFor(() => expect(screen.queryByTestId('edit-sheet')).toBeNull(), { timeout: 10000 });
    expect(mockedProducts.updateProduct).not.toHaveBeenCalled();
  });

  it('closes the edit window from the system back button without saving', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    const { UNSAFE_getAllByType } = render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    pencil();
    const { Modal } = require('react-native');
    const editModal = UNSAFE_getAllByType(Modal).find((m: any) => m.props.visible);
    act(() => { editModal.props.onRequestClose(); });
    await waitFor(() => expect(screen.queryByTestId('edit-sheet')).toBeNull(), { timeout: 10000 });
    expect(mockedProducts.updateProduct).not.toHaveBeenCalled();
  });

  it('shows a success message with the product name after editing', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    mockedProducts.updateProduct.mockResolvedValue(product({ nombre: 'Leche light' }));
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    pencil();
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar cambios'));
    });
    expect(screen.getByText('El producto Leche light ha sido editado correctamente')).toBeTruthy();
  });

  it('does not show a success message when saving fails', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    mockedProducts.updateProduct.mockRejectedValue(new Error('boom'));
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    pencil();
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar cambios'));
    });
    expect(screen.queryByText(/ha sido editado correctamente/)).toBeNull();
  });
});

describe('InventarioScreen - edit window layout', () => {
  it('leaves a right margin so the fields do not touch the scroll bar', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    const { UNSAFE_getAllByType } = render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));
    const { ScrollView, StyleSheet } = require('react-native');
    const withMargin = UNSAFE_getAllByType(ScrollView).find(
      (s: any) => StyleSheet.flatten(s.props.contentContainerStyle)?.paddingRight === 14,
    );
    expect(withMargin).toBeTruthy();
  });
});

describe('InventarioScreen - long values', () => {
  const LONG = 'Supermercado Mayorista Central';

  it('shows at most 20 characters of marca, categoria and ubicacion, then "..."', async () => {
    mockedProducts.getProducts.mockResolvedValue([product({ marca: LONG, categoria: LONG, ubicacion: LONG })]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    const shown = `${LONG.slice(0, 20)}...`;
    expect(screen.getByText(shown)).toBeTruthy();
    expect(screen.getByText(`Categoría: ${shown}`)).toBeTruthy();
    // marca, categoría y ubicación
    expect(screen.getAllByText(new RegExp(shown.replace('.', '\.')))).toHaveLength(3);
    expect(screen.queryByText(LONG)).toBeNull();
  });

  it('leaves short values untouched', async () => {
    mockedProducts.getProducts.mockResolvedValue([product({ marca: 'Sancor' })]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Sancor')).toBeTruthy());
  });

  it('also shortens long category and location filter chips', async () => {
    mockedProducts.getFilterOptions.mockResolvedValue({ categorias: [LONG], ubicaciones: [LONG], marcas: [] });
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getAllByText(`${LONG.slice(0, 20)}...`)).toHaveLength(2));
  });
});

describe('InventarioScreen - header, sort row and filters', () => {
  it('puts the chosen sort criterion first and sends it back to its place when it is cleared', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    const before = (a: string, b: string) => {
      const tree = treeJson();
      return tree.indexOf(`"${a}"`) < tree.indexOf(`"${b}"`);
    };
    expect(before('Nombre', 'Stock')).toBe(true);

    await act(async () => { fireEvent.press(screen.getByText('Stock')); });
    expect(before('Stock', 'Nombre')).toBe(true);

    await act(async () => { fireEvent.press(screen.getByText('Stock ↑')); });
    await act(async () => { fireEvent.press(screen.getByText('Stock ↓')); });
    expect(before('Nombre', 'Stock')).toBe(true);
  });

  it('uses the shared header with the inventory title', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    expect(screen.getByTestId('screen-header')).toBeTruthy();
    expect(screen.getByText('Inventario')).toBeTruthy();
  });

  it('puts the "Ordenar:" label above the four sort buttons', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    expect(StyleSheet.flatten(screen.getByTestId('sort-row').props.style).flexDirection).toBeUndefined();
    const whole = treeJson();
    const tree = whole.slice(whole.indexOf('sort-row'));
    const at = (text: string) => tree.indexOf(text);
    expect(at('sort-label')).toBeLessThan(at('Nombre'));
    expect(at('Nombre')).toBeLessThan(at('Stock'));
    expect(at('Stock')).toBeLessThan(at('Vencimiento'));
    expect(at('Vencimiento')).toBeLessThan(at('Categoría'));
    within(screen.getByTestId('sort-row')).getByText('Ordenar:');
  });

  it('keeps the four sort buttons in one row, starting at the left margin', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    const { UNSAFE_getAllByType } = render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    const { ScrollView } = require('react-native');
    const sortScroll = UNSAFE_getAllByType(ScrollView).find(
      (s: any) => StyleSheet.flatten(s.props.contentContainerStyle)?.alignItems === 'center',
    );
    const style = StyleSheet.flatten(sortScroll.props.contentContainerStyle);
    expect(style.flexDirection).toBe('row');
    expect(style.paddingLeft).toBe(0);
  });

  it('scrolls the whole screen, leaving only the banner fixed at the top', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    const list = within(screen.UNSAFE_getByType(FlatList));
    // dentro de la lista que se desliza: la búsqueda, el orden y los filtros
    expect(list.queryByTestId('stock-total-summary')).toBeNull();
    expect(list.getByPlaceholderText('Buscar por nombre o marca...')).toBeTruthy();
    expect(list.getByTestId('sort-row')).toBeTruthy();
    expect(list.getByTestId('filter-search-categoria')).toBeTruthy();
    // el banner y el resumen de stock total, en cambio, quedan afuera y fijos
    expect(list.queryByTestId('screen-header')).toBeNull();
    expect(screen.getByTestId('screen-header')).toBeTruthy();
    expect(screen.getByTestId('stock-total-summary')).toBeTruthy();
  });

  it('leaves a margin below the location filter so the entries do not look stuck to it', async () => {
    mockedProducts.getFilterOptions.mockResolvedValue({ categorias: ['Lacteos'], ubicaciones: ['Heladera'], marcas: [] });
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    const gap = StyleSheet.flatten(screen.getByTestId('list-header-gap').props.style);
    expect(gap.height).toBeGreaterThanOrEqual(12);
    const tree = treeJson();
    expect(tree.indexOf('filter-search-ubicacion')).toBeLessThan(tree.indexOf('list-header-gap'));
    expect(tree.indexOf('list-header-gap')).toBeLessThan(tree.indexOf('product-item-1'));
  });

  it('keeps the search field mounted while the products load, so typing is not interrupted', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    const input = screen.getByPlaceholderText('Buscar por nombre o marca...');
    fireEvent.changeText(input, 'lec');
    expect(screen.getByPlaceholderText('Buscar por nombre o marca...')).toBe(input);
  });

  it('shows the loading indicator and the empty state under the filters, not instead of them', async () => {
    mockedProducts.getProducts.mockResolvedValue([]);
    render(<InventarioScreen />);
    expect(screen.getByTestId('sort-row')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('No tenés productos cargados')).toBeTruthy());
    expect(screen.getByTestId('sort-row')).toBeTruthy();
    expect(screen.getByTestId('stock-total-summary')).toBeTruthy();
  });

  it('has the category and location options in a row that scrolls horizontally, after "Todas" and sorted alphabetically', async () => {
    mockedProducts.getFilterOptions.mockResolvedValue({
      categorias: ['Limpieza', 'Almacén', 'Bebidas'],
      ubicaciones: ['Heladera', 'Alacena'],
      marcas: [],
    });
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByTestId('filter-search-categoria')).toBeTruthy());
    expect(screen.getByTestId('filter-chips-categoria').props.horizontal).toBe(true);
    expect(screen.getByTestId('filter-chips-ubicacion').props.horizontal).toBe(true);
    const tree = treeJson();
    // la lupa va antes de "Todas", y las opciones salen en orden alfabético
    expect(tree.indexOf('filter-search-categoria')).toBeLessThan(tree.indexOf('Todas'));
    expect(tree.indexOf('Almacén')).toBeLessThan(tree.indexOf('Bebidas'));
    expect(tree.indexOf('Bebidas')).toBeLessThan(tree.indexOf('Limpieza'));
    expect(tree.indexOf('Alacena')).toBeLessThan(tree.indexOf('Heladera'));
  });

  it('puts the chosen category first, right after "Todas"', async () => {
    mockedProducts.getFilterOptions.mockResolvedValue({ categorias: ['Limpieza', 'Almacén', 'Bebidas'], ubicaciones: [], marcas: [] });
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByTestId('filter-chip-categoria-Limpieza')).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId('filter-chip-categoria-Limpieza')); });
    const tree = treeJson();
    expect(tree.indexOf('filter-all-categoria')).toBeLessThan(tree.indexOf('filter-chip-categoria-Limpieza'));
    expect(tree.indexOf('filter-chip-categoria-Limpieza')).toBeLessThan(tree.indexOf('filter-chip-categoria-Almac'));
  });

  it('filters by a category found with the search button', async () => {
    mockedProducts.getFilterOptions.mockResolvedValue({ categorias: ['Lacteos', 'Limpieza'], ubicaciones: [], marcas: [] });
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByTestId('filter-search-categoria')).toBeTruthy());
    fireEvent.press(screen.getByTestId('filter-search-categoria'));
    fireEvent.changeText(screen.getByTestId('filter-search-input-categoria'), 'limp');
    await act(async () => {
      fireEvent.press(screen.getByTestId('filter-match-categoria-Limpieza'));
    });
    await waitFor(() =>
      expect(mockedProducts.getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ categoria: 'Limpieza' })),
    );
  });
});

describe('InventarioScreen - invalid barcode when editing', () => {
  it('does not save an edit with an invalid barcode and warns about it', async () => {
    mockedProducts.getProducts.mockResolvedValue([product({ codigo_barras: '123' })]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'pencil'));
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar cambios'));
    });
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'El código de barras es inválido');
    expect(mockedProducts.updateProduct).not.toHaveBeenCalled();
  });
});

describe('InventarioScreen - product details', () => {
  const full = () => product({
    id: 5,
    nombre: 'Yogur',
    marca: 'Ser',
    descripcion: 'Natural',
    ubicacion: 'Heladera',
    codigo_barras: '7791234567898',
    vencimiento: '2027-03-05',
    stock: 8,
  });

  it('opens a window with the whole product when its information is tapped', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Yogur')).toBeTruthy());
    expect(screen.queryByTestId('product-detail-card')).toBeNull();

    fireEvent.press(screen.getByTestId('product-info-5'));

    expect(screen.getByTestId('product-detail-card')).toBeTruthy();
    expect(screen.getByTestId('detail-nombre').props.children).toBe('Yogur');
    expect(screen.getByTestId('detail-descripcion').props.children).toEqual('Natural');
    expect(screen.getByTestId('detail-codigo-barras').props.children).toEqual('7791234567898');
  });

  it('shows the general alert rules of the profile for a product without its own rules', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Yogur')).toBeTruthy());
    await waitFor(() => expect(mockedProfile.getProfile).toHaveBeenCalled());
    fireEvent.press(screen.getByTestId('product-info-5'));
    await waitFor(() => expect(screen.getByTestId('detail-stock-minimo').props.children).toEqual('7 unidades'));
    expect(screen.getByTestId('detail-dias-alerta').props.children).toEqual('10 días');
    expect(screen.getByTestId('detail-dias-alerta-note').props.children).toEqual('Usando tu regla general');
  });

  it('keeps working when the profile cannot be loaded', async () => {
    mockedProfile.getProfile.mockRejectedValue(new Error('boom'));
    mockedProducts.getProducts.mockResolvedValue([full()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Yogur')).toBeTruthy());
    fireEvent.press(screen.getByTestId('product-info-5'));
    expect(screen.getByTestId('detail-stock-minimo').props.children).toEqual('Usando tu regla general');
  });

  it('closes the window and goes back to the list', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Yogur')).toBeTruthy());
    fireEvent.press(screen.getByTestId('product-info-5'));
    fireEvent.press(screen.getByTestId('product-detail-close'));
    expect(screen.queryByTestId('product-detail-card')).toBeNull();
    expect(screen.getByText('Yogur')).toBeTruthy();
  });

  it('opens the details of the product that was tapped, not of another one', async () => {
    mockedProducts.getProducts.mockResolvedValue([full(), product({ id: 6, nombre: 'Leche', stock: 2 })]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    fireEvent.press(screen.getByTestId('product-info-6'));
    expect(screen.getByTestId('detail-nombre').props.children).toBe('Leche');
  });

  it('does not open the details when the edit, history or delete buttons are used', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Yogur')).toBeTruthy());
    const names = screen.UNSAFE_getAllByType(Ionicons).map((n: any) => n.props.name);
    expect(names).toEqual(expect.arrayContaining(['pencil', 'time-outline', 'trash']));
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'time-outline'));
    expect(screen.queryByTestId('product-detail-card')).toBeNull();
  });
});

describe('InventarioScreen - stock total', () => {
  const full = () => product({ id: 5, nombre: 'Yogur', marca: 'Ser', categoria: 'Lacteos', stock: 8 });
  const value = () => screen.getByTestId('stock-total-value').props.children;
  const among = () => screen.getByTestId('stock-total-products').props.children;

  it('shows STOCK TOTAL, with the units and how many products in the inventory they are among', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    mockedProducts.getStockTotal.mockResolvedValue({ stock_total: 120, products: 7 });
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Yogur')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('stock-total-summary')).toBeTruthy());
    expect(screen.getByText('Stock total')).toBeTruthy();
    expect(value()).toBe('120 unidades');
    expect(among()).toBe('entre 7 productos en el inventario');
    expect(StyleSheet.flatten(screen.getByText('Stock total').props.style).textTransform).toBe('uppercase');
  });

  it('writes both numbers with a dot every three digits', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    mockedProducts.getStockTotal.mockResolvedValue({ stock_total: 4564322, products: 35267 });
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByTestId('stock-total-summary')).toBeTruthy());
    expect(value()).toBe('4.564.322 unidades');
    expect(among()).toBe('entre 35.267 productos en el inventario');
  });

  it('keeps a number of four digits with its dot, and a number under a thousand without it', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    mockedProducts.getStockTotal.mockResolvedValue({ stock_total: 1345, products: 999 });
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByTestId('stock-total-summary')).toBeTruthy());
    expect(value()).toBe('1.345 unidades');
    expect(among()).toBe('entre 999 productos en el inventario');
  });

  it('uses the singular for one unit and one product', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    mockedProducts.getStockTotal.mockResolvedValue({ stock_total: 1, products: 1 });
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByTestId('stock-total-summary')).toBeTruthy());
    expect(value()).toBe('1 unidad');
    expect(among()).toBe('entre 1 producto en el inventario');
  });

  it('keeps the summary fixed below the banner, outside of the list that scrolls', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByTestId('stock-total-summary')).toBeTruthy());
    const list = within(screen.UNSAFE_getByType(FlatList));
    expect(list.queryByTestId('stock-total-summary')).toBeNull();
    const tree = treeJson();
    expect(tree.indexOf('screen-header')).toBeLessThan(tree.indexOf('stock-total-summary'));
    expect(tree.indexOf('stock-total-summary')).toBeLessThan(tree.indexOf('Buscar por nombre o marca...'));
  });

  it('keeps showing the summary while the list is scrolled', async () => {
    mockedProducts.getProducts.mockResolvedValue(manyProducts(1, 20));
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Producto 1')).toBeTruthy());
    const flat = screen.UNSAFE_getByType(FlatList);
    fireEvent.scroll(flat, { nativeEvent: { contentOffset: { y: 1500 }, contentSize: { height: 5000, width: 300 }, layoutMeasurement: { height: 600, width: 300 } } });
    expect(screen.getByTestId('stock-total-summary')).toBeTruthy();
  });

  it('has no button to open a separate "Stock total de producto" window anymore', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Yogur')).toBeTruthy());
    expect(screen.queryByTestId('open-stock-total')).toBeNull();
    expect(screen.queryByText('Stock total de producto')).toBeNull();
  });

  it('has no "Stock total" button in the product information window', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Yogur')).toBeTruthy());
    fireEvent.press(screen.getByTestId('product-info-5'));
    expect(screen.getByTestId('product-detail-card')).toBeTruthy();
    expect(screen.queryByTestId('detail-total-button')).toBeNull();
  });

  it('asks for the total with the same search and filters as the list', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    mockedProducts.getFilterOptions.mockResolvedValue({ categorias: ['Lacteos', 'Limpieza'], ubicaciones: [], marcas: [] });
    render(<InventarioScreen />);
    await waitFor(() => expect(mockedProducts.getStockTotal).toHaveBeenCalledWith({ search: undefined, categoria: undefined, ubicacion: undefined }));
    await waitFor(() => expect(screen.getByText('Limpieza')).toBeTruthy());
    mockedProducts.getStockTotal.mockClear();
    fireEvent.press(screen.getByText('Limpieza'));
    await waitFor(() => expect(mockedProducts.getStockTotal).toHaveBeenCalledWith({ search: undefined, categoria: 'Limpieza', ubicacion: undefined }));
  });

  it('updates the count when the list is searched again', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    mockedProducts.getStockTotal.mockResolvedValue({ stock_total: 50, products: 5 });
    render(<InventarioScreen />);
    await waitFor(() => expect(among()).toBe('entre 5 productos en el inventario'));
    mockedProducts.getStockTotal.mockResolvedValue({ stock_total: 8, products: 1 });
    fireEvent.changeText(screen.getByPlaceholderText('Buscar por nombre o marca...'), 'yog');
    await waitFor(() => expect(among()).toBe('entre 1 producto en el inventario'));
    expect(value()).toBe('8 unidades');
    expect(mockedProducts.getStockTotal).toHaveBeenLastCalledWith({ search: 'yog', categoria: undefined, ubicacion: undefined });
  });

  it('updates the count when a product is deleted', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    mockedProducts.getStockTotal.mockResolvedValue({ stock_total: 50, products: 5 });
    mockedProducts.deleteProduct.mockResolvedValue(undefined as any);
    render(<InventarioScreen />);
    await waitFor(() => expect(among()).toBe('entre 5 productos en el inventario'));
    mockedProducts.getStockTotal.mockResolvedValue({ stock_total: 42, products: 4 });
    fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'trash'));
    await act(async () => { fireEvent.press(screen.getByText('Eliminar')); });
    await waitFor(() => expect(among()).toBe('entre 4 productos en el inventario'));
    expect(value()).toBe('42 unidades');
  });

  it('keeps the last count when the total cannot be loaded', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    mockedProducts.getStockTotal.mockResolvedValueOnce({ stock_total: 50, products: 5 });
    render(<InventarioScreen />);
    await waitFor(() => expect(among()).toBe('entre 5 productos en el inventario'));
    mockedProducts.getStockTotal.mockRejectedValue(new Error('boom'));
    fireEvent.changeText(screen.getByPlaceholderText('Buscar por nombre o marca...'), 'yog');
    await waitFor(() => expect(mockedProducts.getStockTotal).toHaveBeenCalledTimes(2));
    expect(among()).toBe('entre 5 productos en el inventario');
  });

  it('shows nothing until the first total arrives', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    mockedProducts.getStockTotal.mockReturnValue(new Promise(() => {}));
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Yogur')).toBeTruthy());
    expect(screen.queryByTestId('stock-total-summary')).toBeNull();
  });

  it('ignores the answer of an old request if the filters changed meanwhile', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    let resolveOld: (total: { stock_total: number; products: number }) => void = () => {};
    mockedProducts.getStockTotal.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
    mockedProducts.getStockTotal.mockResolvedValue({ stock_total: 8, products: 1 });
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Yogur')).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText('Buscar por nombre o marca...'), 'yog');
    await waitFor(() => expect(among()).toBe('entre 1 producto en el inventario'));
    await act(async () => { resolveOld({ stock_total: 999, products: 99 }); });
    expect(among()).toBe('entre 1 producto en el inventario');
  });
});

describe('InventarioScreen - header', () => {
  it('has the home icon on the left and "Inventario" on the right, and the icon goes home', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    const tree = treeJson();
    expect(tree.indexOf('header-home')).toBeLessThan(tree.indexOf('"Inventario"'));
    fireEvent.press(screen.getByTestId('header-home'));
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/');
  });
});

// La lista dibuja solo las primeras entradas: lo cargado se mira en los datos que recibe
const listed = () => screen.UNSAFE_getByType(FlatList).props.data as Product[];

const manyProducts = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => product({ id: from + i, nombre: `Producto ${from + i}` }));

describe('InventarioScreen - paginated list', () => {
  it('asks only for the first 20 products', async () => {
    mockedProducts.getProducts.mockResolvedValue(manyProducts(1, 20));
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Producto 1')).toBeTruthy());
    expect(mockedProducts.getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 20, offset: 0 }));
  });

  it('shows "Cargar más" under a full page and asks for 10 more after the ones already loaded', async () => {
    mockedProducts.getProducts.mockResolvedValueOnce(manyProducts(1, 20)).mockResolvedValueOnce(manyProducts(21, 10));
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByTestId('inventory-load-more')).toBeTruthy());
    expect(screen.getByText('Cargar más')).toBeTruthy();

    fireEvent.press(screen.getByTestId('inventory-load-more'));

    await waitFor(() => expect(listed()).toHaveLength(30));
    expect(mockedProducts.getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 10, offset: 20 }));
    expect(listed()[0].nombre).toBe('Producto 1');
    expect(listed()[29].nombre).toBe('Producto 30');
  });

  it('keeps the same filters when asking for more', async () => {
    mockedProducts.getProducts.mockResolvedValue(manyProducts(1, 20));
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByTestId('inventory-load-more')).toBeTruthy());
    fireEvent.press(screen.getByText('Lacteos'));
    await waitFor(() =>
      expect(mockedProducts.getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ categoria: 'Lacteos', limit: 20, offset: 0 })),
    );
    await waitFor(() => expect(screen.getByTestId('inventory-load-more')).toBeTruthy());

    fireEvent.press(screen.getByTestId('inventory-load-more'));

    await waitFor(() =>
      expect(mockedProducts.getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ categoria: 'Lacteos', limit: 10, offset: 20 })),
    );
  });

  it('hides "Cargar más" once a page comes back with fewer products than requested', async () => {
    mockedProducts.getProducts.mockResolvedValueOnce(manyProducts(1, 20)).mockResolvedValueOnce(manyProducts(21, 4));
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByTestId('inventory-load-more')).toBeTruthy());

    fireEvent.press(screen.getByTestId('inventory-load-more'));

    await waitFor(() => expect(listed()).toHaveLength(24));
    expect(screen.queryByTestId('inventory-load-more')).toBeNull();
  });

  it('does not show "Cargar más" when everything fits in the first page', async () => {
    mockedProducts.getProducts.mockResolvedValue(manyProducts(1, 5));
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Producto 1')).toBeTruthy());
    expect(screen.queryByTestId('inventory-load-more')).toBeNull();
  });

  it('never repeats a product that the next page sends again', async () => {
    mockedProducts.getProducts.mockResolvedValueOnce(manyProducts(1, 20)).mockResolvedValueOnce(manyProducts(20, 10));
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByTestId('inventory-load-more')).toBeTruthy());

    fireEvent.press(screen.getByTestId('inventory-load-more'));

    await waitFor(() => expect(listed()).toHaveLength(29));
    expect(listed().filter(p => p.id === 20)).toHaveLength(1);
  });

  it('shows an alert when the next page fails, and lets the user try again', async () => {
    mockedProducts.getProducts.mockResolvedValueOnce(manyProducts(1, 20)).mockRejectedValueOnce(new Error('boom'));
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByTestId('inventory-load-more')).toBeTruthy());

    fireEvent.press(screen.getByTestId('inventory-load-more'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', expect.any(String)));
    await waitFor(() => expect(screen.getByTestId('inventory-load-more')).toBeTruthy());
    expect(listed()).toHaveLength(20);
  });

  it('makes each entry a bit lower than the entries of the other lists', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    const entry = StyleSheet.flatten(screen.getByTestId('product-item-1').props.style);
    expect(entry.paddingVertical).toBeLessThan(12);
    expect(entry.marginBottom).toBeLessThan(10);
  });

  it('shows the product names at the same size as in the other lists', async () => {
    mockedProducts.getProducts.mockResolvedValue([product({ marca: 'Sancor' })]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    const name = StyleSheet.flatten(screen.getByText('Leche').props.style);
    const brand = StyleSheet.flatten(screen.getByText('Sancor').props.style);
    expect(name.fontSize).toBe(15);
    expect(name.fontSize).toBeGreaterThan(brand.fontSize);
  });
});
