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
  stock: number;
  stock_minimo?: number;
  dias_alerta_vencimiento?: number;
}

export interface ProductDefaults {
  last_categoria?: string;
  last_ubicacion?: string;
}

export interface ReposicionSuggestion {
  product_id: number;
  nombre: string;
  stock: number;
  imagen_url?: string;
  daily_rate: number;
  days_until_stockout?: number;
  suggested_qty: number;
}

export interface ConsumoPorDia {
  day: string;
  quantity: number;
}

export interface ProductoConsumo {
  product_id: number;
  nombre: string;
  cantidad: number;
}

export interface TrendsResponse {
  period_days: number;
  total_consumido: number;
  total_entradas: number;
  consumo_por_dia: ConsumoPorDia[];
  top_productos: ProductoConsumo[];
  productos_menos_usados: ProductoConsumo[];
}

export interface ConsumptionEvent {
  id: number;
  quantity: number;
  event_type: 'consumed' | 'expired' | 'restocked';
  consumed_at: string;
  note?: string;
  actor_email?: string;
  reverses_event_id?: number;
  reversed: boolean;
}
