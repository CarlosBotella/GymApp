import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { DAY, DOW_NAME, WEEK, dateLong, dateShort, dow, month, startOfDay, startOfWeek } from '../lib/util';

// Gráficas en SVG, una serie y un eje por gráfica. Todas se pueden tocar (o arrastrar
// el dedo) y una línea encima de la gráfica dice el dato y la fecha del punto tocado.
// Con teclado: Tab hasta la gráfica y flechas izquierda/derecha.

const W = 342;

export function num(v: number, dec = 1): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: dec, minimumFractionDigits: 0 }).format(v);
}

function niceTicks(lo: number, hi: number, count = 4): number[] {
  const span = hi - lo || Math.abs(hi) || 1;
  const raw = span / (count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const steps = [1, 2, 2.5, 5, 10].map((s) => s * mag);
  const step = steps.find((s) => s >= raw * 0.8) || steps[steps.length - 1];
  const a = Math.floor(lo / step) * step;
  const b = Math.ceil(hi / step) * step;
  const out: number[] = [];
  for (let v = a; v <= b + step / 1000; v += step) out.push(+v.toFixed(6));
  return out;
}

function decimalsOf(ticks: number[]): number {
  return ticks.some((t) => Math.abs(t - Math.round(t)) > 1e-6) ? (ticks.some((t) => Math.abs(t * 10 - Math.round(t * 10)) > 1e-6) ? 2 : 1) : 0;
}

/** Línea con el dato tocado (o el último) encima de cada gráfica */
function Readout({ main, sub, hint }: { main: ReactNode; sub: ReactNode; hint?: boolean }) {
  return (
    <div className="readout" aria-live="polite">
      <b>{main}</b>
      <span>{sub}</span>
      {hint && <span className="readout-hint">Toca para ver cada dato</span>}
    </div>
  );
}

function useScrub(count: number, xs: number[], initial: number | null) {
  const [sel, setSel] = useState<number | null>(initial);
  const ref = useRef<SVGSVGElement>(null);
  const down = useRef(false);
  const pick = (clientX: number) => {
    const el = ref.current;
    if (!el || !count) return;
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
    setSel(best);
  };
  const handlers = {
    onPointerDown: (e: PointerEvent<SVGSVGElement>) => {
      down.current = true;
      pick(e.clientX);
    },
    onPointerMove: (e: PointerEvent<SVGSVGElement>) => {
      if (down.current || e.pointerType === 'mouse') pick(e.clientX);
    },
    onPointerUp: () => (down.current = false),
    onPointerCancel: () => (down.current = false),
    onPointerLeave: () => (down.current = false),
    onKeyDown: (e: KeyboardEvent<SVGSVGElement>) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const cur = sel ?? count - 1;
      setSel(Math.max(0, Math.min(count - 1, cur + (e.key === 'ArrowLeft' ? -1 : 1))));
    },
  };
  return { sel, setSel, ref, handlers };
}

function timeLabels(x0: number, x1: number, X: (x: number) => number): { x: number; t: string; anchor: 'start' | 'middle' | 'end' }[] {
  const out: { x: number; t: string; anchor: 'start' | 'middle' | 'end' }[] = [];
  if (x1 - x0 < 40 * DAY) {
    out.push({ x: X(x0), t: dateShort(x0), anchor: 'start' });
    if (x1 > x0) out.push({ x: X(x1), t: dateShort(x1), anchor: 'end' });
    return out;
  }
  const years = x1 - x0 > 330 * DAY;
  const d = new Date(x0);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  const span = x1 - x0;
  const stepMonths = span > 900 * DAY ? 6 : span > 400 * DAY ? 3 : span > 200 * DAY ? 2 : 1;
  let last = -1e9;
  for (let m = 0; m < 80; m++) {
    const t = new Date(d.getFullYear(), d.getMonth() + m, 1).getTime();
    if (t > x1) break;
    const mm = new Date(t).getMonth();
    if (t < x0 || mm % stepMonths !== 0) continue;
    const px = X(t);
    if (px - last < 44 || px > W - 18) continue;
    last = px;
    out.push({ x: px, t: years ? `${month(t)} ${String(new Date(t).getFullYear()).slice(2)}` : month(t), anchor: 'middle' });
  }
  if (!out.length) out.push({ x: X(x0), t: dateShort(x0), anchor: 'start' });
  return out;
}

export interface TPoint {
  x: number;
  y: number;
  /** texto extra del punto, p. ej. «× 8 reps» o «Torso · Día B» */
  detail?: string;
}

/**
 * Evolución en el tiempo: línea con eje, puntos y el último valor marcado.
 * ritmo = línea discontinua del ritmo lineal y un margen gris: si tu línea va dentro, vas lineal.
 * band = rango saludable (Visbody) sombreado.
 */
export function TrendChart({
  points,
  unit,
  dec = 1,
  ritmo = false,
  band,
  height = 190,
  aria,
}: {
  points: TPoint[];
  unit: string;
  dec?: number;
  ritmo?: boolean;
  band?: [number, number] | null;
  height?: number;
  aria: string;
}) {
  const pad = { l: 38, r: 10, t: 10, b: 24 };
  const pts = useMemo(() => [...points].sort((a, b) => a.x - b.x), [points]);
  const g = useMemo(() => {
    if (!pts.length) return null;
    const ys = pts.map((p) => p.y);
    let lo = Math.min(...ys);
    let hi = Math.max(...ys);
    if (band) {
      // el rango solo amplía el eje si está cerca de los datos
      const sp = Math.max(hi - lo, Math.abs(hi) * 0.05);
      if (band[0] > lo - sp) lo = Math.min(lo, band[0]);
      if (band[1] < hi + sp) hi = Math.max(hi, band[1]);
    }
    const spread = hi - lo || Math.max(1, Math.abs(hi) * 0.05);
    const ticks = niceTicks(lo - spread * 0.2, hi + spread * 0.2, 4);
    const y0 = ticks[0];
    const y1 = ticks[ticks.length - 1];
    const x0 = pts[0].x;
    const x1 = pts[pts.length - 1].x;
    const X = (x: number) => (x1 === x0 ? (pad.l + W - pad.r) / 2 : pad.l + ((x - x0) / (x1 - x0)) * (W - pad.l - pad.r));
    const Y = (y: number) => pad.t + ((y1 - y) / (y1 - y0)) * (height - pad.t - pad.b);
    let fit: { a: number; b: number } | null = null;
    if (ritmo && pts.length >= 3 && x1 > x0) {
      const xs = pts.map((p) => (p.x - x0) / DAY);
      const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
      const my = ys.reduce((s, v) => s + v, 0) / ys.length;
      let sxy = 0;
      let sxx = 0;
      xs.forEach((x, i) => {
        sxy += (x - mx) * (ys[i] - my);
        sxx += (x - mx) ** 2;
      });
      const b = sxx ? sxy / sxx : 0;
      fit = { a: my - b * mx, b };
    }
    return { ticks, X, Y, x0, x1, fit, tdec: decimalsOf(ticks) };
  }, [pts, band, ritmo, height, pad.l, pad.r, pad.t, pad.b]);
  const xsPx = useMemo(() => (g ? pts.map((p) => g.X(p.x)) : []), [g, pts]);
  const { sel, ref, handlers } = useScrub(pts.length, xsPx, null);

  if (!g) return <p className="small mute">Sin datos todavía.</p>;
  const { ticks, X, Y, x0, x1, fit, tdec } = g;
  const base = height - pad.b;
  const last = pts[pts.length - 1];
  const shown = sel !== null ? pts[sel] : last;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join('');
  const showDots = pts.length <= 40;
  let ritmoEls: ReactNode = null;
  if (fit) {
    const fy = (x: number) => fit.a + fit.b * ((x - x0) / DAY);
    const m = (v: number) => Math.abs(v) * 0.03;
    const a0 = fy(x0);
    const a1 = fy(x1);
    ritmoEls = (
      <>
        <path d={`M${X(x0)} ${Y(a0 + m(a0))}L${X(x1)} ${Y(a1 + m(a1))}L${X(x1)} ${Y(a1 - m(a1))}L${X(x0)} ${Y(a0 - m(a0))}Z`} fill="var(--band)" />
        <path d={`M${X(x0)} ${Y(a0)}L${X(x1)} ${Y(a1)}`} stroke="var(--mute)" strokeWidth="1.4" strokeDasharray="4 4" fill="none" />
      </>
    );
  }
  const down = pts.length > 1 && last.y < pts[pts.length - 2].y;
  // si el rango saludable cubre toda la gráfica, sombrearla entera no dice nada: se dice con texto
  const bandAll = !!band && band[0] <= ticks[0] && band[1] >= ticks[ticks.length - 1];
  const bandTxt = band ? `${num(band[0], dec)}–${num(band[1], dec)}${unit ? ` ${unit}` : ''}` : '';
  return (
    <figure className="chart">
      <Readout
        main={`${num(shown.y, dec)}${unit ? ` ${unit}` : ''}${shown.detail ? ` ${shown.detail}` : ''}`}
        sub={sel !== null ? dateLong(shown.x) : `${pts.length > 1 ? 'último · ' : ''}${dateLong(shown.x)}`}
        hint={sel === null && pts.length > 1}
      />
      <svg
        ref={ref}
        width="100%"
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label={aria}
        tabIndex={0}
        className="chart-svg"
        {...handlers}
      >
        {band && !bandAll && (
          <rect
            x={pad.l}
            width={W - pad.l - pad.r}
            y={Math.max(pad.t, Y(band[1]))}
            height={Math.max(0, Math.min(base, Y(band[0])) - Math.max(pad.t, Y(band[1])))}
            fill="var(--band)"
          />
        )}
        {ticks.map((t) => (
          <g key={t}>
            <path d={`M${pad.l} ${Y(t)}H${W - pad.r}`} stroke="var(--line)" strokeWidth="1" />
            <text x={pad.l - 8} y={Y(t) + 4} textAnchor="end" fontSize="11" fill="var(--mute)">
              {num(t, tdec)}
            </text>
          </g>
        ))}
        {ritmoEls}
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {showDots && pts.slice(0, -1).map((p, i) => <circle key={i} cx={X(p.x)} cy={Y(p.y)} r="2.6" fill="var(--accent)" stroke="var(--bg)" strokeWidth="1.5" />)}
        <circle cx={X(last.x)} cy={Y(last.y)} r="4.5" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />
        {sel === null && (
          <text x={Math.min(W - pad.r, X(last.x) + 2)} y={down ? Math.min(base - 6, Y(last.y) + 20) : Math.max(12, Y(last.y) - 10)} textAnchor="end" fontSize="12" fontWeight="600" fill="var(--ink)">
            {num(last.y, dec)}
          </text>
        )}
        {sel !== null && (
          <>
            <path d={`M${X(shown.x)} ${pad.t}V${base}`} stroke="var(--ink)" strokeWidth="1" />
            <circle cx={X(shown.x)} cy={Y(shown.y)} r="6" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />
          </>
        )}
        <path d={`M${pad.l} ${base}H${W - pad.r}`} stroke="var(--mute)" strokeWidth="1" />
        {timeLabels(x0, x1, X).map((l, i) => (
          <text key={i} x={l.x} y={height - 6} textAnchor={l.anchor} fontSize="11" fill="var(--mute)">
            {l.t}
          </text>
        ))}
        {/* zona táctil: toda la gráfica */}
        <rect x="0" y="0" width={W} height={height} fill="transparent" />
      </svg>
      {band && (
        <div className="legend">
          {bandAll ? (
            <span>Todo dentro del rango saludable ({bandTxt})</span>
          ) : (
            <span>
              <i style={{ height: 8, background: 'var(--band)' }} />
              Rango saludable {bandTxt}
            </span>
          )}
        </div>
      )}
    </figure>
  );
}

export interface WeekBar {
  start: number;
  volume: number; // kg
  sessions: number;
}

/** Volumen por semana. La semana en curso va punteada; la tocada, en color. */
export function WeekBars({ weeks, aria, height = 180 }: { weeks: WeekBar[]; aria: string; height?: number }) {
  const pad = { l: 38, r: 10, t: 16, b: 24 };
  const thisWeek = startOfWeek(Date.now());
  const lastFull = weeks.map((w) => w.start < thisWeek).lastIndexOf(true);
  const max = Math.max(1000, ...weeks.map((w) => w.volume));
  const ticks = niceTicks(0, (max / 1000) * 1.1, 4).map((t) => t * 1000);
  const top = ticks[ticks.length - 1];
  const slot = (W - pad.l - pad.r) / Math.max(1, weeks.length);
  const bw = Math.max(3, slot - (weeks.length > 30 ? 1 : 4));
  const cx = (i: number) => pad.l + i * slot + slot / 2;
  const Y = (v: number) => pad.t + (1 - v / top) * (height - pad.t - pad.b);
  const base = height - pad.b;
  const xs = weeks.map((_, i) => cx(i));
  const { sel, ref, handlers } = useScrub(weeks.length, xs, null);
  const shownIdx = sel ?? (lastFull >= 0 ? lastFull : weeks.length - 1);
  const shown = weeks[shownIdx];
  if (!weeks.length) return null;
  if (weeks.every((w) => w.volume <= 0)) return <p className="small mute">Sin entrenos en este periodo.</p>;
  const bar = (v: number, i: number) => {
    const x = cx(i) - bw / 2;
    const y = Y(v);
    const r = Math.min(3, bw / 2, base - y);
    return `M${x} ${base}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + bw - r}Q${x + bw} ${y} ${x + bw} ${y + r}V${base}Z`;
  };
  let lastM = -1;
  let lastPx = -1e9;
  const tdec = decimalsOf(ticks.map((t) => t / 1000));
  return (
    <figure className="chart">
      <Readout
        main={`${num(shown.volume / 1000, 1)} t`}
        sub={`${shown.start === thisWeek ? 'esta semana (en curso)' : `semana del ${dateShort(shown.start)}`} · ${shown.sessions} ${shown.sessions === 1 ? 'sesión' : 'sesiones'}`}
        hint={sel === null}
      />
      <svg ref={ref} width="100%" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={aria} tabIndex={0} className="chart-svg" {...handlers}>
        {ticks.map((t) => (
          <g key={t}>
            <path d={`M${pad.l} ${Y(t)}H${W - pad.r}`} stroke="var(--line)" strokeWidth="1" />
            <text x={pad.l - 8} y={Y(t) + 4} textAnchor="end" fontSize="11" fill="var(--mute)">
              {num(t / 1000, tdec)} t
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          if (w.volume <= 0) return null;
          const current = w.start === thisWeek;
          const on = i === shownIdx;
          if (current && !on)
            return <path key={i} d={bar(w.volume, i)} fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeDasharray="3 2" />;
          return <path key={i} d={bar(w.volume, i)} fill={on ? 'var(--accent)' : 'var(--bar)'} />;
        })}
        <path d={`M${pad.l} ${base}H${W - pad.r}`} stroke="var(--mute)" strokeWidth="1" />
        {weeks.map((w, i) => {
          const m = new Date(w.start + 3 * DAY).getMonth();
          if (m === lastM) return null;
          lastM = m;
          const px = cx(i) - slot / 2;
          if (px - lastPx < 36) return null;
          lastPx = px;
          return (
            <text key={i} x={px} y={height - 6} fontSize="11" fill="var(--mute)">
              {month(w.start + 3 * DAY)}
            </text>
          );
        })}
        <rect x="0" y="0" width={W} height={height} fill="transparent" />
      </svg>
    </figure>
  );
}

export interface DaySession {
  at: number;
  name: string;
  /** de la rutina del entrenador (plan) o por tu cuenta (extra) */
  kind: 'plan' | 'extra';
  mins: number;
}

/** Calendario de constancia: una columna por semana, una fila por día. */
export function DayCalendar({ sessions, weeks = 13, aria }: { sessions: DaySession[]; weeks?: number; aria: string }) {
  const today = startOfDay(Date.now());
  const first = startOfWeek(Date.now()) - (weeks - 1) * WEEK;
  const byDay = useMemo(() => {
    const m = new Map<number, DaySession[]>();
    for (const s of sessions) {
      const k = startOfDay(s.at);
      if (k < first) continue;
      m.set(k, [...(m.get(k) || []), s]);
    }
    return m;
  }, [sessions, first]);
  const left = 16;
  const gap = weeks > 20 ? 2 : 3;
  const cell = Math.min(22, Math.floor((W - left) / weeks) - gap);
  const height = 7 * (cell + gap);
  const cells: { day: number; x: number; y: number; w: number; d: number }[] = [];
  for (let w = 0; w < weeks; w++)
    for (let d = 0; d < 7; d++) cells.push({ day: first + w * WEEK + d * DAY, x: left + w * (cell + gap), y: d * (cell + gap), w, d });
  const [sel, setSel] = useState<number | null>(null);
  const shown = sel !== null ? cells[sel] : null;
  const ss = shown ? byDay.get(shown.day) || [] : [];
  const pick = (i: number) => setSel(i);
  const total = Array.from(byDay.values()).reduce((a, v) => a + v.length, 0);
  return (
    <figure className="chart">
      {shown ? (
        <Readout
          main={`${DOW_NAME[dow(shown.day)][0].toUpperCase()}${DOW_NAME[dow(shown.day)].slice(1)} ${dateShort(shown.day)}`}
          sub={shown.day > today ? 'todavía no ha llegado' : ss.length ? ss.map((s) => `${s.name}${s.mins ? ` · ${s.mins} min` : ''}`).join(' · ') : 'descanso'}
        />
      ) : (
        <Readout main={`${total} ${total === 1 ? 'día' : 'días'}`} sub={`entrenados en ${weeks} semanas`} hint />
      )}
      <svg width="100%" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={aria} className="chart-svg">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((t, d) => (
          <text key={t} x={4} y={d * (cell + gap) + cell / 2 + 4} fontSize="10" fill="var(--mute)">
            {t}
          </text>
        ))}
        {cells.map((c, i) => {
          const list = byDay.get(c.day);
          const future = c.day > today;
          const fill = list ? (list.some((s) => s.kind === 'plan') ? 'var(--accent)' : 'var(--ink)') : 'var(--band)';
          return (
            <rect
              key={i}
              x={c.x}
              y={c.y}
              width={cell}
              height={cell}
              rx={Math.min(3, cell / 4)}
              fill={future ? 'none' : fill}
              stroke={sel === i ? 'var(--ink)' : future ? 'var(--line)' : 'none'}
              strokeWidth={sel === i ? 2 : 1}
              onPointerDown={() => pick(i)}
              onPointerEnter={(e) => e.pointerType === 'mouse' && pick(i)}
            />
          );
        })}
      </svg>
    </figure>
  );
}

/** Dónde cae un valor dentro de su rango saludable (Visbody) */
export function RangeBar({ value, min, max, dec = 1 }: { value: number; min: number; max: number; dec?: number }) {
  const span = max - min || 1;
  const lo = Math.min(value, min) - span * 0.6;
  const hi = Math.max(value, max) + span * 0.6;
  const X = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const out = value < min ? 'por debajo' : value > max ? 'por encima' : 'dentro';
  return (
    <svg width="100%" viewBox="0 0 100 18" preserveAspectRatio="none" role="img" aria-label={`${num(value, dec)}, ${out} del rango ${num(min, dec)}–${num(max, dec)}`} style={{ display: 'block', height: 18 }}>
      <rect x="0" y="7" width="100" height="4" rx="2" fill="var(--band)" />
      <rect x={X(min)} y="7" width={X(max) - X(min)} height="4" fill="var(--bar)" />
      <rect x={X(value) - 0.8} y="2" width="1.6" height="14" rx="0.8" fill="var(--accent)" />
    </svg>
  );
}
