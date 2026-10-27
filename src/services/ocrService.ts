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
 * Elige o saca la foto a escanear. Con `crop`, antes de seguir se abre la pantalla del sistema para recortarla
 * (como al cargar la imagen de un producto), siempre: tanto si se saca con la cámara como si se elige de la galería.
 */
async function pickImage(source: 'camera' | 'gallery', crop = false): Promise<ImagePicker.ImagePickerAsset | null> {
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

async function scan(asset: ScanImageAsset, docType: ScanDocType): Promise<ScanState> {
  const formData = new FormData();
  await appendImage(formData, 'file', asset, 'scan.jpg');
  formData.append('doc_type', docType);

  const { data } = await api.post<ScanState>(SCAN_URL, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return data;
}

async function getJob(jobId: string): Promise<ScanState> {
  const { data } = await api.get<ScanState>(`${SCAN_URL}/${jobId}`);
  return data;
}

const defaultWait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

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
  while (attempts < maxAttempts) {
    if (shouldStop()) {
      throw new Error('cancelado');
    }

    const state = await getJob(jobId);
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
