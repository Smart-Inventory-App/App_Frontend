import {
  alertDaysOrDefault,
  checkHourOrDefault,
  formatHour,
  inRange,
  parseWholeNumber,
  stepValue,
} from '../src/utils/profileLimits';

describe('inRange', () => {
  it('accepts whole numbers inside the range, both ends included', () => {
    expect(inRange(2, 2, 90)).toBe(2);
    expect(inRange(90, 2, 90)).toBe(90);
    expect(inRange(15, 2, 90)).toBe(15);
  });

  it('gives null for numbers outside the range, decimals and missing values', () => {
    expect(inRange(1, 2, 90)).toBeNull();
    expect(inRange(91, 2, 90)).toBeNull();
    expect(inRange(2.5, 2, 90)).toBeNull();
    expect(inRange(NaN, 2, 90)).toBeNull();
    expect(inRange(null, 2, 90)).toBeNull();
    expect(inRange(undefined, 2, 90)).toBeNull();
  });
});

describe('alertDaysOrDefault', () => {
  it('keeps the days from 2 to 90', () => {
    expect(alertDaysOrDefault(2)).toBe(2);
    expect(alertDaysOrDefault(90)).toBe(90);
    expect(alertDaysOrDefault(30)).toBe(30);
  });

  it.each([0, 1, 91, 100, -3, NaN])('uses 7 when the days are %s', value => {
    expect(alertDaysOrDefault(value)).toBe(7);
  });

  it('uses 7 when there are no days', () => {
    expect(alertDaysOrDefault(undefined)).toBe(7);
  });
});

describe('checkHourOrDefault', () => {
  it('keeps the hours from 0 to 23', () => {
    expect(checkHourOrDefault(0)).toBe(0);
    expect(checkHourOrDefault(23)).toBe(23);
  });

  it.each([-1, 24, 99, NaN])('uses 5 when the hour is %s', value => {
    expect(checkHourOrDefault(value)).toBe(5);
  });
});

describe('parseWholeNumber', () => {
  it('reads whole numbers', () => {
    expect(parseWholeNumber('7')).toBe(7);
    expect(parseWholeNumber('07')).toBe(7);
    expect(parseWholeNumber(' 12 ')).toBe(12);
  });

  it('gives null for anything else', () => {
    expect(parseWholeNumber('')).toBeNull();
    expect(parseWholeNumber('abc')).toBeNull();
    expect(parseWholeNumber('3.5')).toBeNull();
    expect(parseWholeNumber('-2')).toBeNull();
  });
});

describe('stepValue', () => {
  it('goes up and down one by one', () => {
    expect(stepValue('7', 1, 2, 90)).toBe(8);
    expect(stepValue('7', -1, 2, 90)).toBe(6);
  });

  it('never goes past the ends', () => {
    expect(stepValue('90', 1, 2, 90)).toBe(90);
    expect(stepValue('2', -1, 2, 90)).toBe(2);
    expect(stepValue('0', 1, 0, 23)).toBe(1);
    expect(stepValue('23', 1, 0, 23)).toBe(23);
    expect(stepValue('0', -1, 0, 23)).toBe(0);
  });

  it('brings a number outside the range back in', () => {
    expect(stepValue('99', -1, 2, 90)).toBe(90);
    expect(stepValue('0', 1, 2, 90)).toBe(2);
  });

  it('starts from an end when there is nothing written', () => {
    expect(stepValue('', 1, 2, 90)).toBe(2);
    expect(stepValue('', -1, 2, 90)).toBe(90);
  });
});

describe('formatHour', () => {
  it('writes the hour with two digits and the minutes in zero', () => {
    expect(formatHour(0)).toBe('00:00');
    expect(formatHour(5)).toBe('05:00');
    expect(formatHour(23)).toBe('23:00');
  });
});
