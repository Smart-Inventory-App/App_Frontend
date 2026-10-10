import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import CargarScreen from '../app/(tabs)/cargar';
import { productService } from '@/services/productService';

const mockReplace = jest.fn();

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
    router: { replace: (...args: any[]) => mockReplace(...args) },
    useFocusEffect: (cb: () => void) => ReactActual.useEffect(cb, [cb]),
  };
});

jest.mock('@/services/productService', () => ({
  productService: {
    getDefaults: jest.fn(),
    getFilterOptions: jest.fn(),
    suggestProducts: jest.fn(),
    createProduct: jest.fn(),
    registerEvent: jest.fn(),
  },
}));

jest.mock('@/components/ProductFormFields', () => {
  const { TextInput: RNTextInput } = require('react-native');
  return function MockProductFormFields({ form, onChange }: any) {
    return (
      <RNTextInput
        testID="mock-form-nombre"
        value={form.nombre ?? ''}
        onChangeText={(v: string) => onChange({ ...form, nombre: v, categoria: 'Lacteos', stock: 1 })}
      />
    );
  };
});

jest.mock('@/components/ScanModal', () => {
  const { View: RNView, Text: RNText, TouchableOpacity } = require('react-native');
  return function MockScanModal({ visible, onSuccess, onClose }: any) {
    if (!visible) return null;
    return (
      <RNView testID="mock-scan-modal">
        <TouchableOpacity testID="mock-scan-success-created" onPress={() => onSuccess('created')}>
          <RNText>created</RNText>
        </TouchableOpacity>
        <TouchableOpacity testID="mock-scan-success-merged" onPress={() => onSuccess('merged')}>
          <RNText>merged</RNText>
        </TouchableOpacity>
        <TouchableOpacity testID="mock-scan-success-updated" onPress={() => onSuccess('updated')}>
          <RNText>updated</RNText>
        </TouchableOpacity>
        <TouchableOpacity testID="mock-scan-success-salida" onPress={() => onSuccess('salida')}>
          <RNText>salida</RNText>
        </TouchableOpacity>
        <TouchableOpacity testID="mock-scan-close" onPress={onClose}>
          <RNText>close</RNText>
        </TouchableOpacity>
      </RNView>
    );
  };
});

const mockedProducts = productService as jest.Mocked<typeof productService>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedProducts.getDefaults.mockResolvedValue({});
  mockedProducts.getFilterOptions.mockResolvedValue({ categorias: [], ubicaciones: [], marcas: [] });
  mockedProducts.suggestProducts.mockResolvedValue([]);
});

describe('CargarScreen - entrada (manual)', () => {
  it('loads filter options and defaults on focus', async () => {
    render(<CargarScreen />);
    await waitFor(() => expect(mockedProducts.getFilterOptions).toHaveBeenCalled());
    expect(mockedProducts.getDefaults).toHaveBeenCalled();
  });

  it('shows a validation error when submitting an empty form', async () => {
    render(<CargarScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar producto'));
    });
    expect(screen.getByText('El nombre es requerido')).toBeTruthy();
    expect(mockedProducts.createProduct).not.toHaveBeenCalled();
  });

  it('creates a product and shows the success screen', async () => {
    mockedProducts.createProduct.mockResolvedValue({ id: 1, merged: false } as any);
    render(<CargarScreen />);
    fireEvent.changeText(screen.getByTestId('mock-form-nombre'), 'Leche');
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar producto'));
    });
    expect(mockedProducts.createProduct).toHaveBeenCalled();
    expect(screen.getByText('Producto cargado correctamente')).toBeTruthy();
  });

  it('shows the merged success message', async () => {
    mockedProducts.createProduct.mockResolvedValue({ id: 1, merged: true } as any);
    render(<CargarScreen />);
    fireEvent.changeText(screen.getByTestId('mock-form-nombre'), 'Leche');
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar producto'));
    });
    expect(screen.getByText('Se sumó el stock a un producto que ya tenías cargado')).toBeTruthy();
  });

  it('shows the backend detail string on failure', async () => {
    mockedProducts.createProduct.mockRejectedValue({ response: { data: { detail: 'nombre invalido' } } });
    render(<CargarScreen />);
    fireEvent.changeText(screen.getByTestId('mock-form-nombre'), 'Leche');
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar producto'));
    });
    expect(screen.getByText('nombre invalido')).toBeTruthy();
  });

  it('joins an array of validation errors from the backend', async () => {
    mockedProducts.createProduct.mockRejectedValue({
      response: { data: { detail: [{ msg: 'error 1' }, { msg: 'error 2' }] } },
    });
    render(<CargarScreen />);
    fireEvent.changeText(screen.getByTestId('mock-form-nombre'), 'Leche');
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar producto'));
    });
    expect(screen.getByText('error 1\nerror 2')).toBeTruthy();
  });

  it('falls back to a generic error message', async () => {
    mockedProducts.createProduct.mockRejectedValue({});
    render(<CargarScreen />);
    fireEvent.changeText(screen.getByTestId('mock-form-nombre'), 'Leche');
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar producto'));
    });
    expect(screen.getByText('No se pudo guardar el producto')).toBeTruthy();
  });

  it('uses the raw error message when present', async () => {
    mockedProducts.createProduct.mockRejectedValue(new Error('network down'));
    render(<CargarScreen />);
    fireEvent.changeText(screen.getByTestId('mock-form-nombre'), 'Leche');
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar producto'));
    });
    expect(screen.getByText('network down')).toBeTruthy();
  });

  it('navigates to inventory from the success screen', async () => {
    mockedProducts.createProduct.mockResolvedValue({ id: 1, merged: false } as any);
    render(<CargarScreen />);
    fireEvent.changeText(screen.getByTestId('mock-form-nombre'), 'Leche');
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar producto'));
    });
    fireEvent.press(screen.getByText('Ver inventario'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/inventario');
  });

  it('loads another product, resetting the form', async () => {
    mockedProducts.createProduct.mockResolvedValue({ id: 1, merged: false } as any);
    render(<CargarScreen />);
    fireEvent.changeText(screen.getByTestId('mock-form-nombre'), 'Leche');
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar producto'));
    });
    fireEvent.press(screen.getByText('Cargar otro'));
    expect(screen.getByTestId('mock-form-nombre').props.value).toBe('');
  });

  it('does not preselect the previous categoria and ubicacion when loading another product', async () => {
    mockedProducts.getDefaults.mockResolvedValue({ last_categoria: 'Lacteos', last_ubicacion: 'Heladera' });
    mockedProducts.createProduct.mockResolvedValue({ id: 1, merged: false } as any);
    render(<CargarScreen />);
    await waitFor(() => expect(mockedProducts.getDefaults).toHaveBeenCalledTimes(1));
    fireEvent.changeText(screen.getByTestId('mock-form-nombre'), 'Leche');
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar producto'));
    });
    mockedProducts.getDefaults.mockClear();
    await act(async () => {
      fireEvent.press(screen.getByText('Cargar otro'));
    });
    expect(mockedProducts.getDefaults).not.toHaveBeenCalled();
  });
});

describe('CargarScreen - salida', () => {
  it('switches to salida and validates missing product/quantity', async () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByText('Salida'));
    await act(async () => {
      fireEvent.press(screen.getByText('Registrar salida'));
    });
    expect(screen.getByText('Elegí un producto de la lista de sugerencias')).toBeTruthy();
  });

  it('validates the quantity once a product is selected', async () => {
    jest.useFakeTimers();
    mockedProducts.suggestProducts.mockResolvedValue([{ id: 1, nombre: 'Leche', categoria: 'Lacteos', stock: 3 } as any]);
    render(<CargarScreen />);
    fireEvent.press(screen.getByText('Salida'));
    fireEvent.changeText(screen.getByPlaceholderText('Buscá un producto que ya tenés cargado'), 'lech');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    jest.useRealTimers();
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    fireEvent.press(screen.getByText('Leche'));

    await act(async () => {
      fireEvent.press(screen.getByText('Registrar salida'));
    });
    expect(screen.getByText('La cantidad debe ser mayor a 0')).toBeTruthy();
  });

  it('registers a stock-out event and shows the success screen', async () => {
    jest.useFakeTimers();
    mockedProducts.suggestProducts.mockResolvedValue([{ id: 1, nombre: 'Leche', marca: 'LSA', categoria: 'Lacteos', stock: 3 } as any]);
    mockedProducts.registerEvent.mockResolvedValue({ event_type: 'consumed', quantity: 1, remaining_stock: 2 });
    render(<CargarScreen />);
    fireEvent.press(screen.getByText('Salida'));
    fireEvent.changeText(screen.getByPlaceholderText('Buscá un producto que ya tenés cargado'), 'lech');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    jest.useRealTimers();
    await waitFor(() => expect(screen.getByText('Leche · LSA')).toBeTruthy());
    fireEvent.press(screen.getByText('Leche · LSA'));

    fireEvent.press(screen.getByText('Vencido'));
    fireEvent.changeText(screen.getByPlaceholderText('0'), '1');

    await act(async () => {
      fireEvent.press(screen.getByText('Registrar salida'));
    });

    expect(mockedProducts.registerEvent).toHaveBeenCalledWith(1, 1, 'expired', '');
    expect(screen.getByText('Se registró la salida correctamente')).toBeTruthy();
  });

  it('shows the backend detail when registerEvent fails', async () => {
    jest.useFakeTimers();
    mockedProducts.suggestProducts.mockResolvedValue([{ id: 1, nombre: 'Leche', categoria: 'Lacteos', stock: 3 } as any]);
    mockedProducts.registerEvent.mockRejectedValue({ response: { data: { detail: 'sin stock' } } });
    render(<CargarScreen />);
    fireEvent.press(screen.getByText('Salida'));
    fireEvent.changeText(screen.getByPlaceholderText('Buscá un producto que ya tenés cargado'), 'lech');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    jest.useRealTimers();
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    fireEvent.press(screen.getByText('Leche'));
    fireEvent.changeText(screen.getByPlaceholderText('0'), '1');
    await act(async () => {
      fireEvent.press(screen.getByText('Registrar salida'));
    });
    expect(screen.getByText('sin stock')).toBeTruthy();
  });

  it('clears the suggestions when the query is cleared', async () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByText('Salida'));
    const input = screen.getByPlaceholderText('Buscá un producto que ya tenés cargado');
    fireEvent.changeText(input, 'a');
    expect(mockedProducts.suggestProducts).not.toHaveBeenCalled();
  });

  it('resets after registering another stock-out', async () => {
    mockedProducts.suggestProducts.mockResolvedValue([{ id: 1, nombre: 'Leche', categoria: 'Lacteos', stock: 3 } as any]);
    mockedProducts.registerEvent.mockResolvedValue({ event_type: 'consumed', quantity: 1, remaining_stock: 2 });
    render(<CargarScreen />);
    fireEvent.press(screen.getByText('Salida'));
    fireEvent.changeText(screen.getByPlaceholderText('Buscá un producto que ya tenés cargado'), 'lech');
    await waitFor(() => expect(mockedProducts.suggestProducts).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    fireEvent.press(screen.getByText('Leche'));
    fireEvent.changeText(screen.getByPlaceholderText('0'), '1');
    await act(async () => {
      fireEvent.press(screen.getByText('Registrar salida'));
    });
    fireEvent.press(screen.getByText('Registrar otra salida'));
    expect(screen.getByText('Salida')).toBeTruthy();
  });
});

describe('CargarScreen - scan integration', () => {
  it('opens the scan modal and handles a "created" success', async () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByTestId('open-scan-modal'));
    expect(screen.getByTestId('mock-scan-modal')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mock-scan-success-created'));
    expect(screen.getByText('Producto cargado desde la foto')).toBeTruthy();
  });

  it('handles a "merged" success from the scan modal', async () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByTestId('open-scan-modal'));
    fireEvent.press(screen.getByTestId('mock-scan-success-merged'));
    expect(screen.getByText('Se sumó el stock a un producto que ya tenías cargado')).toBeTruthy();
  });

  it('handles an "updated" success from the scan modal', async () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByTestId('open-scan-modal'));
    fireEvent.press(screen.getByTestId('mock-scan-success-updated'));
    expect(screen.getByText('Producto actualizado')).toBeTruthy();
  });

  it('handles a "salida" success from the scan modal', async () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByTestId('open-scan-modal'));
    fireEvent.press(screen.getByTestId('mock-scan-success-salida'));
    expect(screen.getByText('Se registró la salida correctamente')).toBeTruthy();
  });

  it('closes the scan modal without side effects', () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByTestId('open-scan-modal'));
    fireEvent.press(screen.getByTestId('mock-scan-close'));
    expect(screen.queryByTestId('mock-scan-modal')).toBeNull();
  });
});

describe('CargarScreen - salida labels', () => {
  it('labels the exit fields as requested', () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByText('Salida'));
    expect(screen.getByText('Producto *')).toBeTruthy();
    expect(screen.getByPlaceholderText('Buscá un producto que ya tenés cargado')).toBeTruthy();
    expect(screen.getByText('Motivo *')).toBeTruthy();
    expect(screen.getByText('Motivo (Opcional)')).toBeTruthy();
    expect(screen.getByPlaceholderText('Descripción de salida (ej. vencido en heladera)')).toBeTruthy();
  });
});

describe('CargarScreen - salida limits and reason format', () => {
  const goToSalida = () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByText('Salida'));
  };

  it('limits the quantity to six digits', () => {
    goToSalida();
    const quantity = screen.getAllByPlaceholderText('0')[0];
    expect(quantity.props.maxLength).toBe(6);
  });

  it('gives the reason the same multiline format as a product description, limited to 50 characters, with a counter', () => {
    goToSalida();
    const input = screen.getByTestId('input-salida-nota');
    expect(input.props.multiline).toBe(true);
    expect(input.props.maxLength).toBe(50);
    expect(StyleSheet.flatten(input.props.style).height).toBe(72);
    expect(screen.getByTestId('salida-nota-counter').props.children.join('')).toBe('0/50');
    fireEvent.changeText(input, 'vencido en heladera');
    expect(screen.getByTestId('salida-nota-counter').props.children.join('')).toBe('19/50');
  });
});
