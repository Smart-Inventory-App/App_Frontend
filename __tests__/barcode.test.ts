import { describeBarcodeLengths, isValidBarcode, onlyDigits } from '../src/utils/barcode';

describe('isValidBarcode', () => {
  it('accepts every length the backend accepts', () => {
    expect(isValidBarcode('73513537')).toBe(true); // EAN-8
    expect(isValidBarcode('036000291452')).toBe(true); // UPC-A
    expect(isValidBarcode('7791234567898')).toBe(true); // EAN-13 (prefijo argentino 779)
    expect(isValidBarcode('17791234567895')).toBe(true); // GTIN-14
  });

  it('rejects lengths that are not a barcode length', () => {
    expect(isValidBarcode('7791234')).toBe(false);
    expect(isValidBarcode('77912345678')).toBe(false);
    expect(isValidBarcode('779123456789012')).toBe(false);
  });

  it('does not require the check digit to close', () => {
    expect(isValidBarcode('2800283327676')).toBe(true);
    expect(isValidBarcode('2800283327677')).toBe(true);
    expect(isValidBarcode('7791234567899')).toBe(true);
    expect(isValidBarcode('73513538')).toBe(true);
    expect(isValidBarcode('779123456780')).toBe(true);
  });

  it('rejects anything that is not only digits', () => {
    expect(isValidBarcode('779123456789a')).toBe(false);
    expect(isValidBarcode('779-123456789')).toBe(false);
    expect(isValidBarcode('')).toBe(false);
  });
});

describe('onlyDigits', () => {
  it('keeps only the digits', () => {
    expect(onlyDigits('77a9-12 3')).toBe('779123');
    expect(onlyDigits('abc')).toBe('');
  });
});

describe('describeBarcodeLengths', () => {
  it('lists every accepted length, joined with the given word', () => {
    expect(describeBarcodeLengths('o')).toBe('8, 12, 13 o 14');
    expect(describeBarcodeLengths('or')).toBe('8, 12, 13 or 14');
  });

  it('handles short lists', () => {
    expect(describeBarcodeLengths('o', [13])).toBe('13');
    expect(describeBarcodeLengths('o', [8, 13])).toBe('8 o 13');
  });
});
