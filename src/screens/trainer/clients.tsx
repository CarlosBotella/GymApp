import { useApp, useMe } from '../../lib/app';
import { go, href } from '../../lib/router';
import type { Routine } from '../../lib/types';
import { todayLabel, uid } from '../../lib/util';
import { IcPlus, IcSearch, IcSliders } from '../../ui/icons';
import { Loading, TrainerNav, toast } from '../../ui/kit';
import { alertsFor, assignedFor, sessionsThisWeek, useDismiss, useTrainerData, type Alert } from './data';
import { useState } from 'react';

export function Clients() {
  const { store } = useApp();
  const me = useMe();
  const td = useTrainerData();
  const dismiss = useDismiss();
  const [q, setQ] = useState<string | null>(null);
  if (!td.ready) return <Loading />;
  const alerts = alertsFor(td, me).slice(0, 6);

  const act = async (a: Alert) => {
    const r = td.routines.find((x) => x.id === a.routineId);
    switch (a.kind) {
      case 'week':
        return go(`/semana/${a.routineId}`);
      case 'routine':
        return go(`/sugerir/${a.routineId}`);
      case 'noroutine':
        return go(`/biblioteca?para=${a.client.id}`);
      case 'note':
        await store.update('notes', a.noteId!, { seen: true });
        return;
      case 'busy': {
        if (!r) return;
        const days = r.days.map((d) => {
          const i = d.exercises.findIndex((p) => p.exerciseId === a.exerciseId);
          if (i === -1) return d;
          const list = [...d.exercises];
          const [p] = list.splice(i, 1);
          list.push(p);
          return { ...d, exercises: list };
        });
        await store.update('routines', r.id, { days, updatedAt: r.updatedAt });
        await dismiss(a.key);
        toast('Movida al final del día');
        return;
      }
      case 'swap': {
        if (!r) return;
        const days = r.days.map((d) => ({ ...d, exercises: d.exercises.map((p) => (p.exerciseId === a.exerciseId ? { ...p, exerciseId: a.altId!, id: uid(8) } : p)) }));
        await store.update('routines', r.id, { days, updatedAt: Date.now() } as Partial<Routine>);
        await dismiss(a.key);
        toast('Rutina actualizada');
        return;
      }
    }
  };

  const list = td.clients.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="screen with-nav">
      <div className="topbar">
        <span className="meta">{todayLabel()}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a className="txt accent" href={href('/invitar')} style={{ fontSize: 14 }}>
            <IcPlus /> Invitar
          </a>
          <button type="button" className="icon-btn" aria-label="Buscar cliente" onClick={() => setQ(q === null ? '' : null)}>
            <IcSearch />
          </button>
          <a className="icon-btn" href={href('/ajustes')} aria-label="Ajustes">
            <IcSliders />
          </a>
        </span>
      </div>
      <div className="pad">
        <h1 className="h1" style={{ marginTop: 4 }}>Clientes</h1>
        {q !== null && (
          <>
            <label className="sr" htmlFor="q">Buscar cliente</label>
            <input id="q" className="input" autoFocus placeholder="Buscar por nombre" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginTop: 10 }} />
          </>
        )}
      </div>
      <div className="main">
        <div className="sec">
          <span className="kicker">Decide en un toque</span>
          <span>{alerts.length}</span>
        </div>
        {alerts.length === 0 && <p className="small mute" style={{ padding: '14px 0' }}>Nada pendiente. Aquí aparecerá lo que necesite tu decisión.</p>}
        {alerts.map((a) => (
          <div key={a.key} className="row" style={{ padding: '12px 0' }}>
            <a className="col" href={href(`/cliente/${a.client.id}`)} style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="small mute">{a.client.name}</span>
              <span className="t" style={{ fontSize: 17 }}>{a.title}</span>
              <span className="small mute">{a.sub}</span>
            </a>
            <button type="button" className={`btn2 sm ${a.accent ? 'accent' : ''}`} onClick={() => act(a)}>
              {a.action}
            </button>
          </div>
        ))}

        <div className="sec" style={{ marginTop: 28 }}>
          <span className="kicker">Todos</span>
          <span>{td.clients.length}</span>
        </div>
        {td.clients.length === 0 && (
          <div className="empty">
            <p className="lead">Todavía no tienes clientes.</p>
            <a className="btn" style={{ marginTop: 16 }} href={href('/invitar')}>
              Invitar al primero
            </a>
          </div>
        )}
        {list.map((c) => {
          const r = assignedFor(td, c.id, me.id);
          return (
            <a key={c.id} className="row" style={{ minHeight: 60 }} href={href(`/cliente/${c.id}`)}>
              <span className="col">
                <span className="t" style={{ fontSize: 17 }}>{c.name}</span>
                <span className="s">{r ? `Semana ${r.week} · ${r.name}` : 'Sin rutina'}</span>
              </span>
              {r ? <span className="small mute">{sessionsThisWeek(td, c.id)}/{c.days || r.days.length}</span> : <span className="small b accent-t">Asignar</span>}
            </a>
          );
        })}
      </div>
      <div className="bottom" style={{ flexDirection: 'row', gap: 12 }}>
        <a className="btn" href={href('/biblioteca')}>
          Asignar rutina
        </a>
        <a className="btn2" style={{ width: 112, height: 60, flex: 'none' }} href={href('/escribir')}>
          Escribir
        </a>
      </div>
      <TrainerNav active="clientes" />
    </div>
  );
}
