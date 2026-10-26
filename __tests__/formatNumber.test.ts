import { formatThousands } from '../src/utils/formatNumber';

describe('formatThousands', () => {
  it('puts a dot every three digits', () => {
    expect(formatThousands(35267)).toBe('35.267');
    expect(formatThousands(1345)).toBe('1.345');
    expect(formatThousands(4564322)).toBe('4.564.322');
    expect(formatThousands(1000)).toBe('1.000');
    expect(formatThousands(1234567890)).toBe('1.234.567.890');
  });

  it('leaves numbers under a thousand as they are', () => {
    expect(formatThousands(0)).toBe('0');
    expect(formatThousands(7)).toBe('7');
    expect(formatThousands(999)).toBe('999');
  });

  it('keeps the minus sign of negative numbers', () => {
    expect(formatThousands(-1500)).toBe('-1.500');
    expect(formatThousands(-5)).toBe('-5');
  });

  it('drops the decimals instead of rounding them up', () => {
    expect(formatThousands(1234.99)).toBe('1.234');
    expect(formatThousands(-0.4)).toBe('0');
  });
});
