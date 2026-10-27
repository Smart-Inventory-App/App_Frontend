// Mismo criterio que el backend (app_backend/app/core/barcode.py): solo números y de 8, 12, 13 o 14 dígitos
// (EAN-8, UPC-A, EAN-13 y GTIN-14). No se exige que cierre el dígito verificador. Si cambia allá, tiene que cambiar acá.
export const BARCODE_VALID_LENGTHS = [8, 12, 13, 14];
export const BARCODE_MAX_DIGITS = 14;

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidBarcode(value: string): boolean {
  return /^\d+$/.test(value) && BARCODE_VALID_LENGTHS.includes(value.length);
}

// "8, 12, 13 o 14": todos los largos que acepta, con la palabra de unión del idioma.
export function describeBarcodeLengths(joiner: string, lengths: number[] = BARCODE_VALID_LENGTHS): string {
  if (lengths.length <= 1) return lengths.join('');
  return `${lengths.slice(0, -1).join(', ')} ${joiner} ${lengths[lengths.length - 1]}`;
}
