import { formatArgentinaDateTime, humanizeEventNote } from '../src/utils/datetime';

describe('formatArgentinaDateTime', () => {
  it('shows the time first and then the date, in 24-hour Argentine time', () => {
    // 17:43:23 en Argentina = 20:43:23 UTC
    expect(formatArgentinaDateTime('2026-10-10T20:43:23.962872+00:00')).toBe('17:43:23 10/10/2026');
    expect(formatArgentinaDateTime('2026-10-10T20:43:23Z')).toBe('17:43:23 10/10/2026');
  });

  it('uses 24 hours, never AM/PM', () => {
    expect(formatArgentinaDateTime('2026-10-10T08:05:09+00:00')).toBe('05:05:09 10/10/2026');
    expect(formatArgentinaDateTime('2026-10-10T23:59:59+00:00')).toBe('20:59:59 10/10/2026');
  });

  it('moves to the previous day when UTC is early in the morning', () => {
    expect(formatArgentinaDateTime('2026-01-01T01:30:00+00:00')).toBe('22:30:00 31/12/2025');
    expect(formatArgentinaDateTime('2026-03-01T02:59:59+00:00')).toBe('23:59:59 28/02/2026');
  });

  it('treats a timestamp without a zone as UTC', () => {
    expect(formatArgentinaDateTime('2026-10-10T20:43:23')).toBe('17:43:23 10/10/2026');
    expect(formatArgentinaDateTime('2026-10-10 20:43:23')).toBe('17:43:23 10/10/2026');
  });

  it('honours other explicit offsets', () => {
    expect(formatArgentinaDateTime('2026-10-10T17:43:23-03:00')).toBe('17:43:23 10/10/2026');
    expect(formatArgentinaDateTime('2026-10-10T22:43:23+02:00')).toBe('17:43:23 10/10/2026');
    expect(formatArgentinaDateTime('2026-10-10T17:43:23-0300')).toBe('17:43:23 10/10/2026');
  });

  it('falls back to Date parsing for other formats and to the raw text when unparseable', () => {
    expect(formatArgentinaDateTime('Sat, 10 Oct 2026 20:43:23 GMT')).toBe('17:43:23 10/10/2026');
    expect(formatArgentinaDateTime('no es una fecha')).toBe('no es una fecha');
  });
});

describe('humanizeEventNote', () => {
  const events = [
    { id: 43, consumed_at: '2026-10-10T20:43:23+00:00' },
    { id: 44, consumed_at: '2026-10-10T21:00:00+00:00' },
  ];

  it('replaces the record number with the time and date of that record', () => {
    expect(humanizeEventNote('Deshecho: revierte el registro #43', events)).toBe('Deshecho: revierte el registro 17:43:23 10/10/2026');
    expect(humanizeEventNote('Corrección: revierte el registro #44', events)).toBe('Corrección: revierte el registro 18:00:00 10/10/2026');
    expect(humanizeEventNote('Corrige el registro #43 (antes: 5 consumed)', events)).toBe('Corrige el registro 17:43:23 10/10/2026 (antes: 5 consumed)');
  });

  it('leaves the text alone when the record is unknown or there is no reference', () => {
    expect(humanizeEventNote('Deshecho: revierte el registro #99', events)).toBe('Deshecho: revierte el registro #99');
    expect(humanizeEventNote('compré de más', events)).toBe('compré de más');
  });
});
