import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExistingProductModal from '../src/components/ExistingProductModal';
import { productService } from '@/services/productService';
import { ocrService } from '@/services/ocrService';
import { ProductDraft, ScanResult, ScanState } from '@/types/ocr';

jest.mock('@/services/productService', () => ({
  productService: {
    suggestProducts: jest.fn(),
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

  it('after choosing a product, hides the others and asks for the stock; "Cambiar" brings the options back', async () => {
    mockedProducts.getProductsByBarcode.mockResolvedValue([LECHE, LECHE_2]);
    const { onSuccess } = openByBarcode();
    await scanWith(scanned('barcode', baseDraft({ codigo_barras: '7791234567898' })));
    await confirmEdit();
    fireEvent.press(screen.getByTestId('existing-option-product-2'));
    expect(screen.queryByTestId('existing-option-product-1')).toBeNull();
    expect(screen.getByText('Stock actual: 7')).toBeTruthy();
    fireEvent.press(screen.getByTestId('existing-change'));
    expect(screen.getByTestId('existing-option-product-1')).toBeTruthy();
    expect(screen.queryByTestId('existing-stock-input')).toBeNull();

    fireEvent.press(screen.getByTestId('existing-option-product-1'));
    fireEvent.changeText(screen.getByTestId('existing-stock-input'), '5');
    await act(async () => { fireEvent.press(screen.getByTestId('existing-confirm')); });
    expect(mockedProducts.restockProduct).toHaveBeenCalledWith(1, 5);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('explains there is no product with that code, and lets the user edit it again', async () => {
    mockedProducts.getProductsByBarcode.mockResolvedValue([]);
    openByBarcode();
    await scanWith(scanned('barcode', baseDraft({ codigo_barras: '7791234567898' })));
    await confirmEdit();
    expect(screen.getByText('No existe un producto con el código de barras ingresado en el inventario. Corregí el código y volvé a confirmar.')).toBeTruthy();
    expect(screen.getByTestId('existing-barcode-input')).toBeTruthy();
    mockedProducts.getProductsByBarcode.mockResolvedValue([LECHE]);
    fireEvent.changeText(screen.getByTestId('existing-barcode-input'), '7790000000003');
    expect(screen.queryByText(/No existe un producto con el código de barras/)).toBeNull();
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

  it('once the name is confirmed, lists similar products and then asks for the stock of the chosen one', async () => {
    mockedProducts.suggestProducts.mockResolvedValue([LECHE, LECHE_2]);
    const { onSuccess } = openByLabel();
    await scanWith(scanned('product_label', labelDraft()));
    fireEvent.changeText(screen.getByTestId('existing-label-name-input'), 'Leche');
    await confirmEdit();
    expect(mockedProducts.suggestProducts).toHaveBeenCalledWith('Leche');
    expect(screen.getByTestId('existing-option-product-1')).toBeTruthy();
    fireEvent.press(screen.getByTestId('existing-option-product-1'));
    expect(screen.queryByTestId('existing-option-product-2')).toBeNull();
    fireEvent.changeText(screen.getByTestId('existing-stock-input'), '2');
    await act(async () => { fireEvent.press(screen.getByTestId('existing-confirm')); });
    expect(mockedProducts.restockProduct).toHaveBeenCalledWith(1, 2);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('uses the matches found by the scan when the name was kept as read and the search finds nothing', async () => {
    mockedProducts.suggestProducts.mockResolvedValue([]);
    openByLabel();
    await scanWith(scanned('product_label', labelDraft()));
    await confirmEdit();
    expect(screen.getByTestId('existing-option-product-2')).toBeTruthy();
  });

  it('explains there are no similar products, and lets the name be edited again', async () => {
    mockedProducts.suggestProducts.mockResolvedValue([]);
    openByLabel();
    await scanWith(scanned('product_label', baseDraft({ nombre: 'Algo raro' })));
    await confirmEdit();
    expect(screen.getByText('No existe ningún producto con un nombre parecido a "Algo raro" en el inventario. Corregí el nombre y volvé a confirmar.')).toBeTruthy();
    mockedProducts.suggestProducts.mockResolvedValue([LECHE]);
    fireEvent.changeText(screen.getByTestId('existing-label-name-input'), 'Leche');
    expect(screen.queryByText(/No existe ningún producto con un nombre parecido/)).toBeNull();
    await confirmEdit();
    expect(screen.getByTestId('existing-option-product-1')).toBeTruthy();
  });

  it('asks for the name when it is empty, without searching', async () => {
    openByLabel();
    await scanWith(scanned('product_label', baseDraft({})));
    await confirmEdit();
    expect(screen.getByTestId('existing-error').props.children).toBe('Escribí el nombre del producto');
    expect(mockedProducts.suggestProducts).not.toHaveBeenCalled();
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
    mockedProducts.suggestProducts.mockResolvedValue([LECHE]);
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

  it('is titled "Escanear imágenes" and offers barcode, label and invoice or receipt, in that order', () => {
    setupExit();
    expect(screen.getByText('Escanear imágenes')).toBeTruthy();
    expect(screen.getByText('¿Qué estás por escanear?')).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    const order = ['Código de barras', 'Etiqueta de producto', 'Factura o remito'].map(label => tree.indexOf(label));
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

  it('by barcode: reads, lets the user fix the code, and returns the chosen product to the exit form', async () => {
    mockedProducts.getProductsByBarcode.mockResolvedValue([LECHE, LECHE_2]);
    const { onSelectProduct, onClose } = setupExit();
    fireEvent.press(screen.getByTestId('existing-method-barcode'));
    await scanWith(scanned('barcode', baseDraft({ codigo_barras: '7791234567898' })));
    expect(screen.getByTestId('existing-barcode-input').props.value).toBe('7791234567898');
    await confirmEdit();
    expect(screen.getByTestId('existing-option-product-2')).toBeTruthy();
    fireEvent.press(screen.getByTestId('existing-option-product-2'));
    expect(onSelectProduct).toHaveBeenCalledWith(LECHE_2);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockedProducts.restockProduct).not.toHaveBeenCalled();
  });

  it('by barcode: explains there is no product with that code and lets the user edit it again', async () => {
    mockedProducts.getProductsByBarcode.mockResolvedValue([]);
    const { onSelectProduct } = setupExit();
    fireEvent.press(screen.getByTestId('existing-method-barcode'));
    await scanWith(scanned('barcode', baseDraft({ codigo_barras: '7791234567898' })));
    await confirmEdit();
    expect(screen.getByText('No existe un producto con el código de barras ingresado en el inventario. Corregí el código y volvé a confirmar.')).toBeTruthy();
    expect(screen.getByTestId('existing-barcode-input')).toBeTruthy();
    expect(onSelectProduct).not.toHaveBeenCalled();
  });

  it('by label: shows what was read, lets the name be fixed and returns the chosen product to the exit form', async () => {
    mockedProducts.suggestProducts.mockResolvedValue([LECHE, LECHE_2]);
    const { onSelectProduct, onClose } = setupExit();
    fireEvent.press(screen.getByTestId('existing-method-label'));
    await scanWith(scanned('product_label', baseDraft({ nombre: 'Leche entera', marca: 'Ser' })));
    expect(screen.getByText('Información leída de la etiqueta')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('existing-label-name-input'), 'Leche');
    await confirmEdit();
    expect(mockedProducts.suggestProducts).toHaveBeenCalledWith('Leche');
    fireEvent.press(screen.getByTestId('existing-option-product-1'));
    expect(onSelectProduct).toHaveBeenCalledWith(LECHE);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('by label: explains there are no similar products and lets the name be edited again', async () => {
    mockedProducts.suggestProducts.mockResolvedValue([]);
    setupExit();
    fireEvent.press(screen.getByTestId('existing-method-label'));
    await scanWith(scanned('product_label', baseDraft({ nombre: 'Algo raro' })));
    await confirmEdit();
    expect(screen.getByText('No existe ningún producto con un nombre parecido a "Algo raro" en el inventario. Corregí el nombre y volvé a confirmar.')).toBeTruthy();
    expect(screen.getByTestId('existing-label-name-input')).toBeTruthy();
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
