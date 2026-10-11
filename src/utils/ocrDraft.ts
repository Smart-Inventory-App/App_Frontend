import { ProductCreate, ProductSuggestion } from '../types/product';
import { isValidBarcode } from './barcode';
import { CONFIDENCE_THRESHOLD, ProductDraft, ProductMatch } from '../types/ocr';

/**
 * Lógica pura para pasar del borrador que arma el backend (`ProductDraft`) al
 * formulario de alta que ya existe en la app, y viceversa.
 *
 * Se mantiene separada de los componentes para poder probarla sin renderizar
 * nada: son funciones de datos a datos.
 */
export function draftToProductForm(draft: ProductDraft | null | undefined): Partial<ProductCreate> {
  if (!draft) return {};
  const form: Partial<ProductCreate> = {};
  if (draft.nombre) form.nombre = draft.nombre;
  if (draft.marca) form.marca = draft.marca;
  if (draft.categoria) form.categoria = draft.categoria;
  if (draft.stock != null) form.stock = draft.stock;
  if (draft.vencimiento) form.vencimiento = draft.vencimiento;
  if (draft.descripcion) form.descripcion = draft.descripcion;
  if (draft.codigo_barras) form.codigo_barras = draft.codigo_barras;
  return form;
}

/**
 * Completa el formulario con los datos de una coincidencia del inventario que
 * el usuario decidió usar. No pisa lo que el usuario ya haya tocado a mano
 * salvo el nombre, que es justamente lo que confirma la coincidencia.
 */
export function applyMatchToForm(
  form: Partial<ProductCreate>,
  match: ProductMatch,
): Partial<ProductCreate> {
  return {
    ...form,
    nombre: match.nombre,
    marca: match.marca ?? form.marca,
    categoria: match.categoria ?? form.categoria,
    ubicacion: match.ubicacion ?? form.ubicacion,
    codigo_barras: match.codigo_barras ?? form.codigo_barras,
  };
}

/**
 * Deja en el formulario los datos de un producto que ya existe (elegido por nombre o por código de barras):
 * código de barras, stock mínimo, días de anticipación, descripción e imagen incluidos.
 *
 * El formulario pasa a ser ese producto: lo que el producto no tiene se borra, aunque el usuario lo
 * hubiera completado antes (p. ej. un código de barras). La única excepción es el stock, que no es un
 * dato del producto sino la cantidad de esta entrada y por eso nunca se copia ni se borra.
 */
export function applySuggestionToForm(
  form: Partial<ProductCreate>,
  s: ProductSuggestion,
): Partial<ProductCreate> {
  return {
    nombre: s.nombre,
    categoria: s.categoria,
    stock: form.stock,
    marca: s.marca ?? undefined,
    ubicacion: s.ubicacion ?? undefined,
    vencimiento: s.vencimiento ?? undefined,
    stock_minimo: s.stock_minimo ?? undefined,
    dias_alerta_vencimiento: s.dias_alerta_vencimiento ?? undefined,
    descripcion: s.descripcion ?? undefined,
    imagen_url: s.imagen_url ?? undefined,
    codigo_barras: s.codigo_barras ?? undefined,
  };
}

export function isLowConfidence(confianzas: Record<string, number> | undefined, field: string): boolean {
  if (!confianzas || !(field in confianzas)) return false;
  return confianzas[field] < CONFIDENCE_THRESHOLD;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

export interface ReceiptLineState {
  draft: ProductDraft;
  productId: number | null;
  quantity: number;
}

export function initReceiptLines(items: ProductDraft[]): ReceiptLineState[] {
  return items.map(draft => ({
    draft,
    productId: draft.coincidencia_id ?? null,
    quantity: draft.stock && draft.stock > 0 ? draft.stock : 1,
  }));
}

export function buildSalidaItems(lines: ReceiptLineState[]): { product_id: number; quantity: number }[] {
  return lines
    .filter(line => line.productId != null && line.quantity > 0)
    .map(line => ({ product_id: line.productId as number, quantity: line.quantity }));
}

export type ProductFormError = 'nombre' | 'categoria' | 'stock' | 'vencimiento' | 'codigoBarras' | null;

export function validateProductForm(form: Partial<ProductCreate>): ProductFormError {
  if (!form.nombre?.trim()) return 'nombre';
  if (!form.categoria?.trim()) return 'categoria';
  if (form.stock === undefined || isNaN(form.stock) || form.stock <= 0) return 'stock';
  if (form.vencimiento && !isValidIsoDate(form.vencimiento)) return 'vencimiento';
  if (form.codigo_barras && !isValidBarcode(form.codigo_barras)) return 'codigoBarras';
  return null;
}

export function formatWaitSeconds(seconds: number | null | undefined): string {
  if (seconds == null) return '';
  if (seconds < 60) return `${seconds} s`;
  return `${Math.round(seconds / 60)} min`;
}
