import { displayToIso, formatDateDigits, isoToDisplay, toIsoDate } from '../src/utils/dateInput';

describe('formatDateDigits', () => {
  it('adds the slashes as digits are typed', () => {
    expect(formatDateDigits('1')).toBe('1');
    expect(formatDateDigits('12')).toBe('12');
    expect(formatDateDigits('123')).toBe('12/3');
    expect(formatDateDigits('1234')).toBe('12/34');
    expect(formatDateDigits('12345')).toBe('12/34/5');
    expect(formatDateDigits('12342026')).toBe('12/34/2026');
  });

  it('ignores non-digits and extra digits', () => {
    expect(formatDateDigits('a1b2/3')).toBe('12/3');
    expect(formatDateDigits('1234567890')).toBe('12/34/5678');
    expect(formatDateDigits('')).toBe('');
  });

  it('keeps the text stable when a slash is deleted with backspace', () => {
    expect(formatDateDigits('12/')).toBe('12');
    expect(formatDateDigits('12/03/')).toBe('12/03');
  });
});

describe('displayToIso', () => {
  it('converts a complete real date to ISO', () => {
    expect(displayToIso('31/12/2026')).toBe('2026-12-31');
    expect(displayToIso('29/02/2028')).toBe('2028-02-29');
  });

  it('rejects incomplete or impossible dates', () => {
    expect(displayToIso('')).toBeNull();
    expect(displayToIso('12/0')).toBeNull();
    expect(displayToIso('31/02/2026')).toBeNull();
    expect(displayToIso('29/02/2027')).toBeNull();
    expect(displayToIso('00/10/2026')).toBeNull();
    expect(displayToIso('10/13/2026')).toBeNull();
  });
});

describe('isoToDisplay', () => {
  it('converts ISO to DD/MM/AAAA', () => {
    expect(isoToDisplay('2026-05-01')).toBe('01/05/2026');
  });

  it('returns empty text for no value and passes through anything else', () => {
    expect(isoToDisplay(undefined)).toBe('');
    expect(isoToDisplay(null)).toBe('');
    expect(isoToDisplay('12/0')).toBe('12/0');
  });
});

describe('toIsoDate', () => {
  it('pads month and day', () => {
    expect(toIsoDate(2026, 3, 7)).toBe('2026-03-07');
    expect(toIsoDate(2026, 12, 31)).toBe('2026-12-31');
  });
});
