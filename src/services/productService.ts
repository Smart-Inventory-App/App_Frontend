import api from './api';
import { ConsumptionEvent, Product, ProductCreate, ProductDefaults, ProductSuggestion, ReposicionSuggestion, TrendsResponse } from '../types/product';

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
  marcas: string[];
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

  async suggestProducts(q: string): Promise<ProductSuggestion[]> {
    const { data } = await api.get<ProductSuggestion[]>('/products/suggest', { params: { q } });
    return data;
  },

  async getDefaults(): Promise<ProductDefaults> {
    const { data } = await api.get<ProductDefaults>('/products/defaults');
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

  async registerEvent(
    productId: number,
    quantity: number,
    eventType: 'consumed' | 'expired',
    note?: string
  ): Promise<{ event_type: string; quantity: number; remaining_stock: number }> {
    const { data } = await api.post(`/products/${productId}/events`, {
      quantity,
      event_type: eventType,
      note: note || undefined,
    });
    return data;
  },

  async getConsumptionHistory(productId: number): Promise<ConsumptionEvent[]> {
    const { data } = await api.get<ConsumptionEvent[]>(`/products/${productId}/consumption`);
    return data;
  },

  async updateConsumptionEvent(
    productId: number,
    eventId: number,
    quantity: number,
    eventType: 'consumed' | 'expired' | 'restocked',
    note?: string
  ): Promise<{ event_type: string; quantity: number; remaining_stock: number }> {
    const { data } = await api.put(`/products/${productId}/events/${eventId}`, {
      quantity,
      event_type: eventType,
      note: note || undefined,
    });
    return data;
  },

  async deleteConsumptionEvent(productId: number, eventId: number): Promise<{ remaining_stock: number }> {
    const { data } = await api.delete(`/products/${productId}/events/${eventId}`);
    return data;
  },

  async getReposicionSugerida(): Promise<ReposicionSuggestion[]> {
    const { data } = await api.get<ReposicionSuggestion[]>('/products/reposicion-sugerida');
    return data;
  },

  async getTrends(periodDays: number = 30): Promise<TrendsResponse> {
    const { data } = await api.get<TrendsResponse>('/trends/', { params: { period: periodDays } });
    return data;
  },
};
