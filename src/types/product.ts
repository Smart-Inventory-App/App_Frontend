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
