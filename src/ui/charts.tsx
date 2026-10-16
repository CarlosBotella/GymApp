import { n } from '../lib/util';

// Gráficas en SVG: una serie y un eje por gráfica, en el color de acento.

export interface Pt {
  x: number;
  y: number;
}

export function LineChart({
  points,
  height = 110,
  width = 342,
  linear = false,
  stallFrom,
  labels,
  unitLabel,
  aria,
}: {
  points: Pt[];
  height?: number;
  width?: number;
  linear?: boolean;
  stallFrom?: number;
  labels?: [string, string, string];
  unitLabel?: (v: number) => string;
  aria: string;
}) {
  if (points.length === 0) return <p className="small mute">Sin datos todavía.</p>;
  const pad = { l: 8, r: 8, t: 18, b: 20 };
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const spread = max - min;
  min -= spread * 0.12;
  max += spread * 0.18;
  const x0 = points[0].x;
  const x1 = points[points.length - 1].x === x0 ? x0 + 1 : points[points.length - 1].x;
  const X = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * (width - pad.l - pad.r);
  const Y = (y: number) => pad.t + (1 - (y - min) / (max - min)) * (height - pad.t - pad.b);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join('');
  const last = points[points.length - 1];
  const first = points[0];
  const base = height - pad.b;
  const showDots = points.length <= 6;
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={aria} style={{ display: 'block' }}>
      {stallFrom !== undefined && stallFrom > x0 && (
        <>
          <rect x={X(stallFrom)} y={pad.t - 2} width={Math.max(0, X(last.x) - X(stallFrom))} height={base - pad.t + 2} fill="var(--band)" />
          <text x={(X(stallFrom) + X(last.x)) / 2} y={base - 8} textAnchor="middle" fontSize="11" fill="var(--mute)">
            estancado
          </text>
        </>
      )}
      <path d={`M0 ${base}H${width}`} stroke="var(--line)" strokeWidth="1" />
      {linear && points.length > 1 && <path d={`M${X(first.x)} ${Y(first.y)}L${X(last.x)} ${Y(last.y)}`} stroke="var(--mute)" strokeWidth="1.2" strokeDasharray="4 4" fill="none" />}
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {showDots && points.slice(0, -1).map((p, i) => <circle key={i} cx={X(p.x)} cy={Y(p.y)} r="3.5" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />)}
      <circle cx={X(last.x)} cy={Y(last.y)} r="4.5" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />
      <text x={Math.min(width - 2, X(last.x))} y={Math.max(12, Y(last.y) - 9)} textAnchor="end" fontSize="12" fontWeight="600" fill="var(--ink)">
        {unitLabel ? unitLabel(last.y) : n(last.y)}
      </text>
      {labels && (
        <>
          <text x={pad.l} y={height - 4} fontSize="11" fill="var(--mute)">
            {labels[0]}
          </text>
          <text x={width / 2} y={height - 4} textAnchor="middle" fontSize="11" fill="var(--mute)">
            {labels[1]}
          </text>
          <text x={width - pad.r} y={height - 4} textAnchor="end" fontSize="11" fill="var(--mute)">
            {labels[2]}
          </text>
        </>
      )}
    </svg>
  );
}

export function Bars({ values, labels, aria, axis }: { values: number[]; labels: (string | null)[]; aria: string; axis?: boolean }) {
  const W = 600;
  const H = 150;
  const base = 130;
  const max = Math.max(1, ...values) * 1.08;
  const bw = W / values.length;
  const w = Math.max(4, bw * 0.8);
  const top = (v: number) => base - (v / max) * 115;
  const path = (v: number, i: number) => {
    const x = i * bw + (bw - w) / 2;
    const y = top(v);
    const r = Math.min(4, w / 2, base - y);
    return `M${x} ${base}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${base}Z`;
  };
  const lastIdx = values.length - 1;
  const grid = axis ? [0.25, 0.5, 0.75].map((k) => Math.round((max * k) / 1000) * 1000).filter((v, i, a) => v > 0 && a.indexOf(v) === i) : [];
  return (
    <svg width="100%" viewBox={`${axis ? -44 : 0} 0 ${W + (axis ? 44 : 0)} ${H + 10}`} role="img" aria-label={aria} style={{ display: 'block' }}>
      {grid.map((g) => (
        <g key={g}>
          <path d={`M0 ${top(g)}H${W}`} stroke="var(--line)" strokeWidth="1" />
          <text x={-10} y={top(g) + 4} textAnchor="end" fontSize="12" fill="var(--mute)">
            {n(g / 1000, 0)} t
          </text>
        </g>
      ))}
      {values.map((v, i) => (v > 0 ? <path key={i} d={path(v, i)} fill={i === lastIdx ? 'var(--accent)' : 'var(--bar)'} /> : null))}
      <path d={`M0 ${base}H${W}`} stroke="var(--mute)" strokeWidth="1" />
      {values[lastIdx] > 0 && (
        <text x={lastIdx * bw + bw / 2} y={Math.max(11, top(values[lastIdx]) - 6)} textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink)">
          {n(values[lastIdx] / 1000, 1)}
        </text>
      )}
      {labels.map((l, i) =>
        l ? (
          <text key={i} x={i * bw + bw / 2} y={H + 6} textAnchor="middle" fontSize="15" fill="var(--mute)">
            {l}
          </text>
        ) : null,
      )}
    </svg>
  );
}
