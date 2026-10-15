export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function shortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/** Primer número de un objetivo "8-10" → 8; "30s" → 30; "AMRAP" → null. */
export function targetNumber(reps: string): number | null {
  const m = reps.match(/\d+/);
  return m ? Number(m[0]) : null;
}

export function setsLabel(sets: { reps: string }[]): string {
  return `${sets.length} ${sets.length === 1 ? 'serie' : 'series'}`;
}

export function repsLabel(sets: { reps: string }[]): string {
  return sets.map((s) => s.reps).join('-');
}

export function fmtKg(n: number | null | undefined): string {
  if (n == null) return '–';
  return Number.isInteger(n) ? String(n) : n.toFixed(n * 10 === Math.round(n * 10) ? 1 : 2).replace('.', ',');
}

export function parseNum(s: string): number | null {
  const t = s.replace(',', '.').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const DAY = 86400000;

export function daysAgo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const a = new Date(iso); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

export function relDay(iso: string | null | undefined): string {
  const d = daysAgo(iso);
  if (d == null) return 'Nunca';
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  if (d < 7) return `Hace ${d} días`;
  return new Date(iso!).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtDuration(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Lunes de la semana de una fecha, a las 00:00. */
export function weekStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const wd = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - wd);
  return x;
}

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}
