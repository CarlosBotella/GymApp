export const DAY = 86400000;
export const WEEK = 7 * DAY;

export function uid(len = 16): string {
  const a = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  const r = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) s += a[r[i] % a.length];
  return s;
}

export function code6(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(6));
  let s = '';
  for (let i = 0; i < 6; i++) s += a[r[i] % a.length];
  return s.slice(0, 3) + '-' + s.slice(3);
}

const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });

export function n(v: number | null | undefined, dec: 0 | 1 | 2 = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return (dec === 0 ? nf0 : dec === 2 ? nf2 : nf1).format(v);
}

export function signed(v: number, dec: 0 | 1 | 2 = 1): string {
  const s = n(Math.abs(v), dec);
  return (v > 0 ? '+' : v < 0 ? '−' : '') + s;
}

export function tons(kg: number): string {
  return n(kg / 1000, 1) + ' t';
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DOW_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const DOW_NAME = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function month(ms: number): string {
  return MONTHS[new Date(ms).getMonth()];
}

export function dateShort(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function dateLong(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function todayLabel(ms = Date.now()): string {
  const d = new Date(ms);
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function time(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 0 = lunes … 6 = domingo */
export function dow(ms: number): number {
  return (new Date(ms).getDay() + 6) % 7;
}

export function startOfWeek(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime() - dow(d.getTime()) * DAY;
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function roundTo(v: number, step: number): number {
  if (!step) return Math.round(v);
  return Math.round(v / step) * step;
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function plural(k: number, one: string, many: string): string {
  return `${n(k, 0)} ${k === 1 ? one : many}`;
}

export function download(name: string, data: BlobPart, type: string) {
  const blob = new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

export function cls(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}
