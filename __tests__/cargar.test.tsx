import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
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
  const { TextInput: RNTextInput, Text: RNText } = require('react-native');
  return function MockProductFormFields({ form, onChange }: any) {
    return (
      <>
        <RNText testID="mock-form-json">{JSON.stringify(form)}</RNText>
        <RNTextInput
          testID="mock-form-nombre"
          value={form.nombre ?? ''}
          onChangeText={(v: string) => onChange({ ...form, nombre: v, categoria: 'Lacteos', stock: 1 })}
        />
        <RNTextInput
          testID="mock-form-vencimiento"
          value={form.vencimiento ?? ''}
          onChangeText={(v: string) => onChange({ ...form, vencimiento: v })}
        />
        <RNTextInput
          testID="mock-form-codigo-barras"
          value={form.codigo_barras ?? ''}
          onChangeText={(v: string) => onChange({ ...form, codigo_barras: v })}
        />
      </>
    );
  };
});

jest.mock('@/components/ScanModal', () => {
  const { View: RNView, Text: RNText, TouchableOpacity } = require('react-native');
  return function MockScanModal({ visible, onSuccess, onClose, onApplyToForm }: any) {
    if (!visible) return null;
    return (
      <RNView testID="mock-scan-modal">
        <TouchableOpacity testID="mock-apply-barcode" onPress={() => onApplyToForm((f: any) => ({ ...f, codigo_barras: '7791234567898' }))}>
          <RNText>apply barcode</RNText>
        </TouchableOpacity>
        <TouchableOpacity testID="mock-apply-expiry" onPress={() => onApplyToForm((f: any) => ({ ...f, vencimiento: '2027-01-01' }))}>
          <RNText>apply expiry</RNText>
        </TouchableOpacity>
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

describe('CargarScreen - shared header', () => {
  it('puts the Entrada/Salida switch inside the banner, on the right of the title, keeping the banner height', () => {
    render(<CargarScreen />);
    const { within } = require('@testing-library/react-native');
    const header = screen.getByTestId('screen-header');
    expect(within(header).getByText('Flujo de producto')).toBeTruthy();
    expect(within(header).getByText('Entrada')).toBeTruthy();
    expect(within(header).getByText('Salida')).toBeTruthy();
    expect(StyleSheet.flatten(header.props.style).height).toBe(92);
    // el título va primero y el selector después: queda a la derecha
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('Flujo de producto')).toBeLessThan(tree.indexOf('Entrada'));
  });

  it('keeps the switch working from the banner', () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByText('Salida'));
    expect(screen.getByText('Registrar salida')).toBeTruthy();
    fireEvent.press(screen.getByText('Entrada'));
    expect(screen.getByText('Guardar producto')).toBeTruthy();
  });
});

describe('CargarScreen - big Entrada/Salida buttons', () => {
  it('writes the buttons a bit smaller than the title and keeps the banner height', () => {
    render(<CargarScreen />);
    const flat = (node: any) => StyleSheet.flatten(node.props.style);
    const title = screen.getByText('Flujo de producto');
    const entrada = screen.getByText('Entrada');
    expect(flat(entrada).fontSize).toBe(18);
    expect(flat(entrada).fontSize).toBeLessThan(flat(title).fontSize);
    expect(flat(screen.getByTestId('screen-header')).height).toBe(92);
    // el botón entra en el renglón del banner (28 px)
    expect(StyleSheet.flatten(screen.getByTestId('direction-entrada').props.style).height).toBe(28);
  });

  it('shrinks the button text before cutting the title, and sits a bit away from the right edge', () => {
    render(<CargarScreen />);
    const entrada = screen.getByText('Entrada');
    expect(entrada.props.adjustsFontSizeToFit).toBe(true);
    expect(entrada.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(screen.getByText('Flujo de producto').props.style).flexShrink).toBe(0);
    expect(StyleSheet.flatten(screen.getByTestId('direction-row').props.style).marginRight).toBeGreaterThan(0);
    expect(StyleSheet.flatten(screen.getByTestId('direction-row').props.style).gap).toBe(12);
  });
});

describe('CargarScreen - toque en sugerencias con el teclado abierto', () => {
  it('deja que el primer toque llegue a las sugerencias sin cerrar el teclado (Android)', () => {
    render(<CargarScreen />);
    expect(screen.UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  });
});

describe('CargarScreen - fecha de vencimiento inválida', () => {
  it('muestra el mensaje y borra solo la fecha, sin tocar el resto del formulario', async () => {
    render(<CargarScreen />);
    fireEvent.changeText(screen.getByTestId('mock-form-nombre'), 'Leche');
    fireEvent.changeText(screen.getByTestId('mock-form-vencimiento'), '31/02/2026');
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar producto'));
    });
    expect(screen.getByText('Fecha de vencimiento inválida. Ingresa el día y el mes con 2 dígitos y el año con 4 dígitos. Por ejemplo: 05/03/2027')).toBeTruthy();
    expect(screen.getByTestId('mock-form-vencimiento').props.value).toBe('');
    expect(screen.getByTestId('mock-form-nombre').props.value).toBe('Leche');
    expect(mockedProducts.createProduct).not.toHaveBeenCalled();
  });
});

describe('CargarScreen - código de barras', () => {
  it('shows "El código de barras es inválido" when the barcode does not validate', async () => {
    render(<CargarScreen />);
    fireEvent.changeText(screen.getByTestId('mock-form-nombre'), 'Leche');
    fireEvent.changeText(screen.getByTestId('mock-form-codigo-barras'), '123');
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar producto'));
    });
    expect(screen.getByText('El código de barras es inválido')).toBeTruthy();
    expect(mockedProducts.createProduct).not.toHaveBeenCalled();
  });
});

describe('CargarScreen - scanning feeds the form', () => {
  const formNow = () => JSON.parse(screen.getByTestId('mock-form-json').props.children);

  it('calls the button "Escanear imágenes"', () => {
    render(<CargarScreen />);
    expect(screen.getByText('Escanear imágenes')).toBeTruthy();
  });

  it('puts the scanned barcode in the form without losing what was already typed', () => {
    render(<CargarScreen />);
    fireEvent.changeText(screen.getByTestId('mock-form-nombre'), 'Leche');
    fireEvent.press(screen.getByTestId('open-scan-modal'));
    fireEvent.press(screen.getByTestId('mock-apply-barcode'));
    expect(formNow()).toMatchObject({ nombre: 'Leche', categoria: 'Lacteos', stock: 1, codigo_barras: '7791234567898' });
  });

  it('keeps a scanned barcode when an expiry date is scanned afterwards, and vice versa', () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByTestId('open-scan-modal'));
    fireEvent.press(screen.getByTestId('mock-apply-barcode'));
    fireEvent.press(screen.getByTestId('open-scan-modal'));
    fireEvent.press(screen.getByTestId('mock-apply-expiry'));
    expect(formNow()).toMatchObject({ codigo_barras: '7791234567898', vencimiento: '2027-01-01' });
  });

  it('does not create or finish anything when the form is fed by a scan', () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByTestId('open-scan-modal'));
    fireEvent.press(screen.getByTestId('mock-apply-expiry'));
    expect(mockedProducts.createProduct).not.toHaveBeenCalled();
    expect(screen.queryByText('Ver inventario')).toBeNull();
  });
});
