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
}

export interface ProductSuggestion {
  nombre: string;
  marca?: string;
  categoria: string;
  ubicacion?: string;
}

export interface ProductDefaults {
  last_categoria?: string;
  last_ubicacion?: string;
}
