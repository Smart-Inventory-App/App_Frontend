import { formatThousands } from '../src/utils/numbers';

describe('formatThousands', () => {
  it('leaves numbers under a thousand as they are', () => {
    expect(formatThousands(0)).toBe('0');
    expect(formatThousands(7)).toBe('7');
    expect(formatThousands(999)).toBe('999');
  });

  it('puts a dot every three digits from a thousand on', () => {
    expect(formatThousands(1000)).toBe('1.000');
    expect(formatThousands(1255)).toBe('1.255');
    expect(formatThousands(12345)).toBe('12.345');
    expect(formatThousands(123456)).toBe('123.456');
  });

  it('does it for millions too', () => {
    expect(formatThousands(1000000)).toBe('1.000.000');
    expect(formatThousands(3141912)).toBe('3.141.912');
    expect(formatThousands(1234567890)).toBe('1.234.567.890');
  });

  it('keeps the sign of a negative number and drops any decimals', () => {
    expect(formatThousands(-1255)).toBe('-1.255');
    expect(formatThousands(-5)).toBe('-5');
    expect(formatThousands(1255.9)).toBe('1.255');
  });
});
