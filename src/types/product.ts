export interface Product {
  id: number;
  user_id: string;
  nombre: string;
  marca?: string;
  categoria: string;
  stock: number;
  vencimiento?: string;
  descripcion?: string;
  imagen_url?: string;
  ubicacion?: string;
  codigo_barras?: string;
  stock_minimo?: number;
  dias_alerta_vencimiento?: number;
  created_at?: string;
  updated_at?: string;
  merged?: boolean;
}

export interface ProductCreate {
  nombre: string;
  marca?: string;
  categoria: string;
  stock: number;
  vencimiento?: string;
  descripcion?: string;
  imagen_url?: string;
  ubicacion?: string;
  codigo_barras?: string;
  stock_minimo?: number;
  dias_alerta_vencimiento?: number;
}

export interface ProductSuggestion {
  id: number;
  nombre: string;
  marca?: string;
  categoria: string;
  ubicacion?: string;
  vencimiento?: string;
  descripcion?: string;
  imagen_url?: string;
  codigo_barras?: string;
  stock: number;
  stock_minimo?: number;
  dias_alerta_vencimiento?: number;
}

export interface ProductDefaults {
  last_categoria?: string;
  last_ubicacion?: string;
}

// Motivos de una salida de stock
export type ExitReason = 'consumed' | 'expired' | 'sold' | 'rented';

export interface ConsumptionEvent {
  id: number;
  quantity: number;
  event_type: ExitReason | 'restocked';
  consumed_at: string;
  note?: string;
  actor_email?: string;
  reverses_event_id?: number;
  reversed: boolean;
}

// Los productos con el mismo nombre y categoría (la marca puede variar) se suman para ver el stock total:
// pueden tener distinta marca, vencimiento, ubicación, imagen o stock.
export interface ProductGroupKey {
  nombre: string;
  categoria: string;
}

export interface ProductGroupSummary extends ProductGroupKey {
  stock_total: number;
  lotes: number;
  proximo_vencimiento?: string | null;
}

export interface ProductGroupDetail extends ProductGroupSummary {
  productos: Product[];
}

// Un cambio del stock de un producto: una entrada, una salida o una modificación al editarlo
export type StockChangeKind = 'entrada' | 'salida' | 'modificacion';

export interface StockChange {
  id: string;
  kind: StockChangeKind;
  stock_before: number;
  stock_after: number;
  quantity: number;
  occurred_at: string;
  producto: Product;
}
