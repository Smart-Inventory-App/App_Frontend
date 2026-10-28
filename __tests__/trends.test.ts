import {
  averagePerDay, barHeight, changeVsPrevious, DayPoint, formatDayLong, formatDayShort, monthSegments, parseDay, peakIndex, TREND_PERIODS,
} from '../src/utils/trends';

const days = (...quantities: number[]): DayPoint[] =>
  quantities.map((quantity, i) => ({ day: `2026-10-${String(10 + i).padStart(2, '0')}`, quantity }));

describe('TREND_PERIODS', () => {
  it('offers 7, 14, 30 and 90 days', () => {
    expect([...TREND_PERIODS]).toEqual([7, 14, 30, 90]);
  });
});

describe('parseDay and the way a day is written', () => {
  it('reads a date as a local date, without moving to the previous day', () => {
    const date = parseDay('2026-10-22');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 22]);
    expect(parseDay('2026-10-22T23:30:00Z').getDate()).toBe(22);
  });

  it('writes a day with its weekday, capitalized', () => {
    expect(formatDayLong('2026-10-22')).toBe('Jueves 22 de octubre');
  });

  it('writes a short day', () => {
    expect(formatDayShort('2026-10-22')).toMatch(/^22 oct/);
  });
});

describe('peakIndex', () => {
  it('is the day with the most consumption, the first one on a tie', () => {
    expect(peakIndex(days(1, 5, 3, 5))).toBe(1);
  });

  it('is null when nothing was consumed or there are no days', () => {
    expect(peakIndex(days(0, 0, 0))).toBeNull();
    expect(peakIndex([])).toBeNull();
  });
});

describe('averagePerDay', () => {
  it('divides the total by the days of the period with one decimal', () => {
    expect(averagePerDay(10, 4)).toBe(2.5);
    expect(averagePerDay(10, 3)).toBe(3.3);
    expect(averagePerDay(0, 7)).toBe(0);
  });

  it('is zero for a period without days', () => {
    expect(averagePerDay(10, 0)).toBe(0);
  });
});

describe('changeVsPrevious', () => {
  it('says how much more or less was consumed than before, as a whole percentage', () => {
    expect(changeVsPrevious(12, 10)).toEqual({ direction: 'up', percent: 20 });
    expect(changeVsPrevious(5, 10)).toEqual({ direction: 'down', percent: 50 });
    expect(changeVsPrevious(10, 10)).toEqual({ direction: 'same', percent: 0 });
    expect(changeVsPrevious(0, 10)).toEqual({ direction: 'down', percent: 100 });
  });

  it('cannot compare without a previous period or when nothing was consumed in it', () => {
    expect(changeVsPrevious(5, null)).toBeNull();
    expect(changeVsPrevious(5, 0)).toBeNull();
  });
});

describe('monthSegments', () => {
  it('groups the days that follow each other in the same month', () => {
    const list: DayPoint[] = [
      { day: '2026-09-29', quantity: 1 }, { day: '2026-09-30', quantity: 1 },
      { day: '2026-10-01', quantity: 1 }, { day: '2026-10-02', quantity: 1 }, { day: '2026-10-03', quantity: 1 },
    ];
    const segments = monthSegments(list);
    expect(segments.map(s => [s.long, s.short, s.count])).toEqual([['Septiembre', 'Sept', 2], ['Octubre', 'Oct', 3]]);
  });

  it('gives a single segment when the period stays in one month, and none without days', () => {
    expect(monthSegments(days(1, 2, 3))).toHaveLength(1);
    expect(monthSegments([])).toEqual([]);
  });

  it('tells apart the same month of different years', () => {
    const list: DayPoint[] = [{ day: '2025-12-31', quantity: 0 }, { day: '2026-01-01', quantity: 0 }, { day: '2026-12-31', quantity: 0 }];
    expect(monthSegments(list).map(s => s.count)).toEqual([1, 1, 1]);
  });
});

describe('barHeight', () => {
  it('is proportional to the highest day', () => {
    expect(barHeight(10, 10, 120)).toBe(120);
    expect(barHeight(5, 10, 120)).toBe(60);
  });

  it('keeps a small bar for a day without consumption, and never goes under the minimum', () => {
    expect(barHeight(0, 10, 120)).toBe(3);
    expect(barHeight(1, 1000, 120)).toBe(3);
    expect(barHeight(5, 0, 120)).toBe(3);
  });
});
