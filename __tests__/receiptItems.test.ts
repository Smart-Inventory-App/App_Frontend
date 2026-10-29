import {
  blankReceiptItem,
  buildReceiptPayload,
  initReceiptItems,
  matchToSuggestion,
  mergeSuggestions,
  parseQuantity,
  ReceiptItem,
  validateReceiptItems,
} from '../src/utils/receiptItems';
import { ProductDraft } from '../src/types/ocr';
import { ProductSuggestion } from '../src/types/product';

const draft = (overrides: Partial<ProductDraft> = {}): ProductDraft => ({ confianzas: {}, coincidencias: [], ...overrides });
const product = (id: number, stock = 5, nombre = `Producto ${id}`): ProductSuggestion => ({ id, nombre, categoria: 'Almacen', stock });
const item = (overrides: Partial<ReceiptItem> = {}): ReceiptItem => ({ ...blankReceiptItem(0), ...overrides });

describe('matchToSuggestion', () => {
  it('turns a match of the scan into a product, dropping the empty fields', () => {
    expect(matchToSuggestion({ id: 3, nombre: 'Leche', marca: null, categoria: null, stock: 4, score: 0.8, por_codigo: false }))
      .toEqual({ id: 3, nombre: 'Leche', marca: undefined, categoria: '', ubicacion: undefined, vencimiento: undefined, codigo_barras: undefined, stock: 4 });
  });
});

describe('mergeSuggestions', () => {
  it('joins the lists in order without repeating a product, and ignores missing lists', () => {
    expect(mergeSuggestions([product(1), product(2)], undefined, [product(2), product(3)]).map(p => p.id)).toEqual([1, 2, 3]);
    expect(mergeSuggestions(undefined, null as any)).toEqual([]);
  });
});

describe('initReceiptItems', () => {
  const matches = [
    { id: 1, nombre: 'Yogur Natural', score: 0.6, por_codigo: false, stock: 2 },
    { id: 2, nombre: 'Yogur Ser', score: 0.92, por_codigo: false, stock: 7 },
  ];

  it('recommends the most similar products first, with their percentage', () => {
    const [first] = initReceiptItems([draft({ nombre: 'Yogur', texto_leido: 'YOGUR SER', stock: 2, coincidencias: matches })]);
    expect(first.options.map(o => o.id)).toEqual([2, 1]);
    expect(first.similarity).toEqual({ 1: 60, 2: 92 });
    expect(first.textoLeido).toBe('YOGUR SER');
    expect(first.name).toBe('Yogur');
    expect(first.quantity).toBe('2');
    expect(first.selected).toBeNull();
    expect(first.searched).toBe(true);
  });

  it('selects the product the scan is sure about and puts its name in the input', () => {
    const [first] = initReceiptItems([draft({ nombre: 'Yogur', coincidencia_id: 2, coincidencias: matches })]);
    expect(first.selected?.id).toBe(2);
    expect(first.name).toBe('Yogur Ser');
    expect(first.options).toEqual([]);
  });

  it('does not select a product that is not among the matches', () => {
    const [first] = initReceiptItems([draft({ nombre: 'Yogur', coincidencia_id: 99, coincidencias: matches })]);
    expect(first.selected).toBeNull();
    expect(first.options).toHaveLength(2);
  });

  it('numbers the items, falls back to the read text for the name and to 1 for a missing or non-positive stock', () => {
    const items = initReceiptItems([draft({ texto_leido: 'ALGO', stock: 0 }), draft({ nombre: 'Fideos', stock: null }), draft()]);
    expect(items.map(i => i.id)).toEqual([0, 1, 2]);
    expect(items[0].name).toBe('ALGO');
    expect(items[0].quantity).toBe('1');
    expect(items[1].textoLeido).toBe('Fideos');
    expect(items[1].quantity).toBe('1');
    expect(items[2].textoLeido).toBeNull();
    expect(items[2].name).toBe('');
  });
});

describe('blankReceiptItem', () => {
  it('has no read text and a blank name and stock', () => {
    expect(blankReceiptItem(7)).toMatchObject({ id: 7, textoLeido: null, name: '', quantity: '', selected: null, options: [], searched: false });
  });
});

describe('parseQuantity', () => {
  it('reads the digits, and anything else is 0', () => {
    expect(parseQuantity('12')).toBe(12);
    expect(parseQuantity('')).toBe(0);
    expect(parseQuantity('abc')).toBe(0);
  });
});

describe('validateReceiptItems', () => {
  it('asks for a name, then for a product of the inventory', () => {
    const errors = validateReceiptItems([item({ id: 0, quantity: '1' }), item({ id: 1, name: 'Algo', quantity: '1' })], 'entrada');
    expect(errors[0]).toEqual([{ field: 'name', kind: 'noName' }]);
    expect(errors[1]).toEqual([{ field: 'name', kind: 'noProduct' }]);
  });

  it('does not accept a blank or zero stock', () => {
    const selected = product(1);
    const errors = validateReceiptItems([item({ id: 0, selected, quantity: '' }), item({ id: 1, selected, quantity: '0' })], 'entrada');
    expect(errors[0]).toEqual([{ field: 'quantity', kind: 'required' }]);
    expect(errors[1]).toEqual([{ field: 'quantity', kind: 'required' }]);
  });

  it('accepts any stock on an entry, even above what is available', () => {
    expect(validateReceiptItems([item({ selected: product(1, 2), quantity: '50' })], 'entrada')[0]).toEqual([]);
  });

  it('on an exit, does not accept more than the stock of the product', () => {
    const errors = validateReceiptItems([item({ id: 0, selected: product(1, 4), quantity: '5' }), item({ id: 1, selected: product(2, 4), quantity: '4' })], 'salida');
    expect(errors[0]).toEqual([{ field: 'quantity', kind: 'exceeds', available: 4 }]);
    expect(errors[1]).toEqual([]);
  });

  it('on an exit, counts together the items that are the same product', () => {
    const selected = product(1, 5);
    const errors = validateReceiptItems([item({ id: 0, selected, quantity: '3' }), item({ id: 1, selected, quantity: '3' })], 'salida');
    expect(errors[0]).toEqual([]);
    expect(errors[1]).toEqual([{ field: 'quantity', kind: 'exceeds', available: 5 }]);
  });
});

describe('buildReceiptPayload', () => {
  it('sends the chosen product and the stock of each item, skipping the ones without a product', () => {
    expect(buildReceiptPayload([item({ selected: product(4), quantity: '3' }), item({ id: 1, quantity: '2' })]))
      .toEqual([{ product_id: 4, quantity: 3 }]);
  });
});
