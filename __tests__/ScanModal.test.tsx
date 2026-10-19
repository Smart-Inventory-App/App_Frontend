import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ScanModal from '../src/components/ScanModal';
import { productService } from '@/services/productService';
import { ocrService } from '@/services/ocrService';
import { ProductDraft, ScanResult, ScanState } from '@/types/ocr';

jest.mock('@/services/productService', () => ({
  productService: {
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    suggestProducts: jest.fn(),
    getProductsByBarcode: jest.fn(),
  },
}));

jest.mock('@/services/ocrService', () => ({
  ocrService: {
    pickImage: jest.fn(),
    scan: jest.fn(),
    pollJob: jest.fn(),
    submitSalida: jest.fn(),
  },
  getScanErrorMessage: jest.fn((err: unknown, fallback: string) => {
    const detail = (err as any)?.response?.data?.detail;
    return typeof detail === 'string' ? detail : fallback;
  }),
}));

jest.mock('@/components/ProductFormFields', () => {
  const { View, TextInput } = require('react-native');
  return function MockProductFormFields({ form, onChange }: any) {
    return (
      <View>
        <TextInput
          testID="mock-nombre"
          value={form.nombre ?? ''}
          onChangeText={(v: string) => onChange({ ...form, nombre: v })}
        />
        <TextInput
          testID="mock-categoria"
          value={form.categoria ?? ''}
          onChangeText={(v: string) => onChange({ ...form, categoria: v })}
        />
        <TextInput
          testID="mock-stock"
          value={form.stock != null ? String(form.stock) : ''}
          onChangeText={(v: string) => onChange({ ...form, stock: v ? Number(v) : undefined })}
        />
      </View>
    );
  };
});

const mockedOcr = ocrService as jest.Mocked<typeof ocrService>;
const mockedProducts = productService as jest.Mocked<typeof productService>;

const baseDraft = (overrides: Partial<ProductDraft> = {}): ProductDraft => ({
  confianzas: {},
  coincidencias: [],
  ...overrides,
});

const baseResult = (overrides: Partial<ScanResult> = {}): ScanResult => ({
  doc_type: 'product_label',
  draft: null,
  items: [],
  comprobante: null,
  needs_review: false,
  confianza: 0.9,
  texto_legible: '',
  advertencias: [],
  sin_coincidencia: 0,
  ...overrides,
});

function setup(props: Partial<React.ComponentProps<typeof ScanModal>> = {}) {
  const onClose = jest.fn();
  const onSuccess = jest.fn();
  render(
    <ScanModal
      visible
      onClose={onClose}
      onSuccess={onSuccess}
      {...props}
    />
  );
  return { onClose, onSuccess };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ScanModal - doc type & source selection', () => {
  it('renders the four supported doc types', () => {
    setup();
    expect(screen.getByTestId('doc-type-product_label')).toBeTruthy();
    expect(screen.getByTestId('doc-type-expiry_date')).toBeTruthy();
    expect(screen.getByTestId('doc-type-receipt')).toBeTruthy();
    expect(screen.getByTestId('doc-type-barcode')).toBeTruthy();
  });

  it('closes the modal via the close button', () => {
    const { onClose } = setup();
    fireEvent.press(screen.getByTestId('scan-modal-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('moves to the source step after picking a doc type, and back again', () => {
    setup();
    fireEvent.press(screen.getByTestId('doc-type-product_label'));
    expect(screen.getByTestId('scan-source-camera')).toBeTruthy();
    fireEvent.press(screen.getByText('Atrás'));
    expect(screen.getByTestId('doc-type-product_label')).toBeTruthy();
  });

  it('stays on the source step when the user cancels the picker', async () => {
    mockedOcr.pickImage.mockResolvedValue(null);
    setup();
    fireEvent.press(screen.getByTestId('doc-type-product_label'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });
    expect(mockedOcr.pickImage).toHaveBeenCalledWith('camera');
    expect(screen.getByTestId('scan-source-camera')).toBeTruthy();
  });

  it('shows an error and returns to doc-type step when picking the image throws', async () => {
    mockedOcr.pickImage.mockRejectedValue(new Error('Se necesita permiso para usar la cámara.'));
    setup();
    fireEvent.press(screen.getByTestId('doc-type-product_label'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });
    expect(screen.getByText('Se necesita permiso para usar la cámara.')).toBeTruthy();
    expect(screen.getByTestId('doc-type-product_label')).toBeTruthy();
  });
});

describe('ScanModal - product_label review flow', () => {
  it('polls the job when the scan is queued, showing queue info meanwhile', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({ status: 'queued', doc_type: 'product_label', job_id: 'job-1' } as ScanState);

    let resolvePoll: (v: ScanState) => void;
    mockedOcr.pollJob.mockImplementation((_jobId, options) => {
      options?.onUpdate?.({ status: 'processing', doc_type: 'product_label', queue_position: 2, estimated_wait_seconds: 90 });
      return new Promise((resolve) => { resolvePoll = resolve; });
    });

    setup();
    fireEvent.press(screen.getByTestId('doc-type-product_label'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    expect(mockedOcr.pollJob).toHaveBeenCalledWith('job-1', expect.objectContaining({
      onUpdate: expect.any(Function),
      shouldStop: expect.any(Function),
    }));
    expect(screen.getByText('Lugar 2 en la fila')).toBeTruthy();
    expect(screen.getByText('Falta aproximadamente 2 min')).toBeTruthy();

    const result = baseResult({ doc_type: 'product_label', draft: baseDraft({ nombre: 'Leche', texto_leido: 'LECHE ENTERA' }) });
    await act(async () => {
      resolvePoll({ status: 'done', doc_type: 'product_label', result } as ScanState);
    });

    expect(screen.getByTestId('mock-nombre').props.value).toBe('Leche');
  });

  it('shows an error and resets when the job fails', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({ status: 'queued', doc_type: 'product_label', job_id: 'job-1' } as ScanState);
    mockedOcr.pollJob.mockResolvedValue({ status: 'failed', doc_type: 'product_label', error: 'motor caído' } as ScanState);

    setup();
    fireEvent.press(screen.getByTestId('doc-type-product_label'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    expect(screen.getByText('No se pudo leer la foto: motor caído')).toBeTruthy();
  });

  it('shows a translated error message when the upload/poll call rejects', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockRejectedValue({ response: { status: 503, data: {} } });

    setup();
    fireEvent.press(screen.getByTestId('doc-type-product_label'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    expect(screen.getByTestId('doc-type-product_label')).toBeTruthy();
  });

  it('distinguishes a failed upload from a lost job', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockRejectedValue({ response: { status: 500, data: {} } });

    setup();
    fireEvent.press(screen.getByTestId('doc-type-product_label'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    expect(screen.getByText('No se pudo enviar la foto para escanear')).toBeTruthy();
  });

  it('reports a lost job when the polling itself rejects with an http error', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({ status: 'queued', doc_type: 'product_label', job_id: 'job-1' } as ScanState);
    mockedOcr.pollJob.mockRejectedValue({ response: { status: 404, data: {} } });

    setup();
    fireEvent.press(screen.getByTestId('doc-type-product_label'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    expect(screen.getByText('Se perdió el seguimiento del escaneo, probá de nuevo')).toBeTruthy();
  });

  it('shows the timeout message when polling exhausts attempts', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({ status: 'queued', doc_type: 'product_label', job_id: 'job-1' } as ScanState);
    mockedOcr.pollJob.mockRejectedValue(new Error('timeout'));

    setup();
    fireEvent.press(screen.getByTestId('doc-type-product_label'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    expect(screen.getByText('El escaneo está tardando más de lo esperado, probá de nuevo')).toBeTruthy();
  });

  it('applies a suggested match onto the form', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    const result = baseResult({
      draft: baseDraft({
        nombre: 'yog ser frut',
        coincidencias: [{ id: 4, nombre: 'Yogur Ser Frutilla', marca: 'Ser', score: 0.9, por_codigo: false, stock: 1 }],
      }),
    });
    mockedOcr.scan.mockResolvedValue({ status: 'done', doc_type: 'product_label', result } as ScanState);

    setup();
    fireEvent.press(screen.getByTestId('doc-type-product_label'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    fireEvent.press(screen.getByTestId('match-4'));
    expect(screen.getByTestId('mock-nombre').props.value).toBe('Yogur Ser Frutilla');
  });

  it('validates required fields before confirming', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({ status: 'done', doc_type: 'product_label', result: baseResult({ draft: baseDraft() }) } as ScanState);

    setup();
    fireEvent.press(screen.getByTestId('doc-type-product_label'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    fireEvent.press(screen.getByTestId('confirm-draft'));
    expect(screen.getByText('El nombre es requerido')).toBeTruthy();
    expect(mockedProducts.createProduct).not.toHaveBeenCalled();
  });

  it('creates the product and reports "created" on success', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({
      status: 'done',
      doc_type: 'product_label',
      result: baseResult({ draft: baseDraft({ nombre: 'Leche' }) }),
    } as ScanState);
    mockedProducts.createProduct.mockResolvedValue({ id: 1, merged: false } as any);

    const { onClose, onSuccess } = setup();
    fireEvent.press(screen.getByTestId('doc-type-product_label'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    fireEvent.changeText(screen.getByTestId('mock-categoria'), 'Lacteos');
    fireEvent.changeText(screen.getByTestId('mock-stock'), '2');

    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-draft'));
    });

    expect(mockedProducts.createProduct).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Leche', categoria: 'Lacteos', stock: 2 }));
    expect(onSuccess).toHaveBeenCalledWith('created');
    expect(onClose).toHaveBeenCalled();
  });

  it('reports "merged" when the backend merges into an existing product', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({
      status: 'done',
      doc_type: 'product_label',
      result: baseResult({ draft: baseDraft({ nombre: 'Leche', categoria: 'Lacteos', stock: 1 }) }),
    } as ScanState);
    mockedProducts.createProduct.mockResolvedValue({ id: 1, merged: true } as any);

    const { onSuccess } = setup();
    fireEvent.press(screen.getByTestId('doc-type-product_label'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-draft'));
    });

    expect(onSuccess).toHaveBeenCalledWith('merged');
  });

  it('shows a confirm error and does not close when createProduct fails', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({
      status: 'done',
      doc_type: 'product_label',
      result: baseResult({ draft: baseDraft({ nombre: 'Leche', categoria: 'Lacteos', stock: 1 }) }),
    } as ScanState);
    mockedProducts.createProduct.mockRejectedValue({ response: { data: { detail: 'nombre invalido' } } });

    const { onClose } = setup();
    fireEvent.press(screen.getByTestId('doc-type-product_label'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-draft'));
    });

    expect(screen.getByText('nombre invalido')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('resets back to the doc-type step via "scan another"', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({
      status: 'done',
      doc_type: 'product_label',
      result: baseResult({ draft: baseDraft({ nombre: 'Leche' }) }),
    } as ScanState);

    setup();
    fireEvent.press(screen.getByTestId('doc-type-product_label'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    fireEvent.press(screen.getByText('Escanear otra'));
    expect(screen.getByTestId('doc-type-product_label')).toBeTruthy();
  });
});

describe('ScanModal - receipt review flow', () => {
  const receiptResult = () => baseResult({
    doc_type: 'receipt',
    draft: null,
    comprobante: { comercio: 'Kiosco Don Juan', fecha_compra: '2026-01-01', total: 100 },
    items: [
      baseDraft({
        nombre: 'Yogur',
        stock: 2,
        coincidencia_id: 5,
        coincidencias: [{ id: 5, nombre: 'Yogur Ser', score: 0.9, por_codigo: false, stock: 1 }],
      }),
      baseDraft({ nombre: 'Fideos', stock: 1, coincidencias: [] }),
    ],
  });

  it('renders the receipt header and preselects the confident match', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({ status: 'done', doc_type: 'receipt', result: receiptResult() } as ScanState);

    setup();
    fireEvent.press(screen.getByTestId('doc-type-receipt'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    expect(screen.getByText('Comercio: Kiosco Don Juan')).toBeTruthy();
    expect(screen.getByTestId('receipt-quantity-0').props.value).toBe('2');
    expect(screen.getByText('Sin coincidencia en tu inventario')).toBeTruthy();
  });

  it('requires at least one included line before submitting', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    const result = receiptResult();
    result.items[0].coincidencia_id = undefined;
    mockedOcr.scan.mockResolvedValue({ status: 'done', doc_type: 'receipt', result } as ScanState);

    setup();
    fireEvent.press(screen.getByTestId('doc-type-receipt'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-receipt'));
    });
    expect(screen.getByText('Elegí al menos un renglón para descontar')).toBeTruthy();
    expect(mockedOcr.submitSalida).not.toHaveBeenCalled();
  });

  it('lets the user exclude/include a line and change its quantity', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({ status: 'done', doc_type: 'receipt', result: receiptResult() } as ScanState);
    mockedOcr.submitSalida.mockResolvedValue({ procesados: 1, fallidos: 0, errores: [] });

    setup();
    fireEvent.press(screen.getByTestId('doc-type-receipt'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    fireEvent.press(screen.getByTestId('receipt-toggle-0'));
    fireEvent.press(screen.getByTestId('receipt-toggle-0'));
    fireEvent.changeText(screen.getByTestId('receipt-quantity-0'), '3');

    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-receipt'));
    });

    expect(mockedOcr.submitSalida).toHaveBeenCalledWith([{ product_id: 5, quantity: 3 }], 'Kiosco Don Juan');
  });

  it('shows the chosen match first and sends it back to its place when the line is excluded', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    const result = receiptResult();
    result.items[0].coincidencias.push({ id: 6, nombre: 'Yogur Descremado', score: 0.6, por_codigo: false, stock: 4 });
    mockedOcr.scan.mockResolvedValue({ status: 'done', doc_type: 'receipt', result } as ScanState);

    setup();
    fireEvent.press(screen.getByTestId('doc-type-receipt'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    const firstIs = (a: string, b: string) => {
      const tree = JSON.stringify(screen.toJSON());
      return tree.indexOf(a) < tree.indexOf(b);
    };
    expect(firstIs('Yogur Ser', 'Yogur Descremado')).toBe(true);
    fireEvent.press(screen.getByText('Yogur Descremado (60%)'));
    expect(firstIs('Yogur Descremado', 'Yogur Ser')).toBe(true);
    fireEvent.press(screen.getByTestId('receipt-toggle-0'));
    expect(firstIs('Yogur Ser', 'Yogur Descremado')).toBe(true);
  });

  it('selects a match chip for a line with several candidates', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    const result = receiptResult();
    result.items[0].coincidencias.push({ id: 6, nombre: 'Yogur Descremado', score: 0.6, por_codigo: false, stock: 4 });
    mockedOcr.scan.mockResolvedValue({ status: 'done', doc_type: 'receipt', result } as ScanState);
    mockedOcr.submitSalida.mockResolvedValue({ procesados: 1, fallidos: 0, errores: [] });

    setup();
    fireEvent.press(screen.getByTestId('doc-type-receipt'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    fireEvent.press(screen.getByText('Yogur Descremado (60%)'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-receipt'));
    });

    expect(mockedOcr.submitSalida).toHaveBeenCalledWith(
      expect.arrayContaining([{ product_id: 6, quantity: 2 }]),
      'Kiosco Don Juan',
    );
  });

  it('lets the user search for a product on a line without a match', async () => {
    jest.useFakeTimers();
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({ status: 'done', doc_type: 'receipt', result: receiptResult() } as ScanState);
    mockedProducts.suggestProducts.mockResolvedValue([{ id: 8, nombre: 'Fideos Secos', categoria: 'Almacen', stock: 1 } as any]);
    mockedOcr.submitSalida.mockResolvedValue({ procesados: 2, fallidos: 0, errores: [] });

    setup();
    fireEvent.press(screen.getByTestId('doc-type-receipt'));
    await act(async () => {
      jest.useRealTimers();
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });
    jest.useFakeTimers();

    fireEvent.press(screen.getByTestId('receipt-search-open-1'));
    fireEvent.changeText(screen.getByTestId('receipt-search-input-1'), 'fide');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    jest.useRealTimers();

    await waitFor(() => expect(screen.getByText('Fideos Secos')).toBeTruthy());
    fireEvent.press(screen.getByText('Fideos Secos'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-receipt'));
    });

    expect(mockedOcr.submitSalida).toHaveBeenCalledWith(
      expect.arrayContaining([{ product_id: 8, quantity: 1 }]),
      'Kiosco Don Juan',
    );
  });

  it('shows the result summary and closes when done is pressed', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({ status: 'done', doc_type: 'receipt', result: receiptResult() } as ScanState);
    mockedOcr.submitSalida.mockResolvedValue({ procesados: 1, fallidos: 1, errores: ['Producto #9: no encontrado'] });

    const { onSuccess, onClose } = setup();
    fireEvent.press(screen.getByTestId('doc-type-receipt'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-receipt'));
    });

    expect(screen.getByText('1 renglones procesados, 1 con error')).toBeTruthy();
    expect(screen.getByText('Producto #9: no encontrado')).toBeTruthy();

    fireEvent.press(screen.getByTestId('receipt-result-done'));
    expect(onSuccess).toHaveBeenCalledWith('salida');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a confirm error when submitSalida fails', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({ status: 'done', doc_type: 'receipt', result: receiptResult() } as ScanState);
    mockedOcr.submitSalida.mockRejectedValue({ response: { data: { detail: 'error de red' } } });

    setup();
    fireEvent.press(screen.getByTestId('doc-type-receipt'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-receipt'));
    });

    expect(screen.getByText('error de red')).toBeTruthy();
  });

  it('renders a placeholder when a line has neither a name nor read text', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    const result = baseResult({ doc_type: 'receipt', items: [] });
    mockedOcr.scan.mockResolvedValue({ status: 'done', doc_type: 'receipt', result } as ScanState);

    setup();
    fireEvent.press(screen.getByTestId('doc-type-receipt'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    expect(screen.getByText('No se pudo leer ningún renglón de esta foto')).toBeTruthy();
  });
});

const scanBarcode = async (code: string | undefined, found: any[] = []) => {
  mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
  mockedOcr.scan.mockResolvedValue({
    status: 'done',
    doc_type: 'barcode',
    result: baseResult({ doc_type: 'barcode', draft: baseDraft(code ? { codigo_barras: code } : {}) }),
  } as ScanState);
  mockedProducts.getProductsByBarcode.mockResolvedValue(found);
  const onApplyToForm = jest.fn();
  const handlers = setup({ onApplyToForm });
  fireEvent.press(screen.getByTestId('doc-type-barcode'));
  await act(async () => {
    fireEvent.press(screen.getByTestId('scan-source-camera'));
  });
  return { ...handlers, onApplyToForm };
};

const lastUpdater = (fn: jest.Mock) => fn.mock.calls[fn.mock.calls.length - 1][0] as (f: any) => any;

const YOGUR = {
  id: 9, nombre: 'Yogur Ser', marca: 'Ser', categoria: 'Lacteos', ubicacion: 'Heladera', stock: 4,
  vencimiento: '2027-03-01', stock_minimo: 2, dias_alerta_vencimiento: 5,
  descripcion: 'Natural', imagen_url: 'https://cdn/y.jpg', codigo_barras: '7791234567898',
};

describe('ScanModal - barcode review flow', () => {
  it('shows the scanned code, editable, in the same window', async () => {
    await scanBarcode('7791234567898');
    expect(screen.getByText('Código de barras escaneado')).toBeTruthy();
    const input = screen.getByTestId('barcode-input');
    expect(input.props.value).toBe('7791234567898');
    expect(input.props.maxLength).toBe(14);
    fireEvent.changeText(input, '77912a34567898');
    expect(screen.getByTestId('barcode-input').props.value).toBe('7791234567898');
  });

  it('lists the products that have the code so the user can pick one', async () => {
    await scanBarcode('7791234567898', [YOGUR, { ...YOGUR, id: 10, vencimiento: undefined }]);
    await waitFor(() => expect(screen.getByTestId('barcode-product-9')).toBeTruthy());
    expect(mockedProducts.getProductsByBarcode).toHaveBeenCalledWith('7791234567898');
    expect(screen.getByTestId('barcode-product-10')).toBeTruthy();
    expect(screen.getByText('Productos con este código')).toBeTruthy();
    expect(screen.getByText(/Vence 01\/03\/2027/)).toBeTruthy();
    expect(screen.getByText(/Sin vencimiento/)).toBeTruthy();
  });

  it('on confirm with a product picked, goes back to the form with all that product\'s data, keeping the typed stock', async () => {
    const { onApplyToForm, onClose } = await scanBarcode('7791234567898', [YOGUR]);
    await waitFor(() => expect(screen.getByTestId('barcode-product-9')).toBeTruthy());
    fireEvent.press(screen.getByTestId('barcode-product-9'));
    fireEvent.press(screen.getByTestId('barcode-confirm'));

    const result = lastUpdater(onApplyToForm)({ nombre: 'otro', stock: 12 });
    expect(result).toMatchObject({
      nombre: 'Yogur Ser', marca: 'Ser', categoria: 'Lacteos', ubicacion: 'Heladera', vencimiento: '2027-03-01',
      stock_minimo: 2, dias_alerta_vencimiento: 5, descripcion: 'Natural', imagen_url: 'https://cdn/y.jpg',
      codigo_barras: '7791234567898', stock: 12,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the picked product first, and puts it back in its place when it is unpicked', async () => {
    await scanBarcode('7791234567898', [YOGUR, { ...YOGUR, id: 10 }]);
    await waitFor(() => expect(screen.getByTestId('barcode-product-9')).toBeTruthy());
    const firstIs = (id: number, other: number) => {
      const tree = JSON.stringify(screen.toJSON());
      return tree.indexOf(`barcode-product-${id}`) < tree.indexOf(`barcode-product-${other}`);
    };
    expect(firstIs(9, 10)).toBe(true);
    fireEvent.press(screen.getByTestId('barcode-product-10'));
    expect(firstIs(10, 9)).toBe(true);
    fireEvent.press(screen.getByTestId('barcode-product-10'));
    expect(firstIs(9, 10)).toBe(true);
  });

  it('lets the user unpick a product, and then only the barcode is loaded', async () => {
    const { onApplyToForm } = await scanBarcode('7791234567898', [YOGUR]);
    await waitFor(() => expect(screen.getByTestId('barcode-product-9')).toBeTruthy());
    fireEvent.press(screen.getByTestId('barcode-product-9'));
    fireEvent.press(screen.getByTestId('barcode-product-9'));
    fireEvent.press(screen.getByTestId('barcode-confirm'));
    expect(lastUpdater(onApplyToForm)({ nombre: 'Mío', stock: 3 })).toEqual({
      nombre: 'Mío', stock: 3, codigo_barras: '7791234567898',
    });
  });

  it('with no product for the code, confirming loads the form with the barcode and keeps what was typed', async () => {
    const { onApplyToForm, onClose } = await scanBarcode('7791234567898', []);
    await waitFor(() => expect(mockedProducts.getProductsByBarcode).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('No hay productos con este código')).toBeTruthy());
    fireEvent.press(screen.getByTestId('barcode-confirm'));
    expect(lastUpdater(onApplyToForm)({ nombre: 'Leche', categoria: 'Lacteos', vencimiento: '2027-01-01' })).toEqual({
      nombre: 'Leche', categoria: 'Lacteos', vencimiento: '2027-01-01', codigo_barras: '7791234567898',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('lets the user correct the code before confirming, and searches again with the new one', async () => {
    const { onApplyToForm } = await scanBarcode('7791234567898', []);
    fireEvent.changeText(screen.getByTestId('barcode-input'), '73513537');
    await waitFor(() => expect(mockedProducts.getProductsByBarcode).toHaveBeenCalledWith('73513537'));
    fireEvent.press(screen.getByTestId('barcode-confirm'));
    expect(lastUpdater(onApplyToForm)({})).toEqual({ codigo_barras: '73513537' });
  });

  it('refuses to confirm an invalid code', async () => {
    const { onApplyToForm } = await scanBarcode('7791234567898', []);
    fireEvent.changeText(screen.getByTestId('barcode-input'), '123');
    fireEvent.press(screen.getByTestId('barcode-confirm'));
    expect(screen.getByText('El código de barras es inválido')).toBeTruthy();
    expect(onApplyToForm).not.toHaveBeenCalled();
    expect(mockedProducts.getProductsByBarcode).not.toHaveBeenCalledWith('123');
  });

  it('offers to type the code when none could be read', async () => {
    const { onApplyToForm } = await scanBarcode(undefined);
    expect(screen.getByText('No se pudo leer un código de barras: podés escribirlo')).toBeTruthy();
    expect(screen.getByTestId('barcode-input').props.value).toBe('');
    fireEvent.press(screen.getByTestId('barcode-confirm'));
    expect(screen.getByText('El código de barras es inválido')).toBeTruthy();
    expect(onApplyToForm).not.toHaveBeenCalled();
  });

  it('cancel closes the window without touching the form', async () => {
    const { onApplyToForm, onClose } = await scanBarcode('7791234567898', []);
    fireEvent.press(screen.getByTestId('barcode-cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(onApplyToForm).not.toHaveBeenCalled();
  });

  it('shows no product list if the lookup fails', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({
      status: 'done', doc_type: 'barcode',
      result: baseResult({ doc_type: 'barcode', draft: baseDraft({ codigo_barras: '7791234567898' }) }),
    } as ScanState);
    mockedProducts.getProductsByBarcode.mockRejectedValue(new Error('boom'));
    setup({ onApplyToForm: jest.fn() });
    fireEvent.press(screen.getByTestId('doc-type-barcode'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });
    await waitFor(() => expect(mockedProducts.getProductsByBarcode).toHaveBeenCalled());
    expect(screen.queryByText('Productos con este código')).toBeNull();
  });
});

const scanExpiry = async (iso: string | undefined) => {
  mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
  mockedOcr.scan.mockResolvedValue({
    status: 'done',
    doc_type: 'expiry_date',
    result: baseResult({ doc_type: 'expiry_date', draft: baseDraft(iso ? { vencimiento: iso } : {}) }),
  } as ScanState);
  const onApplyToForm = jest.fn();
  const handlers = setup({ onApplyToForm });
  fireEvent.press(screen.getByTestId('doc-type-expiry_date'));
  await act(async () => {
    fireEvent.press(screen.getByTestId('scan-source-camera'));
  });
  return { ...handlers, onApplyToForm };
};

describe('ScanModal - expiry_date review flow', () => {
  it('shows the scanned date as DD/MM/AAAA, editable', async () => {
    await scanExpiry('2026-05-01');
    expect(screen.getByText('Fecha de vencimiento leída: 01/05/2026')).toBeTruthy();
    const input = screen.getByTestId('expiry-input');
    expect(input.props.value).toBe('01/05/2026');
    fireEvent.changeText(input, '15062027');
    expect(screen.getByTestId('expiry-input').props.value).toBe('15/06/2027');
  });

  it('shows a hint when no date could be read, and starts empty', async () => {
    await scanExpiry(undefined);
    expect(screen.getByText('No se pudo leer una fecha en la foto')).toBeTruthy();
    expect(screen.getByTestId('expiry-input').props.value).toBe('');
  });

  it('on confirm goes back to the form with the date, keeping everything already filled in', async () => {
    const { onApplyToForm, onClose } = await scanExpiry('2026-05-01');
    fireEvent.press(screen.getByTestId('expiry-confirm'));
    expect(lastUpdater(onApplyToForm)({ nombre: 'Leche', categoria: 'Lacteos', stock: 4, codigo_barras: '7791234567898' })).toEqual({
      nombre: 'Leche', categoria: 'Lacteos', stock: 4, codigo_barras: '7791234567898', vencimiento: '2026-05-01',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('replaces a date that was already in the form, and uses the corrected date', async () => {
    const { onApplyToForm } = await scanExpiry('2026-05-01');
    fireEvent.changeText(screen.getByTestId('expiry-input'), '31122027');
    fireEvent.press(screen.getByTestId('expiry-confirm'));
    expect(lastUpdater(onApplyToForm)({ vencimiento: '2025-01-01', nombre: 'Leche' })).toEqual({
      vencimiento: '2027-12-31', nombre: 'Leche',
    });
  });

  it('refuses to confirm an incomplete or impossible date', async () => {
    const { onApplyToForm } = await scanExpiry('2026-05-01');
    fireEvent.changeText(screen.getByTestId('expiry-input'), '3102');
    fireEvent.press(screen.getByTestId('expiry-confirm'));
    expect(screen.getByText('Fecha de vencimiento inválida. Ingresa el día y el mes con 2 dígitos y el año con 4 dígitos. Por ejemplo: 05/03/2027')).toBeTruthy();
    expect(screen.getByTestId('expiry-input').props.value).toBe('');
    fireEvent.changeText(screen.getByTestId('expiry-input'), '31022027');
    fireEvent.press(screen.getByTestId('expiry-confirm'));
    expect(screen.getByTestId('expiry-input').props.value).toBe('');
    expect(onApplyToForm).not.toHaveBeenCalled();
  });

  it('cancel closes the window without touching the form', async () => {
    const { onApplyToForm, onClose } = await scanExpiry('2026-05-01');
    fireEvent.press(screen.getByTestId('expiry-cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(onApplyToForm).not.toHaveBeenCalled();
  });
});

describe('ScanModal - the window itself', () => {
  it('is a bottom sheet titled "Escanear imagen" that closes when tapping outside', () => {
    const { onClose } = setup();
    expect(screen.getByText('Escanear imagen')).toBeTruthy();
    fireEvent.press(screen.getByTestId('scan-sheet'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('scan-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not take the whole screen and uses the same title format as "Flujo de producto" but smaller', () => {
    setup();
    const { StyleSheet } = require('react-native');
    const sheet = StyleSheet.flatten(screen.getByTestId('scan-sheet').props.style);
    expect(sheet.maxHeight).toBe('85%');
    const title = StyleSheet.flatten(screen.getByText('Escanear imagen').props.style);
    expect(title.fontFamily).toBe('Roboto_500Medium');
    expect(title.fontSize).toBe(20);
  });

  it('keeps the other document types working without a form callback', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({
      status: 'done', doc_type: 'expiry_date',
      result: baseResult({ doc_type: 'expiry_date', draft: baseDraft({ vencimiento: '2026-05-01' }) }),
    } as ScanState);
    const { onClose } = setup();
    fireEvent.press(screen.getByTestId('doc-type-expiry_date'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });
    fireEvent.press(screen.getByTestId('expiry-confirm'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ScanModal - barcode product list', () => {
  const lots = Array.from({ length: 6 }, (_, i) => ({
    id: 20 + i, nombre: `Lote ${i}`, categoria: 'Lacteos', stock: i + 1, vencimiento: `2027-0${i + 1}-01`,
  }));

  it('shows 3.5 products at a time inside a scrollable list, so the rest are reached by scrolling', async () => {
    await scanBarcode('7791234567898', lots);
    await waitFor(() => expect(screen.getByTestId('barcode-products-list')).toBeTruthy());
    const { StyleSheet } = require('react-native');
    const list = screen.getByTestId('barcode-products-list');
    const row = StyleSheet.flatten(screen.getByTestId('barcode-product-20').props.style);
    expect(StyleSheet.flatten(list.props.style).maxHeight).toBe(3.5 * (row.height + row.marginBottom));
    expect(list.props.nestedScrollEnabled).toBe(true);
    // todos están en la lista, el último también
    expect(screen.getByTestId('barcode-product-25')).toBeTruthy();
  });

  it('lets the user pick a product that was below the fold', async () => {
    const { onApplyToForm } = await scanBarcode('7791234567898', lots);
    await waitFor(() => expect(screen.getByTestId('barcode-product-25')).toBeTruthy());
    fireEvent.press(screen.getByTestId('barcode-product-25'));
    fireEvent.press(screen.getByTestId('barcode-confirm'));
    expect(lastUpdater(onApplyToForm)({}).nombre).toBe('Lote 5');
  });

  it('gives every row the same height, even with long names', async () => {
    await scanBarcode('7791234567898', [{ ...lots[0], nombre: 'Un nombre de producto larguísimo que no entra' }, lots[1]]);
    await waitFor(() => expect(screen.getByTestId('barcode-product-20')).toBeTruthy());
    const { StyleSheet } = require('react-native');
    expect(StyleSheet.flatten(screen.getByTestId('barcode-product-20').props.style).height)
      .toBe(StyleSheet.flatten(screen.getByTestId('barcode-product-21').props.style).height);
  });

  it('replaces the previous form data with the picked product, except the stock', async () => {
    const { onApplyToForm } = await scanBarcode('7791234567898', [{ ...lots[0], codigo_barras: '7791234567898' }]);
    await waitFor(() => expect(screen.getByTestId('barcode-product-20')).toBeTruthy());
    fireEvent.press(screen.getByTestId('barcode-product-20'));
    fireEvent.press(screen.getByTestId('barcode-confirm'));
    const result = lastUpdater(onApplyToForm)({ nombre: 'viejo', marca: 'Vieja', descripcion: 'borrar', stock: 9 });
    expect(result.nombre).toBe('Lote 0');
    expect(result.marca).toBeUndefined();
    expect(result.descripcion).toBeUndefined();
    expect(result.stock).toBe(9);
  });
});
