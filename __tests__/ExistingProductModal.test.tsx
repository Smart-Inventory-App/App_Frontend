import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import ExistingProductModal from '../src/components/ExistingProductModal';
import { productService } from '@/services/productService';
import { ocrService } from '@/services/ocrService';
import { ProductDraft, ScanResult, ScanState } from '@/types/ocr';

jest.mock('@/services/productService', () => ({
  productService: {
    suggestProducts: jest.fn(),
    matchProducts: jest.fn(),
    getProductsByBarcode: jest.fn(),
    restockProduct: jest.fn(),
  },
}));

jest.mock('@/services/ocrService', () => ({
  ocrService: {
    pickImage: jest.fn(),
    scan: jest.fn(),
    pollJob: jest.fn(),
  },
  getScanErrorMessage: jest.fn((err: unknown, fallback: string) => {
    const detail = (err as any)?.response?.data?.detail;
    return typeof detail === 'string' ? detail : fallback;
  }),
}));

const mockedProducts = productService as jest.Mocked<typeof productService>;
const mockedOcr = ocrService as jest.Mocked<typeof ocrService>;

const LECHE = { id: 1, nombre: 'Leche', marca: 'Ser', categoria: 'Lacteos', stock: 4, vencimiento: '2027-03-01' };
const LECHE_2 = { id: 2, nombre: 'Leche entera', categoria: 'Lacteos', stock: 7 };

const baseDraft = (overrides: Partial<ProductDraft> = {}): ProductDraft => ({
  confianzas: {},
  coincidencias: [],
  ...overrides,
});

const scanned = (docType: 'barcode' | 'product_label', draft: ProductDraft): ScanState => ({
  status: 'done',
  doc_type: docType,
  result: {
    doc_type: docType,
    draft,
    items: [],
    comprobante: null,
    needs_review: false,
    confianza: 0.9,
    texto_legible: '',
    advertencias: [],
    sin_coincidencia: 0,
  } as ScanResult,
} as ScanState);

function setup() {
  const onClose = jest.fn();
  const onSuccess = jest.fn();
  render(<ExistingProductModal visible onClose={onClose} onSuccess={onSuccess} />);
  return { onClose, onSuccess };
}

const scanWith = async (state: ScanState) => {
  mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
  mockedOcr.scan.mockResolvedValue(state);
  await act(async () => {
    fireEvent.press(screen.getByTestId('existing-source-camera'));
  });
};

const confirmEdit = async () => {
  await act(async () => {
    fireEvent.press(screen.getByTestId('existing-edit-confirm'));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedProducts.suggestProducts.mockResolvedValue([]);
  mockedProducts.matchProducts.mockResolvedValue([]);
  mockedProducts.getProductsByBarcode.mockResolvedValue([]);
  mockedProducts.restockProduct.mockResolvedValue({} as any);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ExistingProductModal - menu', () => {
  it('offers the three ways to find the product', () => {
    setup();
    expect(screen.getByText('Ingresar producto existente')).toBeTruthy();
    expect(screen.getByText('Ingresar nombre')).toBeTruthy();
    expect(screen.getByText('Escanear etiqueta de producto')).toBeTruthy();
    expect(screen.getByText('Escanear código de barras')).toBeTruthy();
  });

  it('starts as a sheet from the bottom: tapping outside of it closes it, tapping on it does not', () => {
    const { onClose } = setup();
    const { Modal } = require('react-native');
    expect(screen.UNSAFE_getAllByType(Modal)[0].props.animationType).toBe('none');
    fireEvent.press(screen.getByTestId('existing-initial-sheet'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('existing-initial-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('once a way is chosen, the sheet gives way to a window in the center that only closes from its own buttons', () => {
    const { onClose } = setup();
    const { Modal } = require('react-native');
    fireEvent.press(screen.getByTestId('existing-method-name'));
    expect(screen.UNSAFE_getAllByType(Modal)[1].props.animationType).toBe('fade');
    expect(screen.UNSAFE_getAllByType(Modal)[1].props.visible).toBe(true);
    fireEvent.press(screen.getByTestId('existing-overlay'));
    fireEvent.press(screen.getByTestId('existing-sheet'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.press(within(screen.getByTestId('existing-sheet')).getByTestId('existing-modal-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes with the system back button, from the sheet and from the window', () => {
    const { onClose } = setup();
    const { Modal } = require('react-native');
    act(() => { screen.UNSAFE_getAllByType(Modal)[0].props.onRequestClose(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('existing-method-name'));
    act(() => { screen.UNSAFE_getAllByType(Modal)[1].props.onRequestClose(); });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('comes back to the sheet from the window with the back link', () => {
    setup();
    const { Modal } = require('react-native');
    fireEvent.press(screen.getByTestId('existing-method-label'));
    expect(screen.UNSAFE_getAllByType(Modal)[1].props.visible).toBe(true);
    fireEvent.press(within(screen.getByTestId('existing-sheet')).getByTestId('existing-back'));
    expect(screen.UNSAFE_getAllByType(Modal)[0].props.visible).toBe(true);
    expect(screen.UNSAFE_getAllByType(Modal)[1].props.visible).toBe(false);
  });

  it('closes with the close button and shows nothing while hidden', () => {
    const { onClose } = setup();
    fireEvent.press(screen.getByTestId('existing-modal-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while hidden and starts again from the menu when reopened', () => {
    const { rerender } = render(<ExistingProductModal visible={false} onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.queryByText('Ingresar nombre')).toBeNull();
    rerender(<ExistingProductModal visible onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.press(screen.getByTestId('existing-method-name'));
    rerender(<ExistingProductModal visible={false} onClose={jest.fn()} onSuccess={jest.fn()} />);
    rerender(<ExistingProductModal visible onClose={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText('Ingresar nombre')).toBeTruthy();
  });
});

describe('ExistingProductModal - by name', () => {
  const openByName = () => {
    const handlers = setup();
    fireEvent.press(screen.getByTestId('existing-method-name'));
    return handlers;
  };

  it('separates the "Elegí el producto" title from the name field', async () => {
    jest.useFakeTimers();
    mockedProducts.suggestProducts.mockResolvedValue([LECHE]);
    openByName();
    fireEvent.changeText(screen.getByTestId('existing-name-input'), 'Le');
    await act(async () => { jest.advanceTimersByTime(350); });
    const { StyleSheet } = require('react-native');
    expect(StyleSheet.flatten(screen.getByTestId('existing-options-title').props.style).marginTop).toBe(24);
  });

  it('suggests existing products while the name is typed', async () => {
    jest.useFakeTimers();
    mockedProducts.suggestProducts.mockResolvedValue([LECHE, LECHE_2]);
    openByName();
    fireEvent.changeText(screen.getByTestId('existing-name-input'), 'Le');
    await act(async () => { jest.advanceTimersByTime(350); });
    expect(mockedProducts.suggestProducts).toHaveBeenCalledWith('Le');
    expect(screen.getByTestId('existing-option-product-1')).toBeTruthy();
    expect(screen.getByTestId('existing-option-product-2')).toBeTruthy();
    expect(screen.getByText(/Vence 01\/03\/2027/)).toBeTruthy();
    expect(screen.getByText(/Sin vencimiento/)).toBeTruthy();
    expect(screen.queryByTestId('existing-stock-input')).toBeNull();
  });

  it('does not search with less than two letters and ignores a failed search', async () => {
    jest.useFakeTimers();
    openByName();
    fireEvent.changeText(screen.getByTestId('existing-name-input'), 'L');
    await act(async () => { jest.advanceTimersByTime(350); });
    expect(mockedProducts.suggestProducts).not.toHaveBeenCalled();
    mockedProducts.suggestProducts.mockRejectedValue(new Error('boom'));
    fireEvent.changeText(screen.getByTestId('existing-name-input'), 'Le');
    await act(async () => { jest.advanceTimersByTime(350); });
    expect(screen.queryByTestId('existing-option-product-1')).toBeNull();
  });

  it('after choosing a product, hides the other options and asks for the stock to add with cancel and confirm', async () => {
    jest.useFakeTimers();
    mockedProducts.suggestProducts.mockResolvedValue([LECHE, LECHE_2]);
    openByName();
    fireEvent.changeText(screen.getByTestId('existing-name-input'), 'Le');
    await act(async () => { jest.advanceTimersByTime(350); });
    fireEvent.press(screen.getByTestId('existing-option-product-1'));
    expect(screen.queryByTestId('existing-option-product-2')).toBeNull();
    expect(screen.getByTestId('existing-name-input').props.value).toBe('Leche');
    expect(screen.getByTestId('existing-selected-stock').props.children).toBe('4');
    expect(screen.getByTestId('existing-stock-input')).toBeTruthy();
    expect(screen.getByTestId('existing-cancel')).toBeTruthy();
    expect(screen.getByTestId('existing-confirm')).toBeTruthy();
  });

  it('adds the stock to the chosen product and reports success', async () => {
    jest.useFakeTimers();
    mockedProducts.suggestProducts.mockResolvedValue([LECHE]);
    const { onSuccess, onClose } = openByName();
    fireEvent.changeText(screen.getByTestId('existing-name-input'), 'Le');
    await act(async () => { jest.advanceTimersByTime(350); });
    fireEvent.press(screen.getByTestId('existing-option-product-1'));
    fireEvent.changeText(screen.getByTestId('existing-stock-input'), '1a2');
    expect(screen.getByTestId('existing-stock-input').props.value).toBe('12');
    await act(async () => {
      fireEvent.press(screen.getByTestId('existing-confirm'));
    });
    expect(mockedProducts.restockProduct).toHaveBeenCalledWith(1, 12);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('refuses an empty or zero stock', async () => {
    jest.useFakeTimers();
    mockedProducts.suggestProducts.mockResolvedValue([LECHE]);
    const { onSuccess } = openByName();
    fireEvent.changeText(screen.getByTestId('existing-name-input'), 'Le');
    await act(async () => { jest.advanceTimersByTime(350); });
    fireEvent.press(screen.getByTestId('existing-option-product-1'));
    await act(async () => { fireEvent.press(screen.getByTestId('existing-confirm')); });
    expect(screen.getByText('El stock debe ser mayor a 0')).toBeTruthy();
    // el mensaje va debajo del campo de stock, separado de él
    const { StyleSheet } = require('react-native');
    expect(StyleSheet.flatten(screen.getByTestId('existing-error').props.style).marginTop).toBeGreaterThanOrEqual(6);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('"testID":"existing-error"')).toBeGreaterThan(tree.indexOf('"testID":"existing-stock-input"'));
    fireEvent.changeText(screen.getByTestId('existing-stock-input'), '0');
    await act(async () => { fireEvent.press(screen.getByTestId('existing-confirm')); });
    expect(screen.getByText('El stock debe ser mayor a 0')).toBeTruthy();
    expect(mockedProducts.restockProduct).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('shows the server error, or a generic one, when the stock cannot be added', async () => {
    jest.useFakeTimers();
    mockedProducts.suggestProducts.mockResolvedValue([LECHE]);
    openByName();
    fireEvent.changeText(screen.getByTestId('existing-name-input'), 'Le');
    await act(async () => { jest.advanceTimersByTime(350); });
    fireEvent.press(screen.getByTestId('existing-option-product-1'));
    fireEvent.changeText(screen.getByTestId('existing-stock-input'), '3');
    mockedProducts.restockProduct.mockRejectedValueOnce({ response: { data: { detail: 'Cantidad inválida' } } });
    await act(async () => { fireEvent.press(screen.getByTestId('existing-confirm')); });
    expect(screen.getByText('Cantidad inválida')).toBeTruthy();
    mockedProducts.restockProduct.mockRejectedValueOnce(new Error('network'));
    await act(async () => { fireEvent.press(screen.getByTestId('existing-confirm')); });
    expect(screen.getByText('No se pudo guardar el producto')).toBeTruthy();
  });

  it('shows the options again when the name is edited after choosing, and cancel closes the window', async () => {
    jest.useFakeTimers();
    mockedProducts.suggestProducts.mockResolvedValue([LECHE]);
    const { onClose } = openByName();
    fireEvent.changeText(screen.getByTestId('existing-name-input'), 'Le');
    await act(async () => { jest.advanceTimersByTime(350); });
    fireEvent.press(screen.getByTestId('existing-option-product-1'));
    fireEvent.changeText(screen.getByTestId('existing-name-input'), 'Lec');
    await act(async () => { jest.advanceTimersByTime(350); });
    expect(screen.queryByTestId('existing-stock-input')).toBeNull();
    expect(screen.getByTestId('existing-option-product-1')).toBeTruthy();
    fireEvent.press(screen.getByTestId('existing-option-product-1'));
    fireEvent.press(screen.getByTestId('existing-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('goes back to the menu', () => {
    openByName();
    fireEvent.press(screen.getByTestId('existing-back'));
    expect(screen.getByText('Escanear etiqueta de producto')).toBeTruthy();
  });
});

describe('ExistingProductModal - by barcode', () => {
  const openByBarcode = () => {
    const handlers = setup();
    fireEvent.press(screen.getByTestId('existing-method-barcode'));
    return handlers;
  };

  it('does not ask to crop the photo of a barcode', async () => {
    openByBarcode();
    mockedOcr.pickImage.mockResolvedValue(null);
    await act(async () => { fireEvent.press(screen.getByTestId('existing-source-camera')); });
    expect(mockedOcr.pickImage).toHaveBeenCalledWith('camera', false);
  });

  it('asks how to load the photo, with a way back', () => {
    openByBarcode();
    expect(screen.getByText('Elegí cómo cargar la foto')).toBeTruthy();
    expect(screen.getByTestId('existing-source-gallery')).toBeTruthy();
    fireEvent.press(screen.getByTestId('existing-back'));
    expect(screen.getByText('Ingresar nombre')).toBeTruthy();
  });

  it('shows the scanned barcode so it can be edited, then lists the products that have it', async () => {
    mockedProducts.getProductsByBarcode.mockResolvedValue([LECHE, LECHE_2]);
    openByBarcode();
    await scanWith(scanned('barcode', baseDraft({ codigo_barras: '7791234567898' })));
    expect(screen.getByText('Código de barras escaneado')).toBeTruthy();
    expect(screen.getByTestId('existing-barcode-input').props.value).toBe('7791234567898');
    fireEvent.changeText(screen.getByTestId('existing-barcode-input'), '7791234 56789a8');
    expect(screen.getByTestId('existing-barcode-input').props.value).toBe('7791234567898');
    await confirmEdit();
    expect(mockedProducts.getProductsByBarcode).toHaveBeenCalledWith('7791234567898');
    expect(screen.getByTestId('existing-option-product-1')).toBeTruthy();
    expect(screen.getByTestId('existing-option-product-2')).toBeTruthy();
    expect(screen.queryByTestId('existing-stock-input')).toBeNull();
  });

  it('after choosing a product, shows its information and asks for the stock; "Cambiar" brings the options back', async () => {
    mockedProducts.getProductsByBarcode.mockResolvedValue([LECHE, LECHE_2]);
    const { onSuccess } = openByBarcode();
    await scanWith(scanned('barcode', baseDraft({ codigo_barras: '7791234567898' })));
    await confirmEdit();
    expect(screen.getByText('Productos reconocidos')).toBeTruthy();
    fireEvent.press(screen.getByTestId('existing-option-product-2'));
    expect(screen.queryByTestId('existing-option-product-1')).toBeNull();
    // el mismo recuadro que al ingresar por nombre
    expect(screen.getByTestId('existing-selected-info')).toBeTruthy();
    expect(screen.getByTestId('existing-selected-categoria').props.children).toBe('Lacteos');
    expect(screen.getByTestId('existing-selected-stock').props.children).toBe('7');
    // "Cambiar" ocupa el lugar de "Cancelar", al lado de "Confirmar", y no hay otro debajo de la información del producto
    expect(screen.queryByTestId('existing-cancel')).toBeNull();
    const tree = JSON.stringify(screen.toJSON());
    const at = (id: string) => tree.indexOf(`"testID":"${id}"`);
    expect(at('existing-change')).toBeGreaterThan(at('existing-stock-input'));
    expect(at('existing-change')).toBeLessThan(at('existing-confirm'));
    fireEvent.press(screen.getByTestId('existing-change'));
    expect(screen.getByTestId('existing-option-product-1')).toBeTruthy();
    expect(screen.queryByTestId('existing-stock-input')).toBeNull();

    fireEvent.press(screen.getByTestId('existing-option-product-1'));
    fireEvent.changeText(screen.getByTestId('existing-stock-input'), '5');
    await act(async () => { fireEvent.press(screen.getByTestId('existing-confirm')); });
    expect(mockedProducts.restockProduct).toHaveBeenCalledWith(1, 5);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('with no product with that code, says so and offers to edit again or load a new product, one above the other', async () => {
    mockedProducts.getProductsByBarcode.mockResolvedValue([]);
    const onLoadAsNew = jest.fn();
    render(<ExistingProductModal visible onClose={jest.fn()} onSuccess={jest.fn()} onLoadAsNew={onLoadAsNew} />);
    fireEvent.press(screen.getByTestId('existing-method-barcode'));
    await scanWith(scanned('barcode', baseDraft({ codigo_barras: '7791234567898' })));
    await confirmEdit();
    expect(screen.getByTestId('existing-not-found').props.children).toBe('No existe un producto con la información escaneada');
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('existing-edit-again')).toBeLessThan(tree.indexOf('existing-load-new'));
    expect(screen.getByText('Editar de nuevo')).toBeTruthy();
    expect(screen.getByText('Cargar nuevo producto')).toBeTruthy();

    // cargar nuevo producto lleva el código escaneado
    fireEvent.press(screen.getByTestId('existing-load-new'));
    expect(onLoadAsNew).toHaveBeenCalledWith({
      draft: { confianzas: {}, coincidencias: [], codigo_barras: '7791234567898' },
      asset: null,
    });

    // editar de nuevo vuelve al código, para corregirlo y buscar otra vez
    fireEvent.press(screen.getByTestId('existing-edit-again'));
    mockedProducts.getProductsByBarcode.mockResolvedValue([LECHE]);
    fireEvent.changeText(screen.getByTestId('existing-barcode-input'), '7790000000003');
    await confirmEdit();
    expect(mockedProducts.getProductsByBarcode).toHaveBeenLastCalledWith('7790000000003');
    expect(screen.getByTestId('existing-option-product-1')).toBeTruthy();
  });

  it('refuses an invalid barcode without searching', async () => {
    openByBarcode();
    await scanWith(scanned('barcode', baseDraft({})));
    expect(screen.getByText('No se pudo leer un código de barras en la foto. Escribilo a mano o volvé a escanear con una foto más nítida.')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('existing-barcode-input'), '123');
    await confirmEdit();
    expect(screen.getByText('El código de barras es inválido')).toBeTruthy();
    // el mensaje va debajo del campo, antes de los botones
    const tree = JSON.stringify(screen.toJSON());
    const at = (id: string) => tree.indexOf(`"testID":"${id}"`);
    expect(at('existing-error')).toBeGreaterThan(at('existing-barcode-input'));
    expect(at('existing-error')).toBeLessThan(at('existing-edit-cancel'));
    expect(mockedProducts.getProductsByBarcode).not.toHaveBeenCalled();
  });

  it('shows a readable error if the search fails', async () => {
    mockedProducts.getProductsByBarcode.mockRejectedValue(new Error('boom'));
    openByBarcode();
    await scanWith(scanned('barcode', baseDraft({ codigo_barras: '7791234567898' })));
    await confirmEdit();
    expect(screen.getByText('No se pudieron buscar los productos. Intentá de nuevo.')).toBeTruthy();
  });

  it('goes back to the photo options with a descriptive error when the scan fails', async () => {
    openByBarcode();
    await scanWith({ status: 'failed', error: 'boom' } as ScanState);
    expect(screen.getByText('No se pudo leer la foto: boom. Probá con otra foto más nítida y bien iluminada.')).toBeTruthy();
    expect(screen.getByTestId('existing-source-camera')).toBeTruthy();
  });

  it('explains how to fix a failed scan even when no reason came with it', async () => {
    openByBarcode();
    await scanWith({ status: 'failed' } as ScanState);
    expect(screen.getByText('No se pudo leer la foto. Probá con otra foto más nítida y bien iluminada.')).toBeTruthy();
  });

  it('does nothing if no photo was taken, and shows the picker error otherwise', async () => {
    openByBarcode();
    mockedOcr.pickImage.mockResolvedValueOnce(null);
    await act(async () => { fireEvent.press(screen.getByTestId('existing-source-gallery')); });
    expect(mockedOcr.scan).not.toHaveBeenCalled();
    mockedOcr.pickImage.mockRejectedValueOnce(new Error('Se necesita permiso para usar la cámara.'));
    await act(async () => { fireEvent.press(screen.getByTestId('existing-source-camera')); });
    expect(screen.getByText('Se necesita permiso para usar la cámara.')).toBeTruthy();
  });

  it('waits for a queued scan and shows its position', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({ status: 'queued', job_id: 'j1' } as ScanState);
    let release: (state: ScanState) => void = () => {};
    mockedOcr.pollJob.mockImplementation((_id, options: any) => new Promise<ScanState>(resolve => {
      options.onUpdate({ queue_position: 2, estimated_wait_seconds: 90 });
      release = resolve;
    }));
    openByBarcode();
    await act(async () => { fireEvent.press(screen.getByTestId('existing-source-camera')); });
    expect(screen.getByText('Leyendo la imagen...')).toBeTruthy();
    expect(screen.getByText('Lugar 2 en la fila')).toBeTruthy();
    await act(async () => { release(scanned('barcode', baseDraft({ codigo_barras: '7791234567898' }))); });
    expect(screen.getByTestId('existing-barcode-input').props.value).toBe('7791234567898');
  });

  it('shows the timeout and upload errors of the scan', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    openByBarcode();
    mockedOcr.scan.mockRejectedValueOnce(new Error('timeout'));
    await act(async () => { fireEvent.press(screen.getByTestId('existing-source-camera')); });
    expect(screen.getByText('El escaneo está tardando más de lo esperado, probá de nuevo')).toBeTruthy();
    mockedOcr.scan.mockRejectedValueOnce({ response: { data: { detail: 'Foto muy pesada' } } });
    await act(async () => { fireEvent.press(screen.getByTestId('existing-source-camera')); });
    expect(screen.getByText('Foto muy pesada')).toBeTruthy();
    mockedOcr.scan.mockRejectedValueOnce(new Error('cancelado'));
    await act(async () => { fireEvent.press(screen.getByTestId('existing-source-camera')); });
    expect(screen.getByTestId('existing-source-camera')).toBeTruthy();
  });
});

describe('ExistingProductModal - by label', () => {
  const openByLabel = () => {
    const handlers = setup();
    fireEvent.press(screen.getByTestId('existing-method-label'));
    return handlers;
  };
  const labelDraft = () => baseDraft({
    nombre: 'Leche entera',
    marca: 'Ser',
    categoria: 'Lacteos',
    vencimiento: '2027-03-01',
    texto_leido: 'LECHE ENTERA SER',
    coincidencias: [{ id: 2, nombre: 'Leche entera', score: 0.8, por_codigo: false, stock: 7 }],
  });

  it('shows what was read and lets the name be edited before searching', async () => {
    openByLabel();
    await scanWith(scanned('product_label', labelDraft()));
    expect(screen.getByText('Información leída de la etiqueta')).toBeTruthy();
    expect(screen.getByText('Texto leído: LECHE ENTERA SER')).toBeTruthy();
    expect(screen.getByText('Marca: Ser')).toBeTruthy();
    expect(screen.getByText('Categoría: Lacteos')).toBeTruthy();
    expect(screen.getByText('Vencimiento: 01/03/2027')).toBeTruthy();
    expect(screen.getByTestId('existing-label-name-input').props.value).toBe('Leche entera');
    fireEvent.changeText(screen.getByTestId('existing-label-name-input'), 'Leche');
    expect(screen.getByTestId('existing-label-name-input').props.value).toBe('Leche');
  });

  it('asks to crop the photo of the label, from the camera and from the gallery', async () => {
    openByLabel();
    mockedOcr.pickImage.mockResolvedValue(null);
    await act(async () => { fireEvent.press(screen.getByTestId('existing-source-camera')); });
    await act(async () => { fireEvent.press(screen.getByTestId('existing-source-gallery')); });
    expect(mockedOcr.pickImage.mock.calls).toEqual([['camera', true], ['gallery', true]]);
  });

  it('once the name is confirmed, lists the recognized products and then asks for the stock of the chosen one', async () => {
    mockedProducts.matchProducts.mockResolvedValue([LECHE, LECHE_2]);
    const { onSuccess } = openByLabel();
    await scanWith(scanned('product_label', labelDraft()));
    fireEvent.changeText(screen.getByTestId('existing-label-name-input'), 'Leche');
    await confirmEdit();
    expect(screen.getByText('Productos reconocidos')).toBeTruthy();
    expect(screen.queryByText('Elegí el producto')).toBeNull();
    expect(screen.getByTestId('existing-option-product-1')).toBeTruthy();
    fireEvent.press(screen.getByTestId('existing-option-product-1'));
    expect(screen.queryByTestId('existing-option-product-2')).toBeNull();
    expect(screen.getByTestId('existing-selected-info')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('existing-stock-input'), '2');
    await act(async () => { fireEvent.press(screen.getByTestId('existing-confirm')); });
    expect(mockedProducts.restockProduct).toHaveBeenCalledWith(1, 2);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('searches with the scanned text: the name together with the brand and the description that were read', async () => {
    mockedProducts.matchProducts.mockResolvedValue([LECHE]);
    openByLabel();
    await scanWith(scanned('product_label', baseDraft({ nombre: 'Leche', marca: 'Ser', descripcion: 'Entera 1L' })));
    await confirmEdit();
    expect(mockedProducts.matchProducts).toHaveBeenCalledWith('Leche Ser Entera 1L');
    expect(mockedProducts.suggestProducts).not.toHaveBeenCalled();
  });

  it('uses the matches found by the scan when the name was kept as read and the search finds nothing', async () => {
    openByLabel();
    await scanWith(scanned('product_label', labelDraft()));
    await confirmEdit();
    expect(screen.getByTestId('existing-option-product-2')).toBeTruthy();
  });

  it('with no recognized product, says so and offers to edit again or load a new product, one above the other', async () => {
    const onLoadAsNew = jest.fn();
    render(<ExistingProductModal visible onClose={jest.fn()} onSuccess={jest.fn()} onLoadAsNew={onLoadAsNew} />);
    fireEvent.press(screen.getByTestId('existing-method-label'));
    await scanWith(scanned('product_label', baseDraft({ nombre: 'Algo raro', texto_leido: 'ALGO RARO' })));
    fireEvent.changeText(screen.getByTestId('existing-label-name-input'), 'Algo raro validado');
    await confirmEdit();
    expect(screen.getByTestId('existing-not-found').props.children).toBe('No existe un producto con la información escaneada');
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('existing-edit-again')).toBeLessThan(tree.indexOf('existing-load-new'));

    // cargar nuevo producto: el nombre validado, lo leído y la foto pasan a la ventana del producto nuevo
    fireEvent.press(screen.getByTestId('existing-load-new'));
    expect(onLoadAsNew).toHaveBeenCalledWith({
      draft: expect.objectContaining({ nombre: 'Algo raro validado', texto_leido: 'ALGO RARO' }),
      asset: { uri: 'file://x.jpg' },
    });

    // editar de nuevo vuelve a la lectura
    fireEvent.press(screen.getByTestId('existing-edit-again'));
    mockedProducts.matchProducts.mockResolvedValue([LECHE]);
    fireEvent.changeText(screen.getByTestId('existing-label-name-input'), 'Leche');
    await confirmEdit();
    expect(screen.getByTestId('existing-option-product-1')).toBeTruthy();
  });

  it('asks for the name when it is empty, without searching', async () => {
    openByLabel();
    await scanWith(scanned('product_label', baseDraft({})));
    await confirmEdit();
    expect(screen.getByTestId('existing-error').props.children).toBe('Escribí el nombre del producto');
    // el mensaje va debajo del campo del nombre, antes de los botones
    const tree = JSON.stringify(screen.toJSON());
    const at = (id: string) => tree.indexOf(`"testID":"${id}"`);
    expect(at('existing-error')).toBeGreaterThan(at('existing-label-name-input'));
    expect(at('existing-error')).toBeLessThan(at('existing-edit-cancel'));
    expect(mockedProducts.matchProducts).not.toHaveBeenCalled();
  });

  it('tells the user when the label has no readable name', async () => {
    openByLabel();
    await scanWith(scanned('product_label', baseDraft({ marca: 'Ser' })));
    expect(screen.getByText('No se pudo leer el nombre del producto en la etiqueta. Escribilo para continuar.')).toBeTruthy();
  });

  it('does not show that hint when the name was read', async () => {
    openByLabel();
    await scanWith(scanned('product_label', labelDraft()));
    expect(screen.queryByTestId('existing-name-not-read')).toBeNull();
  });

  it('lets the user go back to edit the name after seeing the options', async () => {
    mockedProducts.matchProducts.mockResolvedValue([LECHE]);
    openByLabel();
    await scanWith(scanned('product_label', labelDraft()));
    await confirmEdit();
    fireEvent.press(screen.getByTestId('existing-edit-again'));
    expect(screen.getByTestId('existing-label-name-input')).toBeTruthy();
    expect(screen.queryByTestId('existing-option-product-1')).toBeNull();
  });

  it('cancel closes the window from the edit step', async () => {
    const { onClose } = openByLabel();
    await scanWith(scanned('product_label', labelDraft()));
    fireEvent.press(screen.getByTestId('existing-edit-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('works when the scan returns no draft at all', async () => {
    openByLabel();
    await scanWith({ status: 'done', doc_type: 'product_label', result: { doc_type: 'product_label', draft: null, items: [], comprobante: null } } as any);
    expect(screen.getByTestId('existing-label-name-input').props.value).toBe('');
  });
});

describe('ExistingProductModal - exit mode (scan for a stock exit)', () => {
  const setupExit = () => {
    const onClose = jest.fn();
    const onSelectProduct = jest.fn();
    const onPickReceipt = jest.fn();
    render(
      <ExistingProductModal visible mode="exit" onClose={onClose} onSelectProduct={onSelectProduct} onPickReceipt={onPickReceipt} />,
    );
    return { onClose, onSelectProduct, onPickReceipt };
  };

  it('is titled "Escanear imagen" and offers barcode, label and invoice or receipt, in that order', () => {
    setupExit();
    expect(screen.getByText('Escanear imagen')).toBeTruthy();
    expect(screen.queryByText('Escanear imágenes')).toBeNull();
    expect(screen.getByText('¿Qué estás por escanear?')).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    const order = ['Código de barras', 'Etiqueta de producto', 'Ticket, remito o factura'].map(label => tree.indexOf(label));
    expect(order.every(i => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(screen.queryByTestId('existing-method-name')).toBeNull();
  });

  it('hands the invoice or receipt over to the receipt scan and closes this window', () => {
    const { onPickReceipt, onClose } = setupExit();
    fireEvent.press(screen.getByTestId('existing-method-receipt'));
    expect(onPickReceipt).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('by barcode: reads, lets the user fix the code, shows the chosen product and returns it to the exit form on confirm', async () => {
    mockedProducts.getProductsByBarcode.mockResolvedValue([LECHE, LECHE_2]);
    const { onSelectProduct, onClose } = setupExit();
    fireEvent.press(screen.getByTestId('existing-method-barcode'));
    await scanWith(scanned('barcode', baseDraft({ codigo_barras: '7791234567898' })));
    expect(screen.getByTestId('existing-barcode-input').props.value).toBe('7791234567898');
    await confirmEdit();
    expect(screen.getByText('Productos reconocidos')).toBeTruthy();
    fireEvent.press(screen.getByTestId('existing-option-product-2'));
    expect(screen.getByTestId('existing-selected-info')).toBeTruthy();
    expect(onSelectProduct).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('existing-confirm'));
    expect(onSelectProduct).toHaveBeenCalledWith(LECHE_2);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockedProducts.restockProduct).not.toHaveBeenCalled();
  });

  it('by barcode: with no product with that code, says so and only offers to go back', async () => {
    mockedProducts.getProductsByBarcode.mockResolvedValue([]);
    const { onSelectProduct } = setupExit();
    fireEvent.press(screen.getByTestId('existing-method-barcode'));
    await scanWith(scanned('barcode', baseDraft({ codigo_barras: '7791234567898' })));
    await confirmEdit();
    expect(screen.getByTestId('existing-not-found').props.children).toBe('No existe un producto con la información escaneada');
    expect(screen.getByText('Volver atrás')).toBeTruthy();
    expect(screen.queryByTestId('existing-load-new')).toBeNull();
    expect(screen.queryByTestId('existing-edit-again')).toBeNull();
    fireEvent.press(screen.getByTestId('existing-not-found-back'));
    expect(screen.getByTestId('existing-barcode-input')).toBeTruthy();
    expect(onSelectProduct).not.toHaveBeenCalled();
  });

  it('by label: shows what was read, lets the name be fixed, shows the chosen product and returns it on confirm', async () => {
    mockedProducts.matchProducts.mockResolvedValue([LECHE, LECHE_2]);
    const { onSelectProduct, onClose } = setupExit();
    fireEvent.press(screen.getByTestId('existing-method-label'));
    await scanWith(scanned('product_label', baseDraft({ nombre: 'Leche entera', marca: 'Ser' })));
    expect(screen.getByText('Información leída de la etiqueta')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('existing-label-name-input'), 'Leche');
    await confirmEdit();
    expect(mockedProducts.matchProducts).toHaveBeenCalledWith('Leche Ser');
    expect(screen.getByText('Productos reconocidos')).toBeTruthy();
    fireEvent.press(screen.getByTestId('existing-option-product-1'));
    expect(screen.getByTestId('existing-selected-stock').props.children).toBe('4');
    fireEvent.press(screen.getByTestId('existing-confirm'));
    expect(onSelectProduct).toHaveBeenCalledWith(LECHE);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('by label: with no recognized product, says so and only offers to go back', async () => {
    setupExit();
    fireEvent.press(screen.getByTestId('existing-method-label'));
    await scanWith(scanned('product_label', baseDraft({ nombre: 'Algo raro' })));
    await confirmEdit();
    expect(screen.getByText('No existe un producto con la información escaneada')).toBeTruthy();
    expect(screen.queryByTestId('existing-load-new')).toBeNull();
    fireEvent.press(screen.getByTestId('existing-not-found-back'));
    expect(screen.getByTestId('existing-label-name-input')).toBeTruthy();
  });

  it('can pick another product after seeing the chosen one, without returning anything', async () => {
    mockedProducts.getProductsByBarcode.mockResolvedValue([LECHE, LECHE_2]);
    const { onSelectProduct, onClose } = setupExit();
    fireEvent.press(screen.getByTestId('existing-method-barcode'));
    await scanWith(scanned('barcode', baseDraft({ codigo_barras: '7791234567898' })));
    await confirmEdit();
    fireEvent.press(screen.getByTestId('existing-option-product-1'));
    expect(screen.queryByTestId('existing-cancel')).toBeNull();
    fireEvent.press(screen.getByTestId('existing-change'));
    expect(screen.getByTestId('existing-option-product-2')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSelectProduct).not.toHaveBeenCalled();
  });

  it('never asks for a stock to add: that is chosen back in the exit form', async () => {
    mockedProducts.getProductsByBarcode.mockResolvedValue([LECHE]);
    setupExit();
    fireEvent.press(screen.getByTestId('existing-method-barcode'));
    await scanWith(scanned('barcode', baseDraft({ codigo_barras: '7791234567898' })));
    await confirmEdit();
    fireEvent.press(screen.getByTestId('existing-option-product-1'));
    expect(screen.queryByTestId('existing-stock-input')).toBeNull();
  });
});

describe('ExistingProductModal - opened with a label already scanned (from "Escanear imágenes")', () => {
  const LABEL = { draft: baseDraft({ nombre: 'Yogur', marca: 'Ser', texto_leido: 'YOGUR SER' }), asset: { uri: 'file://label.jpg' } };

  it('starts on the name read, to validate it and search the product', async () => {
    mockedProducts.matchProducts.mockResolvedValue([LECHE]);
    render(<ExistingProductModal visible onClose={jest.fn()} onSuccess={jest.fn()} initialLabel={LABEL} />);
    expect(screen.getByTestId('existing-label-name-input').props.value).toBe('Yogur');
    expect(screen.queryByTestId('existing-method-name')).toBeNull();
    await confirmEdit();
    expect(mockedProducts.matchProducts).toHaveBeenCalledWith('Yogur Ser');
    expect(screen.getByText('Productos reconocidos')).toBeTruthy();
  });

  it('has a back button that returns to the label data, with the name as it was edited', () => {
    const onBackToLabel = jest.fn();
    render(<ExistingProductModal visible onClose={jest.fn()} onSuccess={jest.fn()} initialLabel={LABEL} onBackToLabel={onBackToLabel} />);
    fireEvent.changeText(screen.getByTestId('existing-label-name-input'), 'Yogur entero');
    fireEvent.press(screen.getByTestId('existing-back-to-label'));
    expect(onBackToLabel).toHaveBeenCalledWith({ draft: expect.objectContaining({ nombre: 'Yogur entero', texto_leido: 'YOGUR SER' }), asset: LABEL.asset });
  });

  it('has no back button when it was not opened from a label', async () => {
    render(<ExistingProductModal visible onClose={jest.fn()} onSuccess={jest.fn()} />);
    fireEvent.press(screen.getByTestId('existing-method-label'));
    await scanWith(scanned('product_label', baseDraft({ nombre: 'Leche' })));
    expect(screen.queryByTestId('existing-back-to-label')).toBeNull();
  });

  it('starts again from the menu when it is opened without a label afterwards', () => {
    const { rerender } = render(<ExistingProductModal visible onClose={jest.fn()} onSuccess={jest.fn()} initialLabel={LABEL} />);
    rerender(<ExistingProductModal visible={false} onClose={jest.fn()} onSuccess={jest.fn()} initialLabel={null} />);
    rerender(<ExistingProductModal visible onClose={jest.fn()} onSuccess={jest.fn()} initialLabel={null} />);
    expect(screen.getByText('Ingresar nombre')).toBeTruthy();
  });
});

describe('ExistingProductModal - details of the chosen product (by name)', () => {
  const openByName = () => {
    setup();
    fireEvent.press(screen.getByTestId('existing-method-name'));
  };

  const choose = async (product: any) => {
    jest.useFakeTimers();
    mockedProducts.suggestProducts.mockResolvedValue([product]);
    openByName();
    fireEvent.changeText(screen.getByTestId('existing-name-input'), 'Le');
    await act(async () => { jest.advanceTimersByTime(350); });
    fireEvent.press(screen.getByTestId(`existing-option-product-${product.id}`));
  };

  it('shows only the name of the product in the field, without the brand', async () => {
    await choose({ ...LECHE, marca: 'La Serenísima' });
    expect(screen.getByTestId('existing-name-input').props.value).toBe('Leche');
  });

  it('shows the category, brand, current stock and expiry date of the product in a card', async () => {
    await choose({ ...LECHE, marca: 'La Serenísima', categoria: 'Lacteos', stock: 4, vencimiento: '2027-03-05' });
    expect(screen.getByTestId('existing-selected-info')).toBeTruthy();
    expect(screen.getByTestId('existing-selected-categoria').props.children).toBe('Lacteos');
    expect(screen.getByTestId('existing-selected-marca').props.children).toBe('La Serenísima');
    expect(screen.getByTestId('existing-selected-stock').props.children).toBe('4');
    expect(screen.getByTestId('existing-selected-vencimiento').props.children).toBe('05/03/2027');
  });

  it('leaves out the brand when the product has none', async () => {
    await choose({ ...LECHE, marca: undefined });
    expect(screen.queryByTestId('existing-selected-marca')).toBeNull();
    expect(screen.getByTestId('existing-selected-categoria')).toBeTruthy();
  });

  it('leaves out the expiry date when the product does not expire', async () => {
    await choose({ ...LECHE, vencimiento: undefined });
    expect(screen.queryByTestId('existing-selected-vencimiento')).toBeNull();
    expect(screen.getByTestId('existing-selected-stock')).toBeTruthy();
  });

  it('puts the card right below the name field and above the stock to add', async () => {
    await choose({ ...LECHE, marca: 'Ser' });
    const tree = JSON.stringify(screen.toJSON());
    const at = (id: string) => tree.indexOf(`"${id}"`);
    expect(at('existing-name-input')).toBeLessThan(at('existing-selected-info'));
    expect(at('existing-selected-info')).toBeLessThan(at('existing-stock-input'));
  });

  it('still adds the stock to the chosen product', async () => {
    mockedProducts.restockProduct.mockResolvedValue({} as any);
    await choose({ ...LECHE, marca: 'Ser' });
    fireEvent.changeText(screen.getByTestId('existing-stock-input'), '3');
    await act(async () => { fireEvent.press(screen.getByTestId('existing-confirm')); });
    expect(mockedProducts.restockProduct).toHaveBeenCalledWith(LECHE.id, 3);
  });
});
