import api from './api';
import {
  ConsumptionEvent,
  ExitReason,
  Product,
  ProductCreate,
  ProductDefaults,
  ProductSuggestion,
  StockTotal,
  ReposicionSuggestion,
  StockChange,
  TrendsResponse,
} from '../types/product';

export interface ProductFilters {
  search?: string;
  categoria?: string;
  ubicacion?: string;
  sort_by?: 'nombre' | 'stock' | 'vencimiento' | 'categoria';
  sort_dir?: 'asc' | 'desc';
  /** Para pedir de a páginas: cuántos productos traer y cuántos saltear. Sin `limit` trae todos. */
  limit?: number;
  offset?: number;
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

  /** La suma del stock y la cantidad de productos que cumplen los filtros del inventario (todos, no solo una página). */
  async getStockTotal(params?: { search?: string; categoria?: string; ubicacion?: string }): Promise<StockTotal> {
    const { data } = await api.get<StockTotal>('/products/stock-total', { params });
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

  /**
   * Los últimos cambios de stock del usuario (entradas, salidas y modificaciones), del más nuevo al más viejo.
   * `offset` salta esa cantidad de cambios para pedir las páginas siguientes.
   */
  async getRecentChanges(limit = 5, offset = 0): Promise<StockChange[]> {
    const { data } = await api.get<StockChange[]>('/products/changes', { params: { limit, offset } });
    return data;
  },

  async getProductsByBarcode(codigo: string): Promise<ProductSuggestion[]> {
    const { data } = await api.get<ProductSuggestion[]>(`/products/by-barcode/${encodeURIComponent(codigo)}/all`);
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

  /** Suma stock a un producto que el usuario ya tiene cargado. */
  async restockProduct(id: number, quantity: number): Promise<Product> {
    const { data } = await api.post<Product>(`/products/${id}/restock`, { quantity });
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
    eventType: ExitReason,
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
    eventType: ExitReason | 'restocked',
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
