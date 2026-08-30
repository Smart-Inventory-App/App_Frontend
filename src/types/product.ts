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
  stock_minimo?: number;
  dias_alerta_vencimiento?: number;
}

export interface ProductDefaults {
  last_categoria?: string;
  last_ubicacion?: string;
}

export interface ConsumptionEvent {
  id: number;
  quantity: number;
  event_type: 'consumed' | 'expired' | 'restocked';
  consumed_at: string;
}
