import React from 'react';
import { Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { Colors } from '@/constants/colors';
import CargarScreen from '../app/(tabs)/cargar';
import { resetTabTransition, slideTransition } from '../src/utils/tabTransition';
import { productService } from '@/services/productService';

const mockReplace = jest.fn();
const mockNavigate = jest.fn();

// Limpiezas de los efectos de foco: llamarlas simula que el usuario se va de la pantalla
const mockFocusCleanups: Array<() => void> = [];

jest.mock('expo-router', () => {
  const ReactActual = require('react');
  return {
    router: { replace: (...args: any[]) => mockReplace(...args), navigate: (...args: any[]) => mockNavigate(...args) },
    useFocusEffect: (cb: () => void | (() => void)) => ReactActual.useEffect(() => {
      const cleanup = cb();
      if (typeof cleanup === 'function') mockFocusCleanups.push(cleanup);
      return cleanup;
    }, [cb]),
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
  const { TextInput: RNTextInput, Text: RNText, TouchableOpacity: RNTouchable } = require('react-native');
  const { useFieldFocus } = require('@/components/KeyboardAwareScrollView');
  return function MockProductFormFields({ form, onChange, onScanField }: any) {
    const onFieldFocus = useFieldFocus();
    return (
      <>
        <RNText testID="mock-form-json">{JSON.stringify(form)}</RNText>
        <RNTextInput
          testID="mock-form-nombre"
          value={form.nombre ?? ''}
          onFocus={onFieldFocus}
          onChangeText={(v: string) => onChange({ ...form, nombre: v, categoria: 'Lacteos', stock: 1 })}
        />
        <RNTouchable testID="mock-scan-expiry" onPress={() => onScanField('expiry_date')}>
          <RNText>scan expiry</RNText>
        </RNTouchable>
        <RNTouchable testID="mock-scan-barcode" onPress={() => onScanField('barcode')}>
          <RNText>scan barcode</RNText>
        </RNTouchable>
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

jest.mock('@/components/ExistingProductModal', () => {
  const { View: RNView, Text: RNText, TouchableOpacity } = require('react-native');
  return function MockExistingProductModal({ visible, mode, onSuccess, onClose, onSelectProduct, onPickReceipt }: any) {
    if (!visible) return null;
    return (
      <RNView testID="mock-existing-modal">
        <RNText testID="mock-existing-mode">{String(mode)}</RNText>
        <TouchableOpacity testID="mock-existing-select" onPress={() => { onSelectProduct({ id: 7, nombre: 'Yogur', marca: 'Ser', categoria: 'Lacteos', stock: 5 }); onClose(); }}>
          <RNText>select</RNText>
        </TouchableOpacity>
        <TouchableOpacity testID="mock-existing-receipt" onPress={() => onPickReceipt()}>
          <RNText>receipt</RNText>
        </TouchableOpacity>
        <TouchableOpacity testID="mock-existing-success" onPress={onSuccess}>
          <RNText>success</RNText>
        </TouchableOpacity>
        <TouchableOpacity testID="mock-existing-close" onPress={onClose}>
          <RNText>close</RNText>
        </TouchableOpacity>
      </RNView>
    );
  };
});

jest.mock('@/components/ScanModal', () => {
  const { View: RNView, Text: RNText, TouchableOpacity } = require('react-native');
  return function MockScanModal({ visible, onSuccess, onClose, onApplyToForm, fixedDocType, receiptDirection }: any) {
    if (!visible) return null;
    return (
      <RNView testID="mock-scan-modal">
        <RNText testID="mock-scan-target">{String(fixedDocType)}</RNText>
        <RNText testID="mock-scan-direction">{String(receiptDirection)}</RNText>
        <TouchableOpacity testID="mock-scan-success-restocked" onPress={() => onSuccess('restocked')}>
          <RNText>restocked</RNText>
        </TouchableOpacity>
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
  mockFocusCleanups.length = 0;
  mockedProducts.getDefaults.mockResolvedValue({});
  mockedProducts.getFilterOptions.mockResolvedValue({ categorias: [], ubicaciones: [], marcas: [] });
  mockedProducts.suggestProducts.mockResolvedValue([]);
});

describe('CargarScreen - entrada (manual)', () => {
  it('loads the filter options on focus', async () => {
    render(<CargarScreen />);
    await waitFor(() => expect(mockedProducts.getFilterOptions).toHaveBeenCalled());
  });

  it('does not preselect the categoria and ubicacion used in the previous action', async () => {
    mockedProducts.getDefaults.mockResolvedValue({ last_categoria: 'Lacteos', last_ubicacion: 'Heladera' });
    render(<CargarScreen />);
    await waitFor(() => expect(mockedProducts.getFilterOptions).toHaveBeenCalled());
    expect(mockedProducts.getDefaults).not.toHaveBeenCalled();
    const form = JSON.parse(screen.getByTestId('mock-form-json').props.children);
    expect(form.categoria).toBeUndefined();
    expect(form.ubicacion).toBeUndefined();
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
    await waitFor(() => expect(mockedProducts.getFilterOptions).toHaveBeenCalled());
    fireEvent.changeText(screen.getByTestId('mock-form-nombre'), 'Leche');
    await act(async () => {
      fireEvent.press(screen.getByText('Guardar producto'));
    });
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
    fireEvent.press(screen.getByText('Consumido'));
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
    fireEvent.press(screen.getByText('Consumido'));
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
    expect(screen.getByText('Descripción de Motivo')).toBeTruthy();
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
  it('keeps only the home icon and the title in the banner, with the Entrada/Salida switch below it', () => {
    render(<CargarScreen />);
    const { within } = require('@testing-library/react-native');
    const header = screen.getByTestId('screen-header');
    expect(within(header).getByText('Flujo de Producto')).toBeTruthy();
    expect(within(header).queryByText('Entrada')).toBeNull();
    expect(within(header).queryByText('Salida')).toBeNull();
    expect(StyleSheet.flatten(header.props.style).height).toBe(92);
    // banner, después el selector y después el botón "Ingresar producto existente"
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('screen-header')).toBeLessThan(tree.indexOf('direction-row'));
    expect(tree.indexOf('direction-row')).toBeLessThan(tree.indexOf('open-existing-modal'));
  });

  it('has the title on the right of the banner, now that nothing else is next to it', () => {
    render(<CargarScreen />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('header-home')).toBeLessThan(tree.indexOf('Flujo de Producto'));
    expect(StyleSheet.flatten(screen.getByTestId('screen-header').props.style).justifyContent).toBe('space-between');
  });

  it('keeps the switch working from below the banner', () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByText('Salida'));
    expect(screen.getByText('Registrar salida')).toBeTruthy();
    fireEvent.press(screen.getByText('Entrada'));
    expect(screen.getByText('Guardar producto')).toBeTruthy();
  });

  it('keeps the switch above the first button of each tab', () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByText('Salida'));
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('direction-row')).toBeLessThan(tree.indexOf('open-exit-scan-modal'));
  });
});

describe('CargarScreen - Entrada/Salida buttons', () => {
  it('are two buttons of the same width that share the row below the banner', () => {
    render(<CargarScreen />);
    const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);
    expect(flat('direction-row').flexDirection).toBe('row');
    expect(flat('direction-entrada').flex).toBe(1);
    expect(flat('direction-salida').flex).toBe(1);
  });

  it('keep a margin below them, as big as the one above and of the color of the background, while the content scrolls under them', () => {
    render(<CargarScreen />);
    const row = StyleSheet.flatten(screen.getByTestId('direction-row').props.style);
    expect(row.paddingTop).toBe(14);
    expect(row.paddingBottom).toBe(row.paddingTop);
    // el mismo color del fondo del contenido que pasa por debajo
    const content = StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.style);
    expect(row.backgroundColor).toBe(content.backgroundColor);
  });

  it('are big enough to be pressed easily', () => {
    render(<CargarScreen />);
    const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);
    expect(flat('direction-entrada').height).toBeGreaterThanOrEqual(40);
    expect(flat('direction-salida').height).toBeGreaterThanOrEqual(40);
  });

  it('paint the active one in its color: teal for Entrada, red for Salida', () => {
    const { Colors } = require('../src/constants/colors');
    render(<CargarScreen />);
    const bg = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).backgroundColor;
    expect(bg('direction-entrada')).toBe(Colors.primary);
    expect(bg('direction-salida')).not.toBe(Colors.error);
    fireEvent.press(screen.getByTestId('direction-salida'));
    expect(bg('direction-salida')).toBe(Colors.error);
    expect(bg('direction-entrada')).not.toBe(Colors.primary);
  });

  it('shrink their text instead of cutting it', () => {
    render(<CargarScreen />);
    const entrada = screen.getByText('Entrada');
    expect(entrada.props.adjustsFontSizeToFit).toBe(true);
    expect(entrada.props.numberOfLines).toBe(1);
  });
});

describe('CargarScreen - toque en sugerencias con el teclado abierto', () => {
  it('deja que el primer toque llegue a las sugerencias sin cerrar el teclado (Android)', () => {
    render(<CargarScreen />);
    expect(screen.UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  });
});

describe('CargarScreen - teclado en la entrada', () => {
  const handlers: Record<string, () => void> = {};
  const originalState = (TextInput as any).State;

  beforeEach(() => {
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
      handlers[event] = cb;
      return { remove: jest.fn() };
    }) as any);
  });

  afterEach(() => {
    (TextInput as any).State = originalState;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('reserva el lugar del teclado también en Android', () => {
    render(<CargarScreen />);
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('padding');
  });

  it('agrega espacio al final mientras el teclado está abierto, para poder subir los últimos campos', () => {
    render(<CargarScreen />);
    const padding = () => StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle).paddingBottom;
    expect(padding()).toBe(40);
    act(() => { (handlers.keyboardDidShow as any)({ endCoordinates: { height: 300 } }); });
    expect(padding()).toBe(340);
    act(() => { handlers.keyboardDidHide(); });
    expect(padding()).toBe(40);
  });

  it('desplaza la pantalla para que el campo enfocado quede por encima del teclado', () => {
    jest.useFakeTimers();
    render(<CargarScreen />);
    const scroll = screen.UNSAFE_getByType(ScrollView).instance as any;
    scroll.getInnerViewRef = jest.fn(() => ({}));
    scroll.scrollTo = jest.fn();
    (TextInput as any).State = {
      currentlyFocusedInput: () => ({ measureLayout: (_inner: unknown, ok: (x: number, y: number) => void) => ok(0, 500) }),
    };

    // el teclado todavía no está abierto: espera a que aparezca
    fireEvent(screen.getByTestId('mock-form-nombre'), 'focus');
    expect(scroll.scrollTo).not.toHaveBeenCalled();
    act(() => { handlers.keyboardDidShow(); });
    act(() => { jest.advanceTimersByTime(150); });
    expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 380, animated: true });

    // con el teclado ya abierto, al cambiar de campo se desplaza enseguida
    scroll.scrollTo.mockClear();
    fireEvent(screen.getByTestId('mock-form-nombre'), 'focus');
    expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 380, animated: true });
  });

  it('no falla si no se puede medir el campo enfocado', () => {
    render(<CargarScreen />);
    (TextInput as any).State = { currentlyFocusedInput: () => null };
    fireEvent(screen.getByTestId('mock-form-nombre'), 'focus');
    act(() => { handlers.keyboardDidShow(); });
    expect(screen.getByTestId('mock-form-nombre')).toBeTruthy();
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

describe('CargarScreen - ingresar producto existente', () => {
  it('shows the button above "Escanear imágenes", with the same format', () => {
    render(<CargarScreen />);
    expect(screen.getByText('Ingresar producto existente')).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('open-existing-modal')).toBeLessThan(tree.indexOf('open-scan-modal'));
    expect(StyleSheet.flatten(screen.getByTestId('open-existing-modal').props.style))
      .toEqual(StyleSheet.flatten(screen.getByTestId('open-scan-modal').props.style));
  });

  it('opens the window from the button and closes it', () => {
    render(<CargarScreen />);
    expect(screen.queryByTestId('mock-existing-modal')).toBeNull();
    fireEvent.press(screen.getByTestId('open-existing-modal'));
    expect(screen.getByTestId('mock-existing-modal')).toBeTruthy();
    fireEvent.press(screen.getByTestId('mock-existing-close'));
    expect(screen.queryByTestId('mock-existing-modal')).toBeNull();
  });

  it('shows the usual success screen once the stock was added', () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByTestId('open-existing-modal'));
    fireEvent.press(screen.getByTestId('mock-existing-success'));
    expect(screen.getByText('¡Listo!')).toBeTruthy();
    expect(screen.getByText('Se sumó el stock a un producto que ya tenías cargado')).toBeTruthy();
  });

  it('does not show the button in the exit tab', () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByText('Salida'));
    expect(screen.queryByTestId('open-existing-modal')).toBeNull();
  });
});

describe('CargarScreen - escaneo de fecha de vencimiento y código de barras', () => {
  it('opens the scan for the expiry date from its camera button', () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByTestId('mock-scan-expiry'));
    expect(screen.getByTestId('mock-scan-target').props.children).toBe('expiry_date');
  });

  it('opens the scan for the barcode from its camera button', () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByTestId('mock-scan-barcode'));
    expect(screen.getByTestId('mock-scan-target').props.children).toBe('barcode');
  });

  it('opens the general scan (label or receipt) from "Escanear imágenes", even after scanning a field', () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByTestId('mock-scan-barcode'));
    fireEvent.press(screen.getByTestId('mock-scan-close'));
    fireEvent.press(screen.getByTestId('open-scan-modal'));
    expect(screen.getByTestId('mock-scan-target').props.children).toBe('null');
  });

  it('loads the scanned expiry date into the form keeping what was already filled in', () => {
    render(<CargarScreen />);
    fireEvent.changeText(screen.getByTestId('mock-form-nombre'), 'Leche');
    fireEvent.press(screen.getByTestId('mock-scan-expiry'));
    fireEvent.press(screen.getByTestId('mock-apply-expiry'));
    const form = JSON.parse(screen.getByTestId('mock-form-json').props.children);
    expect(form).toMatchObject({ nombre: 'Leche', categoria: 'Lacteos', vencimiento: '2027-01-01' });
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

describe('CargarScreen - salida: motivos y escaneo', () => {
  const goToSalida = () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByText('Salida'));
  };

  const selectProduct = async () => {
    jest.useFakeTimers();
    mockedProducts.suggestProducts.mockResolvedValue([{ id: 1, nombre: 'Leche', categoria: 'Lacteos', stock: 30 } as any]);
    fireEvent.changeText(screen.getByPlaceholderText('Buscá un producto que ya tenés cargado'), 'lech');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    jest.useRealTimers();
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    fireEvent.press(screen.getByText('Leche'));
  };

  const motivoOrder = () => {
    const tree = JSON.stringify(screen.toJSON());
    return ['sold', 'consumed', 'expired', 'rented']
      .map(id => ({ id, at: tree.indexOf(`salida-motivo-${id}`) }))
      .sort((a, b) => a.at - b.at)
      .map(item => item.id);
  };

  it('offers four reasons, with "Vendido" first of all the buttons', () => {
    goToSalida();
    expect(motivoOrder()).toEqual(['sold', 'consumed', 'expired', 'rented']);
    ['Vendido', 'Consumido', 'Vencido', 'Alquilado'].forEach(label => expect(screen.getByText(label)).toBeTruthy());
  });

  it('has no reason chosen at the start', () => {
    goToSalida();
    ['sold', 'consumed', 'expired', 'rented'].forEach(id => {
      const style = StyleSheet.flatten(screen.getByTestId(`salida-motivo-${id}`).props.style);
      expect(style.backgroundColor).toBe('#fff');
    });
  });

  it('shows the reasons in a row that scrolls sideways when they do not fit', () => {
    goToSalida();
    const scroll = screen.getByTestId('salida-motivo-scroll');
    expect(scroll.props.horizontal).toBe(true);
    expect(scroll.props.showsHorizontalScrollIndicator).toBe(false);
    const content = StyleSheet.flatten(scroll.props.contentContainerStyle);
    expect(content.flexDirection).toBe('row');
    expect(content.flexWrap).toBeUndefined();
    expect(StyleSheet.flatten(screen.getByTestId('salida-motivo-sold').props.style).flexShrink).toBe(0);
  });

  it('moves the chosen reason to the start of the list', () => {
    goToSalida();
    fireEvent.press(screen.getByTestId('salida-motivo-expired'));
    expect(motivoOrder()).toEqual(['expired', 'sold', 'consumed', 'rented']);
    const chosen = StyleSheet.flatten(screen.getByTestId('salida-motivo-expired').props.style);
    expect(chosen.backgroundColor).toBe(Colors.primary);
  });

  it('sends the previous reason back to its place when another one is chosen', () => {
    goToSalida();
    fireEvent.press(screen.getByTestId('salida-motivo-rented'));
    expect(motivoOrder()).toEqual(['rented', 'sold', 'consumed', 'expired']);
    fireEvent.press(screen.getByTestId('salida-motivo-consumed'));
    expect(motivoOrder()).toEqual(['consumed', 'sold', 'expired', 'rented']);
  });

  it('puts the reason back in its original place when it is deselected', () => {
    goToSalida();
    fireEvent.press(screen.getByTestId('salida-motivo-expired'));
    expect(motivoOrder()[0]).toBe('expired');
    fireEvent.press(screen.getByTestId('salida-motivo-expired'));
    expect(motivoOrder()).toEqual(['sold', 'consumed', 'expired', 'rented']);
    expect(StyleSheet.flatten(screen.getByTestId('salida-motivo-expired').props.style).backgroundColor).toBe('#fff');
  });

  it('asks to choose a reason before registering the exit', async () => {
    mockedProducts.suggestProducts.mockResolvedValue([{ id: 1, nombre: 'Leche', categoria: 'Lacteos', stock: 3 } as any]);
    goToSalida();
    await selectProduct();
    fireEvent.changeText(screen.getByPlaceholderText('0'), '2');
    await act(async () => {
      fireEvent.press(screen.getByText('Registrar salida'));
    });
    expect(screen.getByText('Elegí el motivo de la salida')).toBeTruthy();
    expect(mockedProducts.registerEvent).not.toHaveBeenCalled();
  });

  it('does not register the exit after the reason was deselected', async () => {
    mockedProducts.suggestProducts.mockResolvedValue([{ id: 1, nombre: 'Leche', categoria: 'Lacteos', stock: 3 } as any]);
    goToSalida();
    await selectProduct();
    fireEvent.changeText(screen.getByPlaceholderText('0'), '2');
    fireEvent.press(screen.getByTestId('salida-motivo-sold'));
    fireEvent.press(screen.getByTestId('salida-motivo-sold'));
    await act(async () => {
      fireEvent.press(screen.getByText('Registrar salida'));
    });
    expect(mockedProducts.registerEvent).not.toHaveBeenCalled();
  });

  it('starts with no reason again after registering another exit', async () => {
    mockedProducts.suggestProducts.mockResolvedValue([{ id: 1, nombre: 'Leche', categoria: 'Lacteos', stock: 3 } as any]);
    mockedProducts.registerEvent.mockResolvedValue({ event_type: 'sold', quantity: 1, remaining_stock: 2 });
    goToSalida();
    await selectProduct();
    fireEvent.changeText(screen.getByPlaceholderText('0'), '1');
    fireEvent.press(screen.getByTestId('salida-motivo-rented'));
    await act(async () => {
      fireEvent.press(screen.getByText('Registrar salida'));
    });
    fireEvent.press(screen.getByText('Registrar otra salida'));
    expect(motivoOrder()).toEqual(['sold', 'consumed', 'expired', 'rented']);
    expect(StyleSheet.flatten(screen.getByTestId('salida-motivo-rented').props.style).backgroundColor).toBe('#fff');
  });

  it('calls the field "Stock a sacar" and the description "Descripción de Motivo", with no "optional"', () => {
    goToSalida();
    expect(screen.getByText('Stock a sacar *')).toBeTruthy();
    expect(screen.queryByText('Cantidad a sacar *')).toBeNull();
    expect(screen.getByText('Descripción de Motivo')).toBeTruthy();
    expect(screen.queryByText(/Opcional/i)).toBeNull();
  });

  it.each([['sold', 'Vendido'], ['rented', 'Alquilado'], ['expired', 'Vencido'], ['consumed', 'Consumido']] as const)(
    'registers the exit with the chosen reason (%s)',
    async (reason, label) => {
      mockedProducts.registerEvent.mockResolvedValue({ event_type: reason, quantity: 4, remaining_stock: 26 });
      goToSalida();
      await selectProduct();
      fireEvent.changeText(screen.getByPlaceholderText('0'), '4');
      fireEvent.press(screen.getByText(label));
      await act(async () => {
        fireEvent.press(screen.getByText('Registrar salida'));
      });
      expect(mockedProducts.registerEvent).toHaveBeenCalledWith(1, 4, reason, '');
    },
  );

  it('shows the scan button above the product field, with the same format as the entry one', () => {
    goToSalida();
    expect(screen.getByText('Escanear imágenes')).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('open-exit-scan-modal')).toBeLessThan(tree.indexOf('Buscá un producto que ya tenés cargado'));
    expect(StyleSheet.flatten(screen.getByTestId('open-exit-scan-modal').props.style).borderRadius).toBe(10);
  });

  it('opens the exit scan menu from the button, and not the entry one', () => {
    goToSalida();
    fireEvent.press(screen.getByTestId('open-exit-scan-modal'));
    expect(screen.getByTestId('mock-existing-mode').props.children).toBe('exit');
    fireEvent.press(screen.getByTestId('mock-existing-close'));
    expect(screen.queryByTestId('mock-existing-modal')).toBeNull();
  });

  it('comes back to the exit form with the scanned product already chosen', async () => {
    mockedProducts.registerEvent.mockResolvedValue({ event_type: 'sold', quantity: 2, remaining_stock: 1 });
    goToSalida();
    fireEvent.press(screen.getByTestId('open-exit-scan-modal'));
    fireEvent.press(screen.getByTestId('mock-existing-select'));
    expect(screen.queryByTestId('mock-existing-modal')).toBeNull();
    expect(screen.getByPlaceholderText('Buscá un producto que ya tenés cargado').props.value).toBe('Yogur');
    expect(screen.getByTestId('salida-selected-marca').props.children).toBe('Ser');
    expect(screen.getByTestId('salida-selected-stock').props.children).toBe('5');
    expect(screen.getByTestId('salida-selected-categoria').props.children).toBe('Lacteos');
    fireEvent.changeText(screen.getByPlaceholderText('0'), '2');
    fireEvent.press(screen.getByText('Vendido'));
    await act(async () => {
      fireEvent.press(screen.getByText('Registrar salida'));
    });
    expect(mockedProducts.registerEvent).toHaveBeenCalledWith(7, 2, 'sold', '');
  });

  it('opens the receipt scan for exits when "Factura o remito" is chosen', () => {
    goToSalida();
    fireEvent.press(screen.getByTestId('open-exit-scan-modal'));
    fireEvent.press(screen.getByTestId('mock-existing-receipt'));
    expect(screen.getByTestId('mock-scan-target').props.children).toBe('receipt');
    expect(screen.getByTestId('mock-scan-direction').props.children).toBe('salida');
  });

  it('shows the exit success message after scanning an exit receipt', () => {
    goToSalida();
    fireEvent.press(screen.getByTestId('open-exit-scan-modal'));
    fireEvent.press(screen.getByTestId('mock-existing-receipt'));
    fireEvent.press(screen.getByTestId('mock-scan-success-salida'));
    expect(screen.getByText('Se registró la salida correctamente')).toBeTruthy();
  });

  it('does not show the exit scan button in the entry tab', () => {
    render(<CargarScreen />);
    expect(screen.queryByTestId('open-exit-scan-modal')).toBeNull();
  });
});

describe('CargarScreen - entrada: el comprobante solo ingresa stock', () => {
  it('opens the general scan with receipts that add stock', () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByTestId('open-scan-modal'));
    expect(screen.getByTestId('mock-scan-direction').props.children).toBe('entrada');
  });

  it('keeps entry receipts as entries even after a field scan', () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByTestId('mock-scan-barcode'));
    expect(screen.getByTestId('mock-scan-direction').props.children).toBe('entrada');
  });

  it('shows the stock success message after an entry receipt', () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByTestId('open-scan-modal'));
    fireEvent.press(screen.getByTestId('mock-scan-success-restocked'));
    expect(screen.getByText('Se ingresó el stock del comprobante')).toBeTruthy();
  });
});

describe('CargarScreen - salida: datos informativos del producto elegido', () => {
  const pickByName = async (suggestion: any) => {
    jest.useFakeTimers();
    mockedProducts.suggestProducts.mockResolvedValue([suggestion]);
    render(<CargarScreen />);
    fireEvent.press(screen.getByText('Salida'));
    fireEvent.changeText(screen.getByPlaceholderText('Buscá un producto que ya tenés cargado'), 'lech');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    jest.useRealTimers();
    // Con marca, la sugerencia dice "nombre · marca"
    const label = new RegExp(`^${suggestion.nombre}( · .*)?$`);
    await waitFor(() => expect(screen.getByText(label)).toBeTruthy());
    fireEvent.press(screen.getByText(label));
  };

  it('shows only the name in the field, with the brand and the stock below it', async () => {
    await pickByName({ id: 1, nombre: 'Leche', marca: 'La Serenísima', categoria: 'Lacteos', stock: 12 });
    expect(screen.getByPlaceholderText('Buscá un producto que ya tenés cargado').props.value).toBe('Leche');
    expect(screen.getByTestId('salida-selected-categoria').props.children).toBe('Lacteos');
    expect(screen.getByTestId('salida-selected-marca').props.children).toBe('La Serenísima');
    expect(screen.getByTestId('salida-selected-stock').props.children).toBe('12');
  });

  it('places the info right below the field and above the stock to take out', async () => {
    await pickByName({ id: 1, nombre: 'Leche', marca: 'Ser', categoria: 'Lacteos', stock: 12 });
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('salida-selected-info')).toBeGreaterThan(tree.indexOf('Buscá un producto que ya tenés cargado'));
    expect(tree.indexOf('salida-selected-info')).toBeLessThan(tree.indexOf('Stock a sacar'));
  });

  it('shows just the stock when the product has no brand', async () => {
    await pickByName({ id: 2, nombre: 'Agua', categoria: 'Bebidas', stock: 3 });
    expect(screen.queryByTestId('salida-selected-marca')).toBeNull();
    expect(screen.queryByText('Marca')).toBeNull();
    expect(screen.getByTestId('salida-selected-categoria').props.children).toBe('Bebidas');
    expect(screen.getByTestId('salida-selected-stock').props.children).toBe('3');
  });

  it('shows no info until a product is chosen, and hides it when the name is edited', async () => {
    await pickByName({ id: 1, nombre: 'Leche', marca: 'Ser', categoria: 'Lacteos', stock: 12 });
    fireEvent.changeText(screen.getByPlaceholderText('Buscá un producto que ya tenés cargado'), 'Lec');
    expect(screen.queryByTestId('salida-selected-info')).toBeNull();
  });

  it('shows the info of a product chosen from the scan, without the brand inside the field', () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByText('Salida'));
    expect(screen.queryByTestId('salida-selected-info')).toBeNull();
    fireEvent.press(screen.getByTestId('open-exit-scan-modal'));
    fireEvent.press(screen.getByTestId('mock-existing-select'));
    expect(screen.getByPlaceholderText('Buscá un producto que ya tenés cargado').props.value).toBe('Yogur');
    expect(screen.getByTestId('salida-selected-marca').props.children).toBe('Ser');
    expect(screen.getByTestId('salida-selected-stock').props.children).toBe('5');
  });

  it('shows the expiry date as DD/MM/AAAA, or says there is none', async () => {
    await pickByName({ id: 3, nombre: 'Yogur', marca: 'Ser', categoria: 'Lacteos', stock: 4, vencimiento: '2027-03-05' });
    expect(screen.getByTestId('salida-selected-vencimiento').props.children).toBe('05/03/2027');
  });

  it('leaves the expiry out, like the brand, when the product does not expire', async () => {
    await pickByName({ id: 4, nombre: 'Sal', categoria: 'Almacen', stock: 9 });
    expect(screen.queryByTestId('salida-selected-vencimiento')).toBeNull();
    expect(screen.queryByText('Sin vencimiento')).toBeNull();
    expect(screen.queryByText('Vencimiento')).toBeNull();
  });

  it('shows the four data in order, category, brand, current stock and expiry, as a short card', async () => {
    await pickByName({ id: 5, nombre: 'Queso', marca: 'Ser', categoria: 'Lacteos', stock: 2, vencimiento: '2027-01-01' });
    const tree = JSON.stringify(screen.toJSON());
    const at = (id: string) => tree.indexOf(`"${id}"`);
    expect(at('salida-selected-categoria')).toBeLessThan(at('salida-selected-marca'));
    expect(at('salida-selected-marca')).toBeLessThan(at('salida-selected-stock'));
    expect(at('salida-selected-stock')).toBeLessThan(at('salida-selected-vencimiento'));
    ['Categoría', 'Marca', 'Stock actual', 'Vencimiento'].forEach(label => expect(screen.getByText(label)).toBeTruthy());
    expect(StyleSheet.flatten(screen.getByTestId('salida-selected-info').props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
  });

  it('highlights the current stock with the main color of the app', async () => {
    const { Colors } = require('../src/constants/colors');
    await pickByName({ id: 6, nombre: 'Pan', categoria: 'Panaderia', stock: 7 });
    expect(StyleSheet.flatten(screen.getByTestId('salida-selected-stock').props.style).color).toBe(Colors.primary);
    expect(StyleSheet.flatten(screen.getByTestId('salida-selected-categoria').props.style).color).not.toBe(Colors.primary);
  });
});

describe('CargarScreen - home button', () => {
  it('has the home icon on the left and "Flujo de Producto" on the right, and the icon goes home', () => {
    render(<CargarScreen />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('header-home')).toBeLessThan(tree.indexOf('Flujo de Producto'));
    fireEvent.press(screen.getByTestId('header-home'));
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/');
  });
});

describe('CargarScreen - the success window does not stay', () => {
  const leaveScreen = () => act(() => { mockFocusCleanups.forEach(cleanup => cleanup()); });

  const reachEntrySuccess = () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByTestId('open-scan-modal'));
    fireEvent.press(screen.getByTestId('mock-scan-success-created'));
    expect(screen.getByText('¡Listo!')).toBeTruthy();
  };

  it('is gone when the user leaves for another screen and comes back to Cargar', () => {
    reachEntrySuccess();
    leaveScreen();
    expect(screen.queryByText('¡Listo!')).toBeNull();
    expect(screen.getByText('Guardar producto')).toBeTruthy();
  });

  it('is gone after a registered exit too', async () => {
    mockedProducts.registerEvent.mockResolvedValue({ event_type: 'consumed', quantity: 1, remaining_stock: 2 });
    mockedProducts.suggestProducts.mockResolvedValue([{ id: 1, nombre: 'Leche', categoria: 'Lacteos', stock: 3 } as any]);
    jest.useFakeTimers();
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
    fireEvent.press(screen.getByText('Consumido'));
    await act(async () => {
      fireEvent.press(screen.getByText('Registrar salida'));
    });
    expect(screen.getByText('Se registró la salida correctamente')).toBeTruthy();
    leaveScreen();
    expect(screen.queryByText('Se registró la salida correctamente')).toBeNull();
    expect(screen.getByText('Registrar salida')).toBeTruthy();
  });

  it('is gone as soon as "Ver inventario" is pressed, and the inventory opens', () => {
    reachEntrySuccess();
    fireEvent.press(screen.getByText('Ver inventario'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/inventario');
    expect(screen.queryByText('¡Listo!')).toBeNull();
  });

  it('is gone when leaving with the home icon of another screen too, which is the same as leaving this one', () => {
    reachEntrySuccess();
    leaveScreen();
    leaveScreen();
    expect(screen.queryByText('¡Listo!')).toBeNull();
  });

  it('leaves the form the user is filling in alone when there is no success window', () => {
    render(<CargarScreen />);
    fireEvent.changeText(screen.getByTestId('mock-form-nombre'), 'Leche');
    leaveScreen();
    expect(screen.getByTestId('mock-form-nombre').props.value).toBe('Leche');
  });

  it('starts a clean form after the success window was left behind', () => {
    render(<CargarScreen />);
    fireEvent.changeText(screen.getByTestId('mock-form-nombre'), 'Leche');
    fireEvent.press(screen.getByTestId('open-scan-modal'));
    fireEvent.press(screen.getByTestId('mock-scan-success-created'));
    leaveScreen();
    expect(screen.getByTestId('mock-form-nombre').props.value).toBe('');
  });

  it('still lets the user load another product from the success window', () => {
    reachEntrySuccess();
    fireEvent.press(screen.getByText('Cargar otro'));
    expect(screen.queryByText('¡Listo!')).toBeNull();
    expect(screen.getByText('Guardar producto')).toBeTruthy();
  });
});

describe('CargarScreen - success screen buttons and check mark', () => {
  const duration = () => (slideTransition.transitionSpec as { config: { duration: number } }).config.duration;

  const reachSuccess = () => {
    render(<CargarScreen />);
    fireEvent.press(screen.getByTestId('open-existing-modal'));
    fireEvent.press(screen.getByTestId('mock-existing-success'));
  };

  beforeEach(() => resetTabTransition());

  afterEach(() => {
    jest.useRealTimers();
  });

  it('pops the check mark up when the success screen appears', () => {
    reachSuccess();
    expect(screen.getByText('¡Listo!')).toBeTruthy();
    expect(screen.getByTestId('success-check')).toBeTruthy();
  });

  it('opens the inventory without sliding the screen when "Ver inventario" is pressed', () => {
    jest.useFakeTimers();
    reachSuccess();
    expect(duration()).toBe(280);
    fireEvent.press(screen.getByText('Ver inventario'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/inventario');
    expect(duration()).toBe(0);
    jest.advanceTimersByTime(1000);
    expect(duration()).toBe(280);
  });

  it('does not slide anything when "Cargar otro" is pressed: it only gets the form ready again', () => {
    reachSuccess();
    fireEvent.press(screen.getByText('Cargar otro'));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(duration()).toBe(280);
    expect(screen.getByText('Guardar producto')).toBeTruthy();
  });
});
