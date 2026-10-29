import * as ImagePicker from 'expo-image-picker';
import api from './api';
import { appendImage } from '../utils/formData';
import { EntradaOCRRequest, ScanDocType, ScanState, SalidaOCRItem, SalidaOCRRequest, SalidaOCRResult } from '../types/ocr';
import { ExitReason } from '../types/product';

const SCAN_URL = '/products/scan';
const UPLOAD_TIMEOUT_MS = 30000;

export interface ScanImageAsset {
  uri: string;
  name?: string | null;
  type?: string | null;
}

/**
 * Elige o saca la foto a escanear. Con `crop` (lo normal), antes de seguir se abre la pantalla del sistema para
 * recortarla (como al cargar la imagen de un producto), siempre: tanto si se saca con la cámara como si se elige de la
 * galería. Toda foto que pide la app se puede recortar.
 */
async function pickImage(source: 'camera' | 'gallery', crop = true): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (permission.status !== 'granted') {
    throw new Error(
      source === 'camera'
        ? 'Se necesita permiso para usar la cámara.'
        : 'Se necesita permiso para acceder a la galería.'
    );
  }

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: crop })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: crop });

  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  return result.assets[0];
}

const defaultWait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Cuánto se espera antes de volver a mandar la foto si el primer intento falló por algo pasajero
const SCAN_RETRY_DELAY_MS = 1000;
// Cuántas consultas seguidas del estado pueden fallar por algo pasajero antes de darse por vencido
const MAX_TRANSIENT_POLL_FAILURES = 3;
// La consulta del estado puede tardar más de lo normal mientras el servicio de OCR está ocupado (por ejemplo, la primera vez)
const POLL_TIMEOUT_MS = 30000;

/**
 * Un fallo pasajero, que al reintentar suele resolverse: no hubo respuesta (se cortó la conexión o se agotó el tiempo)
 * o el servicio estaba momentáneamente caído u ocupado (502, 503, 504). Un rechazo del backend (validación, sesión,
 * límite de pedidos) no lo es: reintentar daría lo mismo.
 */
export function isTransientError(err: unknown): boolean {
  const error = err as { response?: { status?: number }; code?: string; message?: string; isAxiosError?: boolean } | null;
  if (!error) return false;
  if (error.response) return [502, 503, 504].includes(error.response.status ?? 0);
  return error.isAxiosError === true
    || ['ECONNABORTED', 'ERR_NETWORK', 'ETIMEDOUT'].includes(error.code ?? '')
    || error.message === 'Network Error';
}

async function scan(asset: ScanImageAsset, docType: ScanDocType): Promise<ScanState> {
  const send = async () => {
    const formData = new FormData();
    await appendImage(formData, 'file', asset, 'scan.jpg');
    formData.append('doc_type', docType);

    const { data } = await api.post<ScanState>(SCAN_URL, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: UPLOAD_TIMEOUT_MS,
    });
    return data;
  };

  // La primera foto de una sesión solía fallar y la segunda funcionar: ante un fallo pasajero se reintenta una vez, sin
  // que el usuario tenga que volver a elegir la foto
  try {
    return await send();
  } catch (err) {
    if (!isTransientError(err)) throw err;
    await defaultWait(SCAN_RETRY_DELAY_MS);
    return send();
  }
}

async function getJob(jobId: string): Promise<ScanState> {
  const { data } = await api.get<ScanState>(`${SCAN_URL}/${jobId}`, { timeout: POLL_TIMEOUT_MS });
  return data;
}

export interface PollOptions {
  intervalMs?: number;
  maxAttempts?: number;
  onUpdate?: (state: ScanState) => void;
  wait?: (ms: number) => Promise<void>;
  shouldStop?: () => boolean;
}

/**
 * Consulta el estado de un escaneo hasta que termina (`done`/`failed`).
 *
 * Un código de barras nunca llega hasta acá: el backend lo resuelve en la
 * misma llamada de `scan()`. Esto es sólo para los tipos que se encolan.
 */
async function pollJob(jobId: string, options: PollOptions = {}): Promise<ScanState> {
  const {
    intervalMs = 1500,
    maxAttempts = 60,
    onUpdate,
    wait = defaultWait,
    shouldStop = () => false,
  } = options;

  let attempts = 0;
  let transientFailures = 0;
  while (attempts < maxAttempts) {
    if (shouldStop()) {
      throw new Error('cancelado');
    }

    let state: ScanState;
    try {
      state = await getJob(jobId);
      transientFailures = 0;
    } catch (err) {
      // Una consulta que falla por algo pasajero no pierde el seguimiento: se vuelve a consultar
      if (!isTransientError(err) || ++transientFailures > MAX_TRANSIENT_POLL_FAILURES) throw err;
      attempts += 1;
      await wait(intervalMs);
      continue;
    }
    onUpdate?.(state);

    if (state.status === 'done' || state.status === 'failed') {
      return state;
    }

    attempts += 1;
    await wait(intervalMs);
  }

  throw new Error('timeout');
}

async function submitSalida(items: SalidaOCRItem[], comercio?: string | null, motivo?: ExitReason): Promise<SalidaOCRResult> {
  const payload: SalidaOCRRequest = { items, comercio: comercio || undefined, motivo };
  const { data } = await api.post<SalidaOCRResult>(`${SCAN_URL}/salida`, payload);
  return data;
}

// Ingresa stock de los productos de un comprobante (la contracara de submitSalida)
async function submitEntrada(items: SalidaOCRItem[], comercio?: string | null): Promise<SalidaOCRResult> {
  const payload: EntradaOCRRequest = { items, comercio: comercio || undefined };
  const { data } = await api.post<SalidaOCRResult>(`${SCAN_URL}/entrada`, payload);
  return data;
}

/**
 * Traduce el error de una llamada de escaneo a un mensaje para el usuario.
 *
 * Sigue la misma idea que ya usa el resto de la app (leer
 * `err.response.data.detail`), sumando los dos casos que importan acá porque
 * dependen de un módulo externo: el motor de OCR caído (503) y el límite de
 * pedidos simultáneos (429, con el `Retry-After` que manda el backend).
 */
export function getScanErrorMessage(err: unknown, fallback: string): string {
  const response = (err as { response?: { status?: number; data?: { detail?: unknown }; headers?: Record<string, string> } })?.response;

  if (response?.status === 503 || response?.status === 502) {
    return 'El servicio de escaneo no está disponible en este momento. Probá de nuevo en unos minutos.';
  }

  const detail = response?.data?.detail;
  const detailText = typeof detail === 'string' ? detail : fallback;

  if (response?.status === 429) {
    const retryAfter = Number(response?.headers?.['retry-after']);
    if (retryAfter > 0) {
      const wait = retryAfter < 60 ? `${retryAfter} segundos` : `${Math.round(retryAfter / 60)} minutos`;
      return `${detailText} Probá de nuevo en ${wait}.`;
    }
  }

  return detailText;
}

export const ocrService = {
  pickImage,
  scan,
  getJob,
  pollJob,
  submitSalida,
  submitEntrada,
};

export default ocrService;
