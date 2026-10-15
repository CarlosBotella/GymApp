import { useEffect, type ReactNode } from 'react';
import { back, Link, useLocation } from '../lib/router';
import { getEquipment, getExercise } from '../data/catalog';
import { EquipmentGlyph, IconBack, IconChart, IconMachine, IconRoutine, IconToday, IconUser, IconUsers } from './icons';
import type { Role } from '../lib/types';

export function TopBar({ title, backTo, right }: { title?: string; backTo?: string | false; right?: ReactNode }) {
  return (
    <div className="topbar">
      {backTo !== false ? (
        <button className="icon-btn" aria-label="Volver" onClick={() => back(backTo || '/')}>
          <IconBack />
        </button>
      ) : <span style={{ width: 8 }} />}
      <div className="title">{title}</div>
      {right}
    </div>
  );
}

export function TabBar({ role }: { role: Role }) {
  const { path } = useLocation();
  const tabs = role === 'trainer'
    ? [
        { to: '/', label: 'Clientes', icon: <IconUsers />, on: path === '/' || path.startsWith('/client') },
        { to: '/catalog', label: 'Máquinas', icon: <IconMachine />, on: path.startsWith('/catalog') },
        { to: '/profile', label: 'Perfil', icon: <IconUser />, on: path.startsWith('/profile') },
      ]
    : [
        { to: '/', label: 'Hoy', icon: <IconToday />, on: path === '/' || path.startsWith('/day') },
        { to: '/routines', label: 'Rutinas', icon: <IconRoutine />, on: path.startsWith('/routine') },
        { to: '/progress', label: 'Progreso', icon: <IconChart />, on: path.startsWith('/progress') },
        { to: '/catalog', label: 'Máquinas', icon: <IconMachine />, on: path.startsWith('/catalog') },
        { to: '/profile', label: 'Perfil', icon: <IconUser />, on: path.startsWith('/profile') },
      ];
  return (
    <div className="tabbar">
      <nav>
        {tabs.map((t) => (
          <Link key={t.to} to={t.to} aria-current={t.on ? 'page' : undefined}>
            {t.icon}
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose(): void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function ExerciseThumb({ exerciseId, large }: { exerciseId: string; large?: boolean }) {
  const eq = getEquipment(getExercise(exerciseId).equipmentId);
  return (
    <div className={'thumb' + (large ? ' lg' : '')}>
      <EquipmentGlyph kind={eq?.kind ?? 'bodyweight'} size={large ? 32 : 28} />
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Loading() {
  return <div className="loading">Cargando…</div>;
}

export function ErrorBox({ error, onRetry }: { error: Error; onRetry?(): void }) {
  return (
    <Empty title="No se ha podido cargar" action={onRetry && <button className="btn" onClick={onRetry}>Reintentar</button>}>
      {error.message}
    </Empty>
  );
}
