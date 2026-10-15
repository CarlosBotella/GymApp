import { useMemo, useRef, useState } from 'react';
import { fmtKg } from '../lib/util';

export interface Point {
  date: string;
  value: number;
}

const W = 340;
const H = 180;
const PAD = { l: 34, r: 12, t: 14, b: 24 };

function niceTicks(min: number, max: number, count = 3): number[] {
  if (min === max) return [min];
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / count)));
  const err = span / count / step;
  const nice = step * (err >= 5 ? 10 : err >= 2 ? 5 : err >= 1.5 ? 2 : 1);
  const out: number[] = [];
  for (let v = Math.ceil(min / nice) * nice; v <= max + 1e-9; v += nice) out.push(Math.round(v * 100) / 100);
  return out;
}

/** Una sola serie: el título de la sección dice qué es, así que no lleva leyenda. */
export function LineChart({ points, unit = 'kg', label }: { points: Point[]; unit?: string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);

  const geo = useMemo(() => {
    const vals = points.map((p) => p.value);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (lo === hi) { lo -= 5; hi += 5; }
    const padV = (hi - lo) * 0.12;
    lo = Math.max(0, lo - padV);
    hi = hi + padV;
    const iw = W - PAD.l - PAD.r;
    const ih = H - PAD.t - PAD.b;
    const x = (i: number) => PAD.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
    const y = (v: number) => PAD.t + ih - ((v - lo) / (hi - lo)) * ih;
    return { x, y, ticks: niceTicks(lo, hi), lo, hi };
  }, [points]);

  if (!points.length) return null;

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${geo.x(i).toFixed(1)},${geo.y(p.value).toFixed(1)}`).join(' ');
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  function onMove(clientX: number) {
    const svg = ref.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * W;
    let best = 0;
    let bd = Infinity;
    points.forEach((_, i) => {
      const dd = Math.abs(geo.x(i) - sx);
      if (dd < bd) { bd = dd; best = i; }
    });
    setHover(best);
  }

  const h = hover != null ? points[hover] : null;
  const hx = hover != null ? geo.x(hover) : 0;
  const tipW = 104;
  const tipX = Math.min(Math.max(hx - tipW / 2, PAD.l), W - PAD.r - tipW);

  return (
    <svg
      ref={ref}
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${label}: ${points.map((p) => `${fmtDate(p.date)} ${fmtKg(p.value)} ${unit}`).join(', ')}`}
      onPointerMove={(e) => onMove(e.clientX)}
      onPointerDown={(e) => onMove(e.clientX)}
      onPointerLeave={() => setHover(null)}
    >
      {geo.ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--line)" strokeWidth={1} />
          <text x={PAD.l - 6} y={geo.y(t) + 4} textAnchor="end">{fmtKg(t)}</text>
        </g>
      ))}
      <text x={PAD.l} y={H - 6}>{fmtDate(points[0].date)}</text>
      {points.length > 1 && <text x={W - PAD.r} y={H - 6} textAnchor="end">{fmtDate(points[points.length - 1].date)}</text>}
      <path d={d} fill="none" stroke="var(--plate)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={geo.x(i)} cy={geo.y(p.value)} r={hover === i ? 5 : 3.5} fill="var(--plate)" stroke="var(--bg)" strokeWidth={2} />
      ))}
      {h && (
        <g pointerEvents="none">
          <line x1={hx} x2={hx} y1={PAD.t} y2={H - PAD.b} stroke="var(--ink-2)" strokeDasharray="3 3" strokeWidth={1} />
          <rect x={tipX} y={2} width={tipW} height={36} rx={8} fill="var(--surface-2)" stroke="var(--line)" />
          <text x={tipX + 10} y={17} style={{ fill: 'var(--ink)', fontWeight: 600, fontSize: 13 }}>{fmtKg(h.value)} {unit}</text>
          <text x={tipX + 10} y={31}>{fmtDate(h.date)}</text>
        </g>
      )}
    </svg>
  );
}
