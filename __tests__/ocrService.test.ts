import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import api from '../src/services/api';
import { ocrService, getScanErrorMessage } from '../src/services/ocrService';
import { ScanState } from '../src/types/ocr';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ocrService.pickImage', () => {
  it('throws when camera permission is denied', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    await expect(ocrService.pickImage('camera')).rejects.toThrow(/cámara/);
  });

  it('throws when gallery permission is denied', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    await expect(ocrService.pickImage('gallery')).rejects.toThrow(/galería/);
  });

  it('returns null when the user cancels the camera', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: null });
    await expect(ocrService.pickImage('camera')).resolves.toBeNull();
  });

  it('returns null when the user cancels the gallery picker', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [] });
    await expect(ocrService.pickImage('gallery')).resolves.toBeNull();
  });

  it('returns the first asset from the camera', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    const asset = { uri: 'file://a.jpg' };
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [asset] });
    await expect(ocrService.pickImage('camera')).resolves.toBe(asset);
  });

  it('does not open the system crop screen by default', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });
    await ocrService.pickImage('camera');
    await ocrService.pickImage('gallery');
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: false }));
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: false }));
  });

  it('opens the system crop screen before processing when asked to, with the camera and with the gallery', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });
    await ocrService.pickImage('camera', true);
    await ocrService.pickImage('gallery', true);
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true }));
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true }));
  });

  it('returns the first asset from the gallery', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    const asset = { uri: 'file://b.jpg' };
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [asset] });
    await expect(ocrService.pickImage('gallery')).resolves.toBe(asset);
  });
});

describe('ocrService.scan', () => {
  it('posts a multipart form with the file and doc_type, and returns the state', async () => {
    const state: ScanState = { status: 'queued', doc_type: 'product_label', job_id: 'job-1' };
    mockedApi.post.mockResolvedValue({ data: state });

    const result = await ocrService.scan({ uri: 'file://x.jpg', name: 'x.jpg', type: 'image/jpeg' }, 'product_label');

    expect(result).toEqual(state);
    expect(mockedApi.post).toHaveBeenCalledWith(
      '/products/scan',
      expect.any(FormData),
      expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 }),
    );
  });

  it('defaults the filename and mime type when the asset does not provide them', async () => {
    mockedApi.post.mockResolvedValue({ data: { status: 'done', doc_type: 'barcode' } });
    await ocrService.scan({ uri: 'file://x.jpg' }, 'barcode');
    expect(mockedApi.post).toHaveBeenCalled();
  });
});

describe('ocrService.getJob', () => {
  it('fetches the job by id', async () => {
    const state: ScanState = { status: 'done', doc_type: 'barcode' };
    mockedApi.get.mockResolvedValue({ data: state });
    await expect(ocrService.getJob('job-1')).resolves.toEqual(state);
    expect(mockedApi.get).toHaveBeenCalledWith('/products/scan/job-1');
  });
});

describe('ocrService.pollJob', () => {
  const noWait = () => Promise.resolve();

  it('resolves as soon as the job is done', async () => {
    mockedApi.get.mockResolvedValue({ data: { status: 'done', doc_type: 'product_label' } });
    const result = await ocrService.pollJob('job-1', { wait: noWait });
    expect(result.status).toBe('done');
    expect(mockedApi.get).toHaveBeenCalledTimes(1);
  });

  it('resolves when the job fails', async () => {
    mockedApi.get.mockResolvedValue({ data: { status: 'failed', doc_type: 'product_label', error: 'boom' } });
    const result = await ocrService.pollJob('job-1', { wait: noWait });
    expect(result.status).toBe('failed');
  });

  it('keeps polling while queued/processing, calling onUpdate each time', async () => {
    mockedApi.get
      .mockResolvedValueOnce({ data: { status: 'queued', doc_type: 'receipt', queue_position: 3 } })
      .mockResolvedValueOnce({ data: { status: 'processing', doc_type: 'receipt' } })
      .mockResolvedValueOnce({ data: { status: 'done', doc_type: 'receipt' } });

    const onUpdate = jest.fn();
    const result = await ocrService.pollJob('job-1', { wait: noWait, onUpdate });

    expect(result.status).toBe('done');
    expect(mockedApi.get).toHaveBeenCalledTimes(3);
    expect(onUpdate).toHaveBeenCalledTimes(3);
    expect(onUpdate.mock.calls[0][0].queue_position).toBe(3);
  });

  it('stops and throws when shouldStop returns true', async () => {
    mockedApi.get.mockResolvedValue({ data: { status: 'queued', doc_type: 'receipt' } });
    await expect(
      ocrService.pollJob('job-1', { wait: noWait, shouldStop: () => true }),
    ).rejects.toThrow('cancelado');
  });

  it('throws a timeout error after exhausting maxAttempts', async () => {
    mockedApi.get.mockResolvedValue({ data: { status: 'queued', doc_type: 'receipt' } });
    await expect(
      ocrService.pollJob('job-1', { wait: noWait, maxAttempts: 2 }),
    ).rejects.toThrow('timeout');
    expect(mockedApi.get).toHaveBeenCalledTimes(2);
  });

  it('uses the default real-timer wait function when none is provided', async () => {
    jest.useFakeTimers();
    mockedApi.get
      .mockResolvedValueOnce({ data: { status: 'queued', doc_type: 'receipt' } })
      .mockResolvedValueOnce({ data: { status: 'done', doc_type: 'receipt' } });

    const promise = ocrService.pollJob('job-1', { intervalMs: 100 });
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.status).toBe('done');
    jest.useRealTimers();
  });
});

describe('ocrService.submitSalida', () => {
  it('posts the items and comercio, and returns the result', async () => {
    const response = { procesados: 1, fallidos: 0, errores: [] };
    mockedApi.post.mockResolvedValue({ data: response });

    const result = await ocrService.submitSalida([{ product_id: 1, quantity: 2 }], 'Kiosco Don Juan');

    expect(result).toEqual(response);
    expect(mockedApi.post).toHaveBeenCalledWith('/products/scan/salida', {
      items: [{ product_id: 1, quantity: 2 }],
      comercio: 'Kiosco Don Juan',
    });
  });

  it('sends comercio as undefined when not provided', async () => {
    mockedApi.post.mockResolvedValue({ data: { procesados: 0, fallidos: 0, errores: [] } });
    await ocrService.submitSalida([{ product_id: 1, quantity: 1 }]);
    expect(mockedApi.post).toHaveBeenCalledWith('/products/scan/salida', {
      items: [{ product_id: 1, quantity: 1 }],
      comercio: undefined,
    });
  });
});

describe('ocrService.submitSalida - motivo', () => {
  it('sends the chosen kind of exit', async () => {
    mockedApi.post.mockResolvedValue({ data: { procesados: 1, fallidos: 0, errores: [] } });
    await ocrService.submitSalida([{ product_id: 1, quantity: 1 }], 'Kiosco', 'sold');
    expect(mockedApi.post).toHaveBeenCalledWith('/products/scan/salida', {
      items: [{ product_id: 1, quantity: 1 }],
      comercio: 'Kiosco',
      motivo: 'sold',
    });
  });
});

describe('ocrService.submitEntrada', () => {
  it('posts the items and comercio to the entry endpoint, and returns the result', async () => {
    const response = { procesados: 1, fallidos: 0, errores: [] };
    mockedApi.post.mockResolvedValue({ data: response });

    const result = await ocrService.submitEntrada([{ product_id: 1, quantity: 2 }], 'Kiosco Don Juan');

    expect(result).toEqual(response);
    expect(mockedApi.post).toHaveBeenCalledWith('/products/scan/entrada', {
      items: [{ product_id: 1, quantity: 2 }],
      comercio: 'Kiosco Don Juan',
    });
  });

  it('sends comercio as undefined when not provided', async () => {
    mockedApi.post.mockResolvedValue({ data: { procesados: 0, fallidos: 0, errores: [] } });
    await ocrService.submitEntrada([{ product_id: 1, quantity: 1 }]);
    expect(mockedApi.post).toHaveBeenCalledWith('/products/scan/entrada', {
      items: [{ product_id: 1, quantity: 1 }],
      comercio: undefined,
    });
  });
});

describe('getScanErrorMessage', () => {
  it('returns a friendly message for a 503', () => {
    const err = { response: { status: 503, data: { detail: 'raw gateway error' } } };
    expect(getScanErrorMessage(err, 'fallback')).toMatch(/no está disponible/);
  });

  it('uses the backend detail when present', () => {
    const err = { response: { status: 400, data: { detail: 'Formato no permitido' } } };
    expect(getScanErrorMessage(err, 'fallback')).toBe('Formato no permitido');
  });

  it('falls back to the given message when there is no detail', () => {
    const err = { response: { status: 500, data: {} } };
    expect(getScanErrorMessage(err, 'fallback')).toBe('fallback');
  });

  it('adds a retry-after hint in seconds for a 429', () => {
    const err = {
      response: { status: 429, data: { detail: 'Límite superado' }, headers: { 'retry-after': '30' } },
    };
    expect(getScanErrorMessage(err, 'fallback')).toBe('Límite superado Probá de nuevo en 30 segundos.');
  });

  it('adds a retry-after hint in minutes for a 429 with a long wait', () => {
    const err = {
      response: { status: 429, data: { detail: 'Límite superado' }, headers: { 'retry-after': '120' } },
    };
    expect(getScanErrorMessage(err, 'fallback')).toBe('Límite superado Probá de nuevo en 2 minutos.');
  });

  it('does not add a retry hint for a 429 without retry-after', () => {
    const err = { response: { status: 429, data: { detail: 'Límite superado' }, headers: {} } };
    expect(getScanErrorMessage(err, 'fallback')).toBe('Límite superado');
  });

  it('handles an error without a response object at all', () => {
    expect(getScanErrorMessage(new Error('network down'), 'fallback')).toBe('fallback');
  });
});

describe('getScanErrorMessage (502)', () => {
  it('trata un 502 del módulo de OCR igual que un 503', () => {
    const err = { response: { status: 502, data: { detail: 'Bad gateway' } } };
    expect(getScanErrorMessage(err, 'fallback')).toMatch(/no está disponible/);
  });
});

describe('ocrService.scan (web)', () => {
  const originalFetch = (global as any).fetch;

  afterEach(() => {
    (Platform as any).OS = 'ios';
    (global as any).fetch = originalFetch;
  });

  it('adjunta un Blob real en vez del objeto { uri } que el navegador serializa como texto', async () => {
    (Platform as any).OS = 'web';
    const blob = new (Blob as any)(['x'], { type: 'image/jpeg' });
    (global as any).fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) });
    mockedApi.post.mockResolvedValue({ data: { status: 'done', doc_type: 'barcode' } });

    await ocrService.scan({ uri: 'blob:http://localhost/1', name: 'b.jpg', type: 'image/jpeg' }, 'barcode');

    const form = mockedApi.post.mock.calls[0][1] as any;
    expect(form.get('doc_type')).toBe('barcode');
    expect(form.get('file')).toBeInstanceOf(Blob);
  });
});
