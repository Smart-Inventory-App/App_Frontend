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
