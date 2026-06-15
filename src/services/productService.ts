import api from './api';
import { Product, ProductCreate } from '../types/product';

export interface ProductFilters {
  search?: string;
  categoria?: string;
  ubicacion?: string;
  sort_by?: 'nombre' | 'stock' | 'vencimiento' | 'categoria';
  sort_dir?: 'asc' | 'desc';
}

export interface ProductFilterOptions {
  categorias: string[];
  ubicaciones: string[];
}

export const productService = {
  async getProducts(params?: ProductFilters): Promise<Product[]> {
    const { data } = await api.get<Product[]>('/products/', { params });
    return data;
  },

  async getFilterOptions(): Promise<ProductFilterOptions> {
    const { data } = await api.get<ProductFilterOptions>('/products/filters/options');
    return data;
  },

  async getProduct(id: number): Promise<Product> {
    const { data } = await api.get<Product>(`/products/${id}`);
    return data;
  },

  async createProduct(payload: ProductCreate): Promise<Product> {
    const { data } = await api.post<Product>('/products/', payload);
    return data;
  },

  async updateProduct(id: number, payload: Partial<ProductCreate>): Promise<Product> {
    const { data } = await api.put<Product>(`/products/${id}`, payload);
    return data;
  },

  async deleteProduct(id: number): Promise<void> {
    await api.delete(`/products/${id}`);
  },
};
