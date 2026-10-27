import {
  applyMatchToForm,
  buildSalidaItems,
  draftToProductForm,
  formatWaitSeconds,
  initReceiptLines,
  isLowConfidence,
  isValidIsoDate,
  validateProductForm,
  applySuggestionToForm,
  draftToLabelFields,
  EMPTY_LABEL_FIELDS,
  labelFieldsToForm,
  validateLabelFields,
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

describe('validateProductForm - código de barras', () => {
  const base = { nombre: 'Leche', categoria: 'Lacteos', stock: 1 };

  it('accepts a valid barcode or none at all', () => {
    expect(validateProductForm({ ...base, codigo_barras: '7791234567898' })).toBeNull();
    expect(validateProductForm({ ...base })).toBeNull();
  });

  it('rejects an invalid barcode', () => {
    expect(validateProductForm({ ...base, codigo_barras: '123' })).toBe('codigoBarras');
    expect(validateProductForm({ ...base, codigo_barras: '7791234567899' })).toBe('codigoBarras');
  });
});

describe('applySuggestionToForm', () => {
  const full = {
    id: 9, nombre: 'Yogur Ser', marca: 'Ser', categoria: 'Lacteos', ubicacion: 'Heladera', stock: 4,
    vencimiento: '2027-03-01', stock_minimo: 2, dias_alerta_vencimiento: 5,
    descripcion: 'Natural', imagen_url: 'https://cdn/y.jpg', codigo_barras: '7791234567898',
  };

  it('copies the barcode, minimum stock, anticipation days, description and image, among the rest', () => {
    expect(applySuggestionToForm({}, full)).toEqual({
      nombre: 'Yogur Ser', marca: 'Ser', categoria: 'Lacteos', ubicacion: 'Heladera', vencimiento: '2027-03-01',
      stock_minimo: 2, dias_alerta_vencimiento: 5, descripcion: 'Natural', imagen_url: 'https://cdn/y.jpg',
      codigo_barras: '7791234567898',
    });
  });

  it('never copies the existing stock: in an entry, the typed stock is what gets added', () => {
    expect(applySuggestionToForm({ stock: 12 }, full).stock).toBe(12);
    expect(applySuggestionToForm({}, full).stock).toBeUndefined();
  });

  it('clears what the user had typed when the chosen product does not have that data', () => {
    const sparse = { id: 1, nombre: 'Leche', categoria: 'Lacteos', stock: 1 };
    const form = {
      marca: 'X', ubicacion: 'Alacena', vencimiento: '2026-01-01', stock_minimo: 7, dias_alerta_vencimiento: 3,
      descripcion: 'mía', imagen_url: 'https://cdn/mia.jpg', codigo_barras: '73513537',
    };
    const result = applySuggestionToForm(form, sparse);
    expect(result.nombre).toBe('Leche');
    expect(result.categoria).toBe('Lacteos');
    for (const key of ['marca', 'ubicacion', 'vencimiento', 'stock_minimo', 'dias_alerta_vencimiento', 'descripcion', 'imagen_url', 'codigo_barras']) {
      expect((result as any)[key]).toBeUndefined();
    }
  });

  it('clears the barcode typed before when the product has none, as in the reported case', () => {
    const noBarcode = { ...full, codigo_barras: undefined };
    expect(applySuggestionToForm({ codigo_barras: '73513537', nombre: 'viejo' }, noBarcode).codigo_barras).toBeUndefined();
  });

  it('treats nulls from the backend as missing, clearing the typed value', () => {
    const withNulls: any = { ...full, descripcion: null, imagen_url: null, codigo_barras: null, marca: null };
    const result = applySuggestionToForm({ descripcion: 'mía', marca: 'Z', codigo_barras: '73513537' }, withNulls);
    expect(result.descripcion).toBeUndefined();
    expect(result.marca).toBeUndefined();
    expect(result.codigo_barras).toBeUndefined();
  });
});

describe('draftToLabelFields', () => {
  it('has every field, empty, when nothing was read', () => {
    expect(draftToLabelFields(null)).toEqual(EMPTY_LABEL_FIELDS);
    expect(draftToLabelFields(undefined)).toEqual(EMPTY_LABEL_FIELDS);
    expect(draftToLabelFields({ confianzas: {}, coincidencias: [] })).toEqual(EMPTY_LABEL_FIELDS);
  });

  it('turns what was read into text, with the date as DD/MM/AAAA, and leaves the location to be filled in', () => {
    expect(draftToLabelFields({
      nombre: 'Leche', marca: 'Ser', categoria: 'Lacteos', vencimiento: '2027-03-01', codigo_barras: '7791234567898',
      descripcion: 'Entera', stock: 3, confianzas: {}, coincidencias: [],
    })).toEqual({
      nombre: 'Leche', marca: 'Ser', categoria: 'Lacteos', ubicacion: '', vencimiento: '01/03/2027',
      codigo_barras: '7791234567898', descripcion: 'Entera', stock: '3',
    });
  });
});

describe('validateLabelFields', () => {
  const ok = { ...EMPTY_LABEL_FIELDS, nombre: 'Leche' };

  it('only requires the name', () => {
    expect(validateLabelFields(EMPTY_LABEL_FIELDS)).toBe('nombre');
    expect(validateLabelFields({ ...EMPTY_LABEL_FIELDS, nombre: '   ' })).toBe('nombre');
    expect(validateLabelFields(ok)).toBeNull();
  });

  it('rejects a date that does not exist and a wrong barcode, when they were filled in', () => {
    expect(validateLabelFields({ ...ok, vencimiento: '31/02/2027' })).toBe('vencimiento');
    expect(validateLabelFields({ ...ok, vencimiento: '01/03/2027' })).toBeNull();
    expect(validateLabelFields({ ...ok, codigo_barras: '123' })).toBe('codigoBarras');
    expect(validateLabelFields({ ...ok, codigo_barras: '7791234567898' })).toBeNull();
  });
});

describe('labelFieldsToForm', () => {
  it('only carries the fields that have a value, trimmed, with the date as ISO and the image', () => {
    expect(labelFieldsToForm({
      nombre: ' Leche ', marca: '', categoria: 'Lacteos', ubicacion: 'Heladera', vencimiento: '01/03/2027',
      codigo_barras: '', descripcion: 'Entera', stock: '4',
    }, 'https://img/x.jpg')).toEqual({
      nombre: 'Leche', categoria: 'Lacteos', ubicacion: 'Heladera', vencimiento: '2027-03-01', descripcion: 'Entera',
      stock: 4, imagen_url: 'https://img/x.jpg',
    });
  });

  it('leaves out an empty or zero stock, an incomplete date and a missing image', () => {
    expect(labelFieldsToForm({ ...EMPTY_LABEL_FIELDS, nombre: 'Leche', stock: '0', vencimiento: '01/03' })).toEqual({ nombre: 'Leche' });
    expect(labelFieldsToForm({ ...EMPTY_LABEL_FIELDS, nombre: 'Leche', codigo_barras: ' 7791234567898 ' }).codigo_barras).toBe('7791234567898');
  });
});
