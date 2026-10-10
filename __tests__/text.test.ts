import { truncateLabel } from '../src/utils/text';

describe('truncateLabel', () => {
  it('leaves short or exactly-max texts untouched', () => {
    expect(truncateLabel('Lácteos')).toBe('Lácteos');
    expect(truncateLabel('12345678901234567890')).toBe('12345678901234567890');
  });

  it('keeps the first 20 characters and adds "..." when longer', () => {
    expect(truncateLabel('123456789012345678901')).toBe('12345678901234567890...');
    expect(truncateLabel('Supermercado Mayorista Central')).toBe('Supermercado Mayoris...');
  });

  it('accepts a custom limit', () => {
    expect(truncateLabel('abcdef', 3)).toBe('abc...');
  });
});
