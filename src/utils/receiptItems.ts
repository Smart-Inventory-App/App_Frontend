import { ProductDraft, ProductMatch, SalidaOCRItem } from '../types/ocr';
import { ProductSuggestion } from '../types/product';

/**
 * Lógica pura de los productos leídos de un ticket, remito o factura: cada uno con lo que se leyó, el nombre que
 * el usuario deja, el producto de su inventario que elige y el stock a ingresar o descontar.
 */

export const RECEIPT_STOCK_MAX_DIGITS = 6;

export type ReceiptDirection = 'entrada' | 'salida';

export interface ReceiptItem {
  /** Identifica el producto en la lista aunque se descarte otro (no es el lugar que ocupa). */
  id: number;
  /** Lo que decía el documento. Un producto agregado a mano no lo tiene. */
  textoLeido: string | null;
  /** Agregado a mano por el usuario (se muestra como «Carga manual»). */
  manual: boolean;
  /** El nombre del input: el identificado, o el que el usuario escribió. */
  name: string;
  /** El producto del inventario elegido. */
  selected: ProductSuggestion | null;
  /** Los productos recomendados (los más parecidos al nombre). */
  options: ProductSuggestion[];
  /** Porcentaje de similitud de los productos que recomendó la lectura, por id de producto. */
  similarity: Record<number, number>;
  /** Ya se buscó con el nombre que hay en el input: sin opciones, significa que no hay coincidencias. */
  searched: boolean;
  /** Texto del input de stock: puede quedar en blanco, y entonces se le avisa al usuario. */
  quantity: string;
  /** El usuario ya tocó el stock: recién ahí corresponde avisar que no puede quedar en blanco. */
  quantityTouched: boolean;
}

export type ReceiptItemError =
  | { field: 'name'; kind: 'noName' | 'noProduct' }
  | { field: 'quantity'; kind: 'required' }
  | { field: 'quantity'; kind: 'exceeds'; available: number };

export function matchToSuggestion(match: ProductMatch): ProductSuggestion {
  return {
    id: match.id,
    nombre: match.nombre,
    marca: match.marca ?? undefined,
    categoria: match.categoria ?? '',
    ubicacion: match.ubicacion ?? undefined,
    vencimiento: match.vencimiento ?? undefined,
    codigo_barras: match.codigo_barras ?? undefined,
    stock: match.stock,
  };
}

/** Une listas de productos en ese orden, sin repetir ninguno. */
export function mergeSuggestions(...lists: (ProductSuggestion[] | undefined)[]): ProductSuggestion[] {
  const seen = new Set<number>();
  const merged: ProductSuggestion[] = [];
  for (const list of lists) {
    for (const product of Array.isArray(list) ? list : []) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      merged.push(product);
    }
  }
  return merged;
}

/** Los productos leídos del documento, como se muestran: los parecidos de mayor a menor similitud. */
export function initReceiptItems(drafts: ProductDraft[]): ReceiptItem[] {
  return drafts.map((draft, index) => {
    const matches = [...draft.coincidencias].sort((a, b) => b.score - a.score);
    const options = matches.map(matchToSuggestion);
    const similarity: Record<number, number> = {};
    matches.forEach(match => { similarity[match.id] = Math.round(match.score * 100); });
    // Si el escaneo está seguro de cuál es, ya queda elegido
    const selected = draft.coincidencia_id != null ? options.find(option => option.id === draft.coincidencia_id) ?? null : null;
    return {
      id: index,
      textoLeido: draft.texto_leido ?? draft.nombre ?? null,
      manual: false,
      name: selected?.nombre ?? draft.nombre ?? draft.texto_leido ?? '',
      selected,
      options: selected ? [] : options,
      similarity,
      searched: true,
      quantity: draft.stock != null && draft.stock > 0 ? String(draft.stock) : '1',
      quantityTouched: false,
    };
  });
}

/** Un producto agregado a mano: sin texto leído, con el nombre y el stock en blanco. */
export function blankReceiptItem(id: number): ReceiptItem {
  return {
    id,
    textoLeido: null,
    manual: true,
    name: '',
    selected: null,
    options: [],
    similarity: {},
    searched: false,
    quantity: '',
    quantityTouched: false,
  };
}

export const parseQuantity = (quantity: string): number => {
  const value = parseInt(quantity, 10);
  return Number.isNaN(value) ? 0 : value;
};

/**
 * Lo que está mal de cada producto, por id. En una salida el stock a sacar no puede superar el que se tiene del producto
 * (si dos productos leídos son el mismo, entre los dos).
 */
export function validateReceiptItems(items: ReceiptItem[], direction: ReceiptDirection): Record<number, ReceiptItemError[]> {
  const errors: Record<number, ReceiptItemError[]> = {};
  const taken: Record<number, number> = {};
  for (const item of items) {
    const list: ReceiptItemError[] = [];
    if (!item.selected) {
      list.push({ field: 'name', kind: item.name.trim() ? 'noProduct' : 'noName' });
    }
    const quantity = parseQuantity(item.quantity);
    if (quantity <= 0) {
      list.push({ field: 'quantity', kind: 'required' });
    } else if (direction === 'salida' && item.selected) {
      taken[item.selected.id] = (taken[item.selected.id] ?? 0) + quantity;
      if (taken[item.selected.id] > item.selected.stock) {
        list.push({ field: 'quantity', kind: 'exceeds', available: item.selected.stock });
      }
    }
    errors[item.id] = list;
  }
  return errors;
}

/** Lo que se envía al backend: el producto elegido y el stock de cada uno. */
export function buildReceiptPayload(items: ReceiptItem[]): SalidaOCRItem[] {
  return items
    .filter(item => item.selected)
    .map(item => ({ product_id: (item.selected as ProductSuggestion).id, quantity: parseQuantity(item.quantity) }));
}
