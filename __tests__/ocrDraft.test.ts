import {
  applyMatchToForm,
  buildSalidaItems,
  draftToProductForm,
  formatWaitSeconds,
  initReceiptLines,
  isLowConfidence,
  isValidIsoDate,
  validateProductForm,
} from '../src/utils/ocrDraft';
import { ProductDraft, ProductMatch } from '../src/types/ocr';

const baseDraft = (overrides: Partial<ProductDraft> = {}): ProductDraft => ({
  confianzas: {},
  coincidencias: [],
  ...overrides,
});

const baseMatch = (overrides: Partial<ProductMatch> = {}): ProductMatch => ({
  id: 1,
  nombre: 'Yogur Ser Frutilla',
  score: 0.9,
  por_codigo: false,
  stock: 3,
  ...overrides,
});

describe('draftToProductForm', () => {
  it('returns an empty object for a null/undefined draft', () => {
    expect(draftToProductForm(null)).toEqual({});
    expect(draftToProductForm(undefined)).toEqual({});
  });

  it('copies every present field from the draft', () => {
    const draft = baseDraft({
      nombre: 'Leche',
      marca: 'La Serenisima',
      categoria: 'Lacteos',
      stock: 2,
      vencimiento: '2026-01-01',
      descripcion: 'Entera',
      codigo_barras: '7791234567890',
    });
    expect(draftToProductForm(draft)).toEqual({
      nombre: 'Leche',
      marca: 'La Serenisima',
      categoria: 'Lacteos',
      stock: 2,
      vencimiento: '2026-01-01',
      descripcion: 'Entera',
      codigo_barras: '7791234567890',
    });
  });

  it('omits fields the OCR did not read', () => {
    const draft = baseDraft({ nombre: 'Yogur' });
    expect(draftToProductForm(draft)).toEqual({ nombre: 'Yogur' });
  });

  it('treats stock 0 as a present value (only null/undefined are skipped)', () => {
    const draft = baseDraft({ stock: 0 });
    expect(draftToProductForm(draft)).toEqual({ stock: 0 });
  });
});

describe('applyMatchToForm', () => {
  it('overwrites nombre and fills empty fields from the match', () => {
    const form = { nombre: 'yog ser frut', stock: 2 };
    const match = baseMatch({ marca: 'Ser', categoria: 'Lacteos', ubicacion: 'Heladera', codigo_barras: '123' });
    expect(applyMatchToForm(form, match)).toEqual({
      nombre: 'Yogur Ser Frutilla',
      stock: 2,
      marca: 'Ser',
      categoria: 'Lacteos',
      ubicacion: 'Heladera',
      codigo_barras: '123',
    });
  });

  it('keeps existing form values when the match does not have them', () => {
    const form = { nombre: 'x', marca: 'MyBrand', categoria: 'Cat', ubicacion: 'Loc' };
    const match = baseMatch({ marca: null, categoria: null, ubicacion: null, codigo_barras: null });
    expect(applyMatchToForm(form, match)).toEqual({
      nombre: 'Yogur Ser Frutilla',
      marca: 'MyBrand',
      categoria: 'Cat',
      ubicacion: 'Loc',
      codigo_barras: undefined,
    });
  });
});

describe('isLowConfidence', () => {
  it('is false when confianzas is undefined', () => {
    expect(isLowConfidence(undefined, 'nombre')).toBe(false);
  });

  it('is false when the field is not present', () => {
    expect(isLowConfidence({ marca: 0.2 }, 'nombre')).toBe(false);
  });

  it('is true below the confidence threshold', () => {
    expect(isLowConfidence({ nombre: 0.5 }, 'nombre')).toBe(true);
  });

  it('is false at or above the confidence threshold', () => {
    expect(isLowConfidence({ nombre: 0.85 }, 'nombre')).toBe(false);
    expect(isLowConfidence({ nombre: 0.99 }, 'nombre')).toBe(false);
  });
});

describe('isValidIsoDate', () => {
  it('accepts a well-formed ISO date', () => {
    expect(isValidIsoDate('2026-12-31')).toBe(true);
  });

  it('rejects a malformed date string', () => {
    expect(isValidIsoDate('31/12/2026')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });
});

describe('validateProductForm', () => {
  it('requires nombre', () => {
    expect(validateProductForm({})).toBe('nombre');
    expect(validateProductForm({ nombre: '   ' })).toBe('nombre');
  });

  it('requires categoria', () => {
    expect(validateProductForm({ nombre: 'x' })).toBe('categoria');
  });

  it('requires a positive stock', () => {
    expect(validateProductForm({ nombre: 'x', categoria: 'y' })).toBe('stock');
    expect(validateProductForm({ nombre: 'x', categoria: 'y', stock: 0 })).toBe('stock');
    expect(validateProductForm({ nombre: 'x', categoria: 'y', stock: NaN })).toBe('stock');
  });

  it('rejects an invalid vencimiento', () => {
    expect(validateProductForm({ nombre: 'x', categoria: 'y', stock: 1, vencimiento: 'nope' })).toBe('vencimiento');
  });

  it('passes with a complete, valid form', () => {
    expect(validateProductForm({ nombre: 'x', categoria: 'y', stock: 1 })).toBeNull();
    expect(validateProductForm({ nombre: 'x', categoria: 'y', stock: 1, vencimiento: '2026-01-01' })).toBeNull();
  });
});

describe('formatWaitSeconds', () => {
  it('returns an empty string for null/undefined', () => {
    expect(formatWaitSeconds(null)).toBe('');
    expect(formatWaitSeconds(undefined)).toBe('');
  });

  it('formats seconds under a minute as seconds', () => {
    expect(formatWaitSeconds(45)).toBe('45 s');
  });

  it('formats a minute or more as rounded minutes', () => {
    expect(formatWaitSeconds(90)).toBe('2 min');
    expect(formatWaitSeconds(120)).toBe('2 min');
  });
});

describe('initReceiptLines', () => {
  it('preselects the confident match and defaults quantity to the read stock', () => {
    const items = [baseDraft({ nombre: 'Yogur', stock: 3, coincidencia_id: 5 })];
    expect(initReceiptLines(items)).toEqual([{ draft: items[0], productId: 5, quantity: 3 }]);
  });

  it('falls back to quantity 1 and no product when nothing matched', () => {
    const items = [baseDraft({ nombre: 'Yogur', stock: null })];
    expect(initReceiptLines(items)).toEqual([{ draft: items[0], productId: null, quantity: 1 }]);
  });

  it('does not use a non-positive stock as the quantity', () => {
    const items = [baseDraft({ stock: 0 })];
    expect(initReceiptLines(items)[0].quantity).toBe(1);
  });
});

describe('buildSalidaItems', () => {
  it('only includes lines with a selected product and a positive quantity', () => {
    const lines = [
      { draft: baseDraft(), productId: 1, quantity: 2 },
      { draft: baseDraft(), productId: null, quantity: 1 },
      { draft: baseDraft(), productId: 3, quantity: 0 },
    ];
    expect(buildSalidaItems(lines)).toEqual([{ product_id: 1, quantity: 2 }]);
  });

  it('returns an empty array when nothing qualifies', () => {
    expect(buildSalidaItems([])).toEqual([]);
  });
});
