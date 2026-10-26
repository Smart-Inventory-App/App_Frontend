import api from '../src/services/api';
import { productService } from '../src/services/productService';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('productService', () => {
  it('getProducts forwards filters and returns the list', async () => {
    mockedApi.get.mockResolvedValue({ data: [{ id: 1 }] });
    const result = await productService.getProducts({ search: 'leche' });
    expect(result).toEqual([{ id: 1 }]);
    expect(mockedApi.get).toHaveBeenCalledWith('/products/', { params: { search: 'leche' } });
  });

  it('getProducts forwards the page (limit and offset) to the API', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    await productService.getProducts({ sort_by: 'nombre', limit: 10, offset: 20 });
    expect(mockedApi.get).toHaveBeenCalledWith('/products/', { params: { sort_by: 'nombre', limit: 10, offset: 20 } });
  });

  it('getProducts works without filters', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    await productService.getProducts();
    expect(mockedApi.get).toHaveBeenCalledWith('/products/', { params: undefined });
  });

  it('getFilterOptions returns the categories/locations/brands', async () => {
    const data = { categorias: ['a'], ubicaciones: ['b'], marcas: ['c'] };
    mockedApi.get.mockResolvedValue({ data });
    await expect(productService.getFilterOptions()).resolves.toEqual(data);
    expect(mockedApi.get).toHaveBeenCalledWith('/products/filters/options');
  });

  it('suggestProducts queries by q', async () => {
    mockedApi.get.mockResolvedValue({ data: [{ id: 2, nombre: 'Yogur' }] });
    await productService.suggestProducts('yog');
    expect(mockedApi.get).toHaveBeenCalledWith('/products/suggest', { params: { q: 'yog' } });
  });

  it('getProductsByBarcode lists every product with the code (url-encoded)', async () => {
    mockedApi.get.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] });
    await expect(productService.getProductsByBarcode('779 123')).resolves.toEqual([{ id: 1 }, { id: 2 }]);
    expect(mockedApi.get).toHaveBeenCalledWith('/products/by-barcode/779%20123/all');
  });

  it('getDefaults returns last used values', async () => {
    mockedApi.get.mockResolvedValue({ data: { last_categoria: 'Lacteos' } });
    await expect(productService.getDefaults()).resolves.toEqual({ last_categoria: 'Lacteos' });
  });

  it('getProduct fetches a single product by id', async () => {
    mockedApi.get.mockResolvedValue({ data: { id: 5 } });
    await expect(productService.getProduct(5)).resolves.toEqual({ id: 5 });
    expect(mockedApi.get).toHaveBeenCalledWith('/products/5');
  });

  it('createProduct posts the payload', async () => {
    const payload = { nombre: 'Leche', categoria: 'Lacteos', stock: 1 };
    mockedApi.post.mockResolvedValue({ data: { id: 10, ...payload } });
    await expect(productService.createProduct(payload)).resolves.toEqual({ id: 10, ...payload });
    expect(mockedApi.post).toHaveBeenCalledWith('/products/', payload);
  });

  it('updateProduct puts the partial payload', async () => {
    mockedApi.put.mockResolvedValue({ data: { id: 3, nombre: 'Leche' } });
    await productService.updateProduct(3, { nombre: 'Leche' });
    expect(mockedApi.put).toHaveBeenCalledWith('/products/3', { nombre: 'Leche' });
  });

  it('deleteProduct calls delete with the id', async () => {
    mockedApi.delete.mockResolvedValue({ data: undefined });
    await productService.deleteProduct(9);
    expect(mockedApi.delete).toHaveBeenCalledWith('/products/9');
  });

  it('registerEvent posts quantity/type/note, omitting an empty note', async () => {
    mockedApi.post.mockResolvedValue({ data: { event_type: 'consumed', quantity: 1, remaining_stock: 4 } });
    await productService.registerEvent(1, 1, 'consumed');
    expect(mockedApi.post).toHaveBeenCalledWith('/products/1/events', {
      quantity: 1,
      event_type: 'consumed',
      note: undefined,
    });
  });

  it('restockProduct posts the quantity to add to an existing product', async () => {
    mockedApi.post.mockResolvedValue({ data: { id: 3, stock: 9, merged: true } });
    await expect(productService.restockProduct(3, 5)).resolves.toEqual({ id: 3, stock: 9, merged: true });
    expect(mockedApi.post).toHaveBeenCalledWith('/products/3/restock', { quantity: 5 });
  });

  it('getRecentChanges asks for the latest stock changes, five by default', async () => {
    mockedApi.get.mockResolvedValue({ data: [{ id: 'event-1' }] });
    await expect(productService.getRecentChanges()).resolves.toEqual([{ id: 'event-1' }]);
    expect(mockedApi.get).toHaveBeenCalledWith('/products/changes', { params: { limit: 5, offset: 0 } });
    await productService.getRecentChanges(2);
    expect(mockedApi.get).toHaveBeenLastCalledWith('/products/changes', { params: { limit: 2, offset: 0 } });
  });

  it('getRecentChanges can skip the changes already seen to ask for the next page', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    await productService.getRecentChanges(10, 20);
    expect(mockedApi.get).toHaveBeenCalledWith('/products/changes', { params: { limit: 10, offset: 20 } });
  });

  it('getStockTotal asks for the sum of the stock with the filters of the inventory', async () => {
    mockedApi.get.mockResolvedValue({ data: { stock_total: 40, products: 4 } });
    await expect(productService.getStockTotal({ search: 'lec', categoria: 'Lacteos' })).resolves.toEqual({ stock_total: 40, products: 4 });
    expect(mockedApi.get).toHaveBeenCalledWith('/products/stock-total', { params: { search: 'lec', categoria: 'Lacteos' } });
  });

  it('getStockTotal works without filters', async () => {
    mockedApi.get.mockResolvedValue({ data: { stock_total: 0, products: 0 } });
    await productService.getStockTotal();
    expect(mockedApi.get).toHaveBeenCalledWith('/products/stock-total', { params: undefined });
  });

  it('registerEvent forwards a given note', async () => {
    mockedApi.post.mockResolvedValue({ data: {} });
    await productService.registerEvent(1, 2, 'expired', 'vencido en heladera');
    expect(mockedApi.post).toHaveBeenCalledWith('/products/1/events', {
      quantity: 2,
      event_type: 'expired',
      note: 'vencido en heladera',
    });
  });

  it('getConsumptionHistory fetches the events for a product', async () => {
    mockedApi.get.mockResolvedValue({ data: [{ id: 1 }] });
    await expect(productService.getConsumptionHistory(1)).resolves.toEqual([{ id: 1 }]);
    expect(mockedApi.get).toHaveBeenCalledWith('/products/1/consumption');
  });

  it('updateConsumptionEvent puts the correction', async () => {
    mockedApi.put.mockResolvedValue({ data: { event_type: 'consumed', quantity: 3, remaining_stock: 2 } });
    await productService.updateConsumptionEvent(1, 2, 3, 'consumed', 'nota');
    expect(mockedApi.put).toHaveBeenCalledWith('/products/1/events/2', {
      quantity: 3,
      event_type: 'consumed',
      note: 'nota',
    });
  });

  it('deleteConsumptionEvent deletes an event by id', async () => {
    mockedApi.delete.mockResolvedValue({ data: { remaining_stock: 5 } });
    await expect(productService.deleteConsumptionEvent(1, 2)).resolves.toEqual({ remaining_stock: 5 });
    expect(mockedApi.delete).toHaveBeenCalledWith('/products/1/events/2');
  });
});
