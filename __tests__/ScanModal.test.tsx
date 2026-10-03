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

describe('ScanModal - product_label / barcode review flow', () => {
  it('goes straight to review when the scan resolves done synchronously (barcode)', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    const result = baseResult({
      doc_type: 'barcode',
      draft: baseDraft({
        codigo_barras: '7791234567890',
        texto_leido: '7791234567890',
        coincidencias: [{ id: 9, nombre: 'Yogur Ser', score: 1, por_codigo: true, stock: 2 }],
      }),
    });
    mockedOcr.scan.mockResolvedValue({ status: 'done', doc_type: 'barcode', result } as ScanState);

    setup();
    fireEvent.press(screen.getByTestId('doc-type-barcode'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    expect(mockedOcr.pollJob).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-draft')).toBeTruthy();
    expect(screen.getByTestId('match-9')).toBeTruthy();
  });

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

describe('ScanModal - expiry_date review flow', () => {
  it('requires a selected product before confirming', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({
      status: 'done',
      doc_type: 'expiry_date',
      result: baseResult({ doc_type: 'expiry_date', draft: baseDraft({ vencimiento: '2026-05-01' }) }),
    } as ScanState);

    setup();
    fireEvent.press(screen.getByTestId('doc-type-expiry_date'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    expect(screen.getByText('Fecha de vencimiento leída: 2026-05-01')).toBeTruthy();
    fireEvent.press(screen.getByTestId('confirm-expiry'));
    expect(screen.getByText('Elegí un producto de la lista')).toBeTruthy();
    expect(mockedProducts.updateProduct).not.toHaveBeenCalled();
  });

  it('shows a hint when no date could be read', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({
      status: 'done',
      doc_type: 'expiry_date',
      result: baseResult({ doc_type: 'expiry_date', draft: baseDraft() }),
    } as ScanState);

    setup();
    fireEvent.press(screen.getByTestId('doc-type-expiry_date'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    expect(screen.getByText('No se pudo leer una fecha en la foto')).toBeTruthy();
  });

  it('searches, selects a product, and updates its vencimiento', async () => {
    jest.useFakeTimers();
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({
      status: 'done',
      doc_type: 'expiry_date',
      result: baseResult({ doc_type: 'expiry_date', draft: baseDraft({ vencimiento: '2026-05-01' }) }),
    } as ScanState);
    mockedProducts.suggestProducts.mockResolvedValue([{ id: 7, nombre: 'Leche', categoria: 'Lacteos', stock: 1 } as any]);
    mockedProducts.updateProduct.mockResolvedValue({ id: 7 } as any);

    const { onSuccess, onClose } = setup();
    fireEvent.press(screen.getByTestId('doc-type-expiry_date'));
    await act(async () => {
      jest.useRealTimers();
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });
    jest.useFakeTimers();

    fireEvent.changeText(screen.getByTestId('expiry-search-input'), 'lech');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    jest.useRealTimers();

    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    fireEvent.press(screen.getByText('Leche'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-expiry'));
    });

    expect(mockedProducts.updateProduct).toHaveBeenCalledWith(7, { vencimiento: '2026-05-01' });
    expect(onSuccess).toHaveBeenCalledWith('updated');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error when updating the product fails', async () => {
    mockedOcr.pickImage.mockResolvedValue({ uri: 'file://x.jpg' } as any);
    mockedOcr.scan.mockResolvedValue({
      status: 'done',
      doc_type: 'expiry_date',
      result: baseResult({ doc_type: 'expiry_date', draft: baseDraft({ vencimiento: '2026-05-01' }) }),
    } as ScanState);
    mockedProducts.suggestProducts.mockResolvedValue([{ id: 7, nombre: 'Leche', categoria: 'Lacteos', stock: 1 } as any]);
    mockedProducts.updateProduct.mockRejectedValue({ response: { data: { detail: 'no encontrado' } } });

    setup();
    fireEvent.press(screen.getByTestId('doc-type-expiry_date'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('scan-source-camera'));
    });

    fireEvent.changeText(screen.getByTestId('expiry-search-input'), 'lech');
    await waitFor(() => expect(mockedProducts.suggestProducts).toHaveBeenCalled(), { timeout: 2000 });
    await waitFor(() => expect(screen.getByText('Leche')).toBeTruthy());
    fireEvent.press(screen.getByText('Leche'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-expiry'));
    });

    expect(screen.getByText('no encontrado')).toBeTruthy();
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
