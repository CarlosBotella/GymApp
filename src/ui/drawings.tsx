import type { Exercise } from '../lib/types';

// Dibujos genéricos de cada tipo de máquina o material (no de un gimnasio concreto).
export function Drawing({ kind, height = 60, marks = false, label }: { kind: Exercise['kind']; height?: number; marks?: boolean; label?: string }) {
  const s = { stroke: 'currentColor', strokeWidth: 2.4, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, vectorEffect: 'non-scaling-stroke' as const };
  const t = { ...s, stroke: 'var(--mute)', strokeWidth: 1.3 };
  const mark = (x: number, y: number, k: number) =>
    marks ? (
      <g key={k}>
        <circle cx={x} cy={y} r="3.6" fill="var(--accent)" />
        <text x={x} y={y + 1.7} textAnchor="middle" fontSize="4.6" fontWeight="600" fill="#fff">
          {k}
        </text>
      </g>
    ) : null;
  let body: React.ReactNode;
  switch (kind) {
    case 'press45':
      body = (
        <>
          <path d="M4 76 H96 M10 76 L16 68 M88 32 L88 76" {...t} />
          <path d="M30 76 L96 26" {...s} strokeWidth={1.6} />
          <path d="M6 42 L19 68 L34 68" {...s} strokeWidth={3} />
          <path d="M57.4 19.2 L71.8 38.4 M71.8 38.4 L74.6 42.2" {...s} strokeWidth={3} />
          <circle cx="79" cy="47" r="7" {...t} strokeWidth={1.6} />
          {mark(5, 58, 1)}
          {mark(51, 15, 2)}
          {mark(92, 58, 3)}
        </>
      );
      break;
    case 'machine':
      body = (
        <>
          <path d="M4 76 H96" {...t} />
          <path d="M20 76 V30 M20 30 H34 M14 54 H40 M40 54 V76" {...s} />
          <path d="M70 76 V12 H86 V76" {...t} strokeWidth={1.6} />
          <path d="M72 30 H84 M72 38 H84 M72 46 H84 M72 54 H84" {...t} />
          <path d="M40 40 H60 M60 40 L66 30" {...s} />
          {mark(27, 24, 1)}
          {mark(52, 34, 2)}
          {mark(78, 64, 3)}
        </>
      );
      break;
    case 'cable':
      body = (
        <>
          <path d="M4 76 H96 M24 76 V8 H76 V76" {...t} strokeWidth={1.6} />
          <path d="M50 8 V44" {...t} />
          <path d="M38 44 H62" {...s} strokeWidth={3} />
          <path d="M30 60 H70 V76" {...s} />
          <circle cx="50" cy="10" r="3" {...t} />
          {mark(50, 22, 1)}
          {mark(66, 44, 2)}
          {mark(76, 64, 3)}
        </>
      );
      break;
    case 'barbell':
      body = (
        <>
          <path d="M4 76 H96" {...t} />
          <path d="M8 40 H92" {...s} strokeWidth={2.4} />
          <rect x="16" y="24" width="8" height="32" {...s} strokeWidth={1.6} />
          <rect x="76" y="24" width="8" height="32" {...s} strokeWidth={1.6} />
          <rect x="26" y="30" width="5" height="20" {...s} strokeWidth={1.6} />
          <rect x="69" y="30" width="5" height="20" {...s} strokeWidth={1.6} />
        </>
      );
      break;
    case 'dumbbell':
      body = (
        <>
          <path d="M4 76 H96" {...t} />
          <path d="M34 40 H66" {...s} strokeWidth={3} />
          <rect x="22" y="28" width="10" height="24" {...s} strokeWidth={1.6} />
          <rect x="68" y="28" width="10" height="24" {...s} strokeWidth={1.6} />
        </>
      );
      break;
    case 'bench':
      body = (
        <>
          <path d="M4 76 H96" {...t} />
          <path d="M14 50 H70 M24 50 V76 M60 50 V76 M70 50 L86 30" {...s} />
          <path d="M30 26 H74" {...s} strokeWidth={2.4} />
          <rect x="22" y="18" width="6" height="16" {...s} strokeWidth={1.4} />
          <rect x="76" y="18" width="6" height="16" {...s} strokeWidth={1.4} />
        </>
      );
      break;
    default:
      body = (
        <>
          <path d="M4 76 H96" {...t} />
          <circle cx="50" cy="20" r="6" {...s} />
          <path d="M50 26 V50 M50 34 L36 44 M50 34 L64 44 M50 50 L40 72 M50 50 L60 72" {...s} />
        </>
      );
  }
  return (
    <svg width="100%" height={height} viewBox="0 0 100 80" preserveAspectRatio="xMidYMid meet" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {body}
    </svg>
  );
}
