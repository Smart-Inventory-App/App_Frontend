import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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

jest.mock('@/components/StockTotalModal', () => {
  const { View, Text, TouchableOpacity } = require('react-native');
  return function MockStockTotalModal({ visible, initial, onClose }: any) {
    if (!visible) return null;
    return (
      <View testID="mock-stock-total">
        <Text testID="mock-stock-total-initial">{initial ? `${initial.nombre}|${initial.categoria}` : 'none'}</Text>
        <TouchableOpacity testID="mock-stock-total-close" onPress={onClose}><Text>close</Text></TouchableOpacity>
      </View>
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
    await waitFor(() => expect(screen.queryByTestId('edit-sheet')).toBeNull(), { timeout: 3000 });
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
    await waitFor(() => expect(screen.queryByTestId('edit-sheet')).toBeNull(), { timeout: 3000 });
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
      const tree = JSON.stringify(screen.toJSON());
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

  it('aligns the sort chips vertically with the "Ordenar:" label (no extra bottom padding)', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    const { UNSAFE_getAllByType } = render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    const { ScrollView, StyleSheet } = require('react-native');
    const sortScroll = UNSAFE_getAllByType(ScrollView).find(
      (s: any) => StyleSheet.flatten(s.props.contentContainerStyle)?.alignItems === 'center',
    );
    const style = StyleSheet.flatten(sortScroll.props.contentContainerStyle);
    expect(style.paddingBottom).toBe(0);
    expect(style.paddingLeft).toBe(0);
  });

  it('has no horizontal swipe in the category and location filters: a search button comes first instead', async () => {
    mockedProducts.getFilterOptions.mockResolvedValue({
      categorias: Array.from({ length: 20 }, (_, i) => `Categoria ${i}`),
      ubicaciones: Array.from({ length: 20 }, (_, i) => `Ubicacion ${i}`),
      marcas: [],
    });
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByTestId('filter-search-categoria')).toBeTruthy());
    expect(screen.getByTestId('filter-search-ubicacion')).toBeTruthy();
    expect(screen.queryByTestId('filter-categorias')).toBeNull();
    expect(screen.queryByTestId('filter-ubicaciones')).toBeNull();
    // la lupa va antes de "Todas"
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('filter-search-categoria')).toBeLessThan(tree.indexOf('Todas'));
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

  it('shows the "Stock total de producto" button above the search field', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Yogur')).toBeTruthy());
    expect(screen.getByText('Stock total de producto')).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('open-stock-total')).toBeLessThan(tree.indexOf('Buscar por nombre o marca...'));
  });

  it('opens the total stock window from the button, with no product chosen, and closes it', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Yogur')).toBeTruthy());
    expect(screen.queryByTestId('mock-stock-total')).toBeNull();
    fireEvent.press(screen.getByTestId('open-stock-total'));
    expect(screen.getByTestId('mock-stock-total-initial').props.children).toBe('none');
    fireEvent.press(screen.getByTestId('mock-stock-total-close'));
    expect(screen.queryByTestId('mock-stock-total')).toBeNull();
  });

  it('offers the "Stock total" button in the product information window', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Yogur')).toBeTruthy());
    fireEvent.press(screen.getByTestId('product-info-5'));
    expect(screen.getByTestId('detail-total-button')).toBeTruthy();
  });

  it('goes from the information window to the total stock of that product, closing the information', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Yogur')).toBeTruthy());
    fireEvent.press(screen.getByTestId('product-info-5'));
    fireEvent.press(screen.getByTestId('detail-total-button'));
    expect(screen.queryByTestId('product-detail-card')).toBeNull();
    expect(screen.getByTestId('mock-stock-total-initial').props.children).toBe('Yogur|Lacteos');
  });

  it('starts from scratch when opened again from the button after coming from a product', async () => {
    mockedProducts.getProducts.mockResolvedValue([full()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Yogur')).toBeTruthy());
    fireEvent.press(screen.getByTestId('product-info-5'));
    fireEvent.press(screen.getByTestId('detail-total-button'));
    fireEvent.press(screen.getByTestId('mock-stock-total-close'));
    fireEvent.press(screen.getByTestId('open-stock-total'));
    expect(screen.getByTestId('mock-stock-total-initial').props.children).toBe('none');
  });
});

describe('InventarioScreen - header', () => {
  it('has the home icon on the left and "Inventario" on the right, and the icon goes home', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('header-home')).toBeLessThan(tree.indexOf('"Inventario"'));
    fireEvent.press(screen.getByTestId('header-home'));
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/');
  });
});
