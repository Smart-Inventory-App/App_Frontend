// Fechas del historial: siempre hora argentina (UTC-3, sin horario de verano), formato 24 hs "HH:mm:ss DD/MM/AAAA".
const ARGENTINA_OFFSET_MINUTES = -3 * 60;

const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

const pad = (n: number) => String(n).padStart(2, '0');

function parseToUtcMs(value: string): number | null {
  const match = TIMESTAMP.exec(value.trim());
  if (!match) {
    const fallback = new Date(value).getTime();
    return isNaN(fallback) ? null : fallback;
  }
  const [, year, month, day, hour, minute, second, zone] = match;
  const asUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  if (!zone || zone === 'Z') return asUtc; // sin zona: el backend guarda en UTC
  const sign = zone[0] === '-' ? -1 : 1;
  const digits = zone.slice(1).replace(':', '');
  const offsetMinutes = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)));
  return asUtc - offsetMinutes * 60000;
}

export function formatArgentinaDateTime(value: string): string {
  const utcMs = parseToUtcMs(value);
  if (utcMs === null) return value;
  const local = new Date(utcMs + ARGENTINA_OFFSET_MINUTES * 60000);
  const time = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`;
  const date = `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()}`;
  return `${time} ${date}`;
}

// Las notas automáticas del backend mencionan "registro #43"; se muestran con la fecha y hora de ese registro.
export function humanizeEventNote(note: string, events: { id: number; consumed_at: string }[]): string {
  return note.replace(/registro #(\d+)/g, (whole, id) => {
    const target = events.find(e => e.id === Number(id));
    return target ? `registro ${formatArgentinaDateTime(target.consumed_at)}` : whole;
  });
}
