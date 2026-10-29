/**
 * Tipos que reflejan el contrato de `app_backend` (`app/schemas/ocr.py`).
 *
 * Los 4 `doc_type` soportados por el backend, y la forma exacta del borrador
 * que arma `ocr_draft.to_scan_result`.
 */
import { ExitReason } from './product';

export type ScanDocType = 'product_label' | 'expiry_date' | 'receipt' | 'barcode';

export const SCAN_DOC_TYPES: ScanDocType[] = [
  'product_label',
  'expiry_date',
  'receipt',
  'barcode',
];

// El escaneo general ("Escanear imágenes") ofrece solo estos dos; la fecha de vencimiento y el código
// de barras se escanean desde el botón de cámara de su propio campo del formulario.
export const GENERAL_SCAN_DOC_TYPES: ScanDocType[] = ['product_label', 'receipt'];

export type FieldScanDocType = 'expiry_date' | 'barcode';

// Tipos con los que el escaneo puede abrirse directo, sin preguntar qué se va a escanear
export type FixedScanDocType = FieldScanDocType | 'receipt';

export type ScanJobStatus = 'queued' | 'processing' | 'done' | 'failed';

export interface ProductMatch {
  id: number;
  nombre: string;
  marca?: string | null;
  categoria?: string | null;
  ubicacion?: string | null;
  vencimiento?: string | null;
  stock: number;
  codigo_barras?: string | null;
  score: number;
  por_codigo: boolean;
}

export interface ProductDraft {
  nombre?: string | null;
  marca?: string | null;
  categoria?: string | null;
  stock?: number | null;
  vencimiento?: string | null;
  descripcion?: string | null;
  codigo_barras?: string | null;
  pais_registro?: string | null;
  confianzas: Record<string, number>;
  texto_leido?: string | null;
  coincidencias: ProductMatch[];
  coincidencia_id?: number | null;
}

export interface ReceiptInfo {
  comercio?: string | null;
  fecha_compra?: string | null;
  total?: number | null;
}

export interface ScanResult {
  doc_type: ScanDocType;
  draft: ProductDraft | null;
  items: ProductDraft[];
  comprobante: ReceiptInfo | null;
  needs_review: boolean;
  confianza: number;
  texto_legible: string;
  advertencias: string[];
  sin_coincidencia: number;
}

export interface ScanState {
  job_id?: string | null;
  status: ScanJobStatus | string;
  doc_type: ScanDocType;
  result?: ScanResult | null;
  error?: string | null;
  queue_position?: number | null;
  estimated_wait_seconds?: number | null;
}

export interface SalidaOCRItem {
  product_id: number;
  quantity: number;
}

export interface SalidaOCRRequest {
  items: SalidaOCRItem[];
  comercio?: string;
  motivo?: ExitReason;
}

export interface EntradaOCRRequest {
  items: SalidaOCRItem[];
  comercio?: string;
}

export interface SalidaOCRResult {
  procesados: number;
  fallidos: number;
  errores: string[];
}

/** Umbral bajo el cual conviene mostrar un campo como "poco confiable" (matching.UMBRAL_CONFIABLE). */
export const CONFIDENCE_THRESHOLD = 0.85;

/** Lo que se leyó de una etiqueta (con la foto ya recortada) y todavía no se cargó en ningún formulario. */
export interface LabelScan {
  draft: ProductDraft;
  /** La foto que se escaneó: si el usuario confirma, pasa a ser la imagen del producto. */
  asset: { uri: string; fileName?: string | null; mimeType?: string | null; width?: number; height?: number } | null;
}
