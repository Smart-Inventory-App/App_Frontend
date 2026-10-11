// Mismo criterio que el backend (app_backend/app/core/barcode.py): EAN-8, UPC-A, EAN-13 y GTIN-14,
// con dígito verificador GS1. Si cambia allá, tiene que cambiar acá.
export const BARCODE_VALID_LENGTHS = [8, 12, 13, 14];
export const BARCODE_MAX_DIGITS = 14;

function checkDigit(body: string): number {
  const total = body
    .split('')
    .reverse()
    .reduce((sum, digit, i) => sum + Number(digit) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (total % 10)) % 10;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidBarcode(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  if (!BARCODE_VALID_LENGTHS.includes(value.length)) return false;
  return checkDigit(value.slice(0, -1)) === Number(value[value.length - 1]);
}

// "8, 12, 13 o 14": todos los largos que acepta, con la palabra de unión del idioma.
export function describeBarcodeLengths(joiner: string, lengths: number[] = BARCODE_VALID_LENGTHS): string {
  if (lengths.length <= 1) return lengths.join('');
  return `${lengths.slice(0, -1).join(', ')} ${joiner} ${lengths[lengths.length - 1]}`;
}
