// Números con punto de miles, como se escriben en Argentina: 1255 -> "1.255", 3141912 -> "3.141.912".
export function formatThousands(value: number): string {
  const sign = value < 0 ? '-' : '';
  const digits = String(Math.trunc(Math.abs(value)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
