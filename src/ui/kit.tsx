import { useEffect, useState, type ReactNode } from 'react';
import { DAY_GROUP_NAMES } from '../data/catalog';
import type { LearnedWeek } from '../lib/stats';
import { href } from '../lib/router';
import { DOW_SHORT, cls, dow } from '../lib/util';
import { IcBack, IcChart, IcChev, IcDumbbell, IcList, IcPeople, IcToday } from './icons';

export function TopBar({ back, backLabel = 'Atrás', right }: { back?: string; backLabel?: string; right?: ReactNode }) {
  return (
    <div className="topbar">
      {back ? (
        <a className="txt" href={href(back)}>
          <IcBack />
          {backLabel}
        </a>
      ) : (
        <span />
      )}
      {right}
    </div>
  );
}

export function Sec({ title, right, style }: { title: ReactNode; right?: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="sec" style={style}>
      <span className="kicker">{title}</span>
      {right !== undefined && <span>{right}</span>}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)} />;
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, t]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {t}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="grip" />
        {children}
      </section>
    </>
  );
}

export function LinkRow({ to, title, sub, right, className }: { to: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <a className={cls('row', className)} href={href(to)}>
      <span className="col">
        <span className="t">{title}</span>
        {sub && <span className="s">{sub}</span>}
      </span>
      {right ?? <IcChev className="chev" />}
    </a>
  );
}

export function ClientNav({ active, compact }: { active: 'hoy' | 'rutinas' | 'progreso'; compact?: boolean }) {
  const items: [string, string, string, ReactNode][] = [
    ['hoy', '/hoy', 'Hoy', <IcToday key="i" />],
    ['rutinas', '/rutinas', 'Rutina', <IcList key="i" />],
    ['progreso', '/progreso', 'Progreso', <IcChart key="i" />],
  ];
  return (
    <nav className={cls('nav', compact && 'compact')} aria-label="Navegación principal">
      <div className="in">
        {items.map(([k, to, label, icon]) => (
          <a key={k} href={href(to)} aria-current={active === k ? 'page' : undefined} aria-label={label}>
            {icon}
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function TrainerNav({ active }: { active: 'clientes' | 'rutinas' | 'ejercicios' }) {
  const items: [string, string, string, ReactNode][] = [
    ['clientes', '/clientes', 'Clientes', <IcPeople key="i" />],
    ['rutinas', '/biblioteca', 'Rutinas', <IcList key="i" />],
    ['ejercicios', '/ejercicios', 'Ejercicios', <IcDumbbell key="i" />],
  ];
  return (
    <nav className="nav" aria-label="Navegación del entrenador">
      <div className="in">
        {items.map(([k, to, label, icon]) => (
          <a key={k} href={href(to)} aria-current={active === k ? 'page' : undefined}>
            {icon}
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function WeekStrip({ learned, extra, compact }: { learned: LearnedWeek; extra?: Record<number, string>; compact?: boolean }) {
  const today = dow(Date.now());
  return (
    <div className="week" role="list" aria-label="Grupo muscular de cada día">
      {learned.days.map((d, i) => {
        const label = d.group ? DAY_GROUP_NAMES[d.group] : extra?.[i] || null;
        return (
          <div key={i} role="listitem" className={label ? 'on' : ''} style={compact ? { paddingBottom: 8, gap: 4 } : undefined}>
            <span className="d" style={i === today ? { color: 'var(--accent-text)', fontWeight: 600 } : undefined}>
              {DOW_SHORT[i]}
              {i === today && !compact ? ' · hoy' : ''}
            </span>
            <span className={cls('g', !label && 'none')}>{label || '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="screen">
      <div className="main" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <span className="mute small">{label}</span>
      </div>
    </div>
  );
}

let toastSet: ((s: string | null) => void) | null = null;
export function toast(msg: string) {
  toastSet?.(msg);
}
export function ToastHost() {
  const [m, setM] = useState<string | null>(null);
  useEffect(() => {
    toastSet = setM;
    return () => {
      toastSet = null;
    };
  }, []);
  useEffect(() => {
    if (!m) return;
    const t = setTimeout(() => setM(null), 2600);
    return () => clearTimeout(t);
  }, [m]);
  return m ? (
    <div className="toast" role="status">
      {m}
    </div>
  ) : null;
}

export function Stepper({ value, onChange, step, label, unit, big }: { value: number; onChange: (v: number) => void; step: number; label: string; unit?: string; big?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button type="button" className="icon-btn" style={{ borderRadius: 0 }} aria-label={`Bajar ${label}`} onClick={() => onChange(Math.max(0, +(value - step).toFixed(2)))}>
        −
      </button>
      <span style={{ minWidth: big ? 88 : 56, textAlign: 'center', fontSize: big ? 28 : 20, fontWeight: 500 }}>
        {String(value).replace('.', ',')}
        {unit && <span className="small mute"> {unit}</span>}
      </span>
      <button type="button" className="icon-btn" style={{ borderRadius: 0 }} aria-label={`Subir ${label}`} onClick={() => onChange(+(value + step).toFixed(2))}>
        +
      </button>
    </div>
  );
}
