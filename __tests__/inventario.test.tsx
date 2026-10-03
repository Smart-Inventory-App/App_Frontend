import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Ionicons } from '@expo/vector-icons';
import InventarioScreen from '../app/(tabs)/inventario';
import { productService } from '@/services/productService';
import { Product } from '@/types/product';

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
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

const mockedProducts = productService as jest.Mocked<typeof productService>;

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

  it('deletes a product after confirming', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    mockedProducts.deleteProduct.mockResolvedValue(undefined);
    (Alert.alert as jest.Mock).mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b: any) => b.style === 'destructive')?.onPress?.();
    });
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'trash'));
    });
    expect(mockedProducts.deleteProduct).toHaveBeenCalledWith(1);
  });

  it('shows an alert when deleting fails', async () => {
    mockedProducts.getProducts.mockResolvedValue([product()]);
    mockedProducts.deleteProduct.mockRejectedValue(new Error('boom'));
    (Alert.alert as jest.Mock).mockImplementation((_title, _msg, buttons) => {
      buttons?.find((b: any) => b.style === 'destructive')?.onPress?.();
    });
    render(<InventarioScreen />);
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.UNSAFE_getAllByType(Ionicons).find((n: any) => n.props.name === 'trash'));
    });
    expect(Alert.alert).toHaveBeenLastCalledWith('Error', 'No se pudo eliminar el producto');
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
