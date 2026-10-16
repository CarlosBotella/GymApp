import { useMemo } from 'react';
import { ex } from '../../data/catalog';
import { useApp, useMe } from '../../lib/app';
import { href } from '../../lib/router';
import { constancy, learnWeek, periodStart, records } from '../../lib/stats';
import { dateShort, n } from '../../lib/util';
import { IcChev } from '../../ui/icons';
import { Loading, Sec, TopBar, TrainerNav, WeekStrip } from '../../ui/kit';
import { assignedFor, useTrainerData } from './data';
import { useQuery } from '../../lib/app';
import type { BodyReport } from '../../lib/types';

export function ClientDetail({ clientId }: { clientId: string }) {
  const { store } = useApp();
  const me = useMe();
  const td = useTrainerData();
  const reports = useQuery<BodyReport>('bodyReports', [['clientId', clientId], ['trainerId', me.id]]);
  const ws = useMemo(() => td.workouts.filter((w) => w.clientId === clientId), [td.workouts, clientId]);
  const learned = useMemo(() => learnWeek(ws), [ws]);
  if (!td.ready || reports === null) return <Loading />;
  const c = td.clients.find((x) => x.id === clientId);
  if (!c)
    return (
      <div className="screen with-nav">
        <TopBar back="/clientes" backLabel="Clientes" />
        <div className="main">
          <p className="lead" style={{ marginTop: 20 }}>Este cliente ya no está vinculado contigo.</p>
        </div>
        <TrainerNav active="clientes" />
      </div>
    );
  const assigned = assignedFor(td, c.id, me.id);
  const own = td.routines.filter((r) => r.ownerId === c.id && r.ownerRole === 'client');
  const notes = td.notes.filter((x) => x.clientId === c.id).slice(0, 6);
  const since = periodStart('3m');
  const cons = constancy(ws, since, c.days || assigned?.days.length || 3);
  const recs = records(ws, since);
  const lastR = [...reports].sort((a, b) => a.date - b.date)[reports.length - 1];
  const doneSinceUpdate = assigned ? new Set(ws.filter((w) => w.routineId === assigned.id && w.startedAt > assigned.updatedAt && w.status === 'done').map((w) => w.dayId)).size : 0;
  const extra: Record<number, string> = {};
  return (
    <div className="screen with-nav">
      <TopBar
        back="/clientes"
        backLabel="Clientes"
        right={
          <a className="txt m" href={href(`/informe/${c.id}`)} style={{ fontSize: 14 }}>
            Informe completo
          </a>
        }
      />
      <div className="pad">
        <h1 className="h1" style={{ marginTop: 2 }}>{c.name}</h1>
        <p className="small mute" style={{ marginTop: 6 }}>
          Desde {dateShort(c.linkedAt || c.createdAt)} · {c.days || 3} días · {c.shareBody !== false ? 'comparte datos de cuerpo' : 'no comparte datos de cuerpo'}
        </p>
      </div>
      <div className="main" style={{ paddingTop: 16 }}>
        <WeekStrip learned={learned} extra={extra} compact />
        {!learned.ready && <p className="xs mute" style={{ marginTop: 6 }}>La semana se aprende a partir de 3 semanas de entrenos.</p>}
        <div className="grid3" style={{ marginTop: 18 }}>
          <div className="stack">
            <span className="stat" style={{ fontSize: 26 }}>{cons.pct} %</span>
            <span className="xs mute">constancia</span>
          </div>
          <div className="stack">
            <span className="stat" style={{ fontSize: 26 }}>{recs.length}</span>
            <span className="xs mute">récords · 3 meses</span>
          </div>
          <div className="stack">
            <span className="stat" style={{ fontSize: 26 }}>{lastR?.composition.bfp ? `${n(lastR.composition.bfp.value)} %` : '—'}</span>
            <span className="xs mute">{lastR ? `grasa · ${dateShort(lastR.date)}` : 'sin Visbody'}</span>
          </div>
        </div>

        <Sec title="Rutinas" style={{ marginTop: 22 }} />
        {assigned ? (
          <a className="row" style={{ minHeight: 58 }} href={href(`/semana/${assigned.id}`)}>
            <span className="col">
              <span className="t">{assigned.name} · tuya</span>
              <span className="s">
                Semana {assigned.week} · {doneSinceUpdate} de {assigned.days.length} días hechos
              </span>
            </span>
            <span className="small b accent-t">Semana {assigned.week + 1}</span>
          </a>
        ) : (
          <a className="row" href={href(`/biblioteca?para=${c.id}`)}>
            <span className="col">
              <span className="t">Sin rutina asignada</span>
              <span className="s">Elige una de tu biblioteca</span>
            </span>
            <span className="small b accent-t">Asignar</span>
          </a>
        )}
        {own.map((r) => {
          const pend = td.suggestions.filter((s) => s.routineId === r.id && s.status === 'pending').length;
          return (
            <a key={r.id} className="row" style={{ minHeight: 58 }} href={href(`/sugerir/${r.id}`)}>
              <span className="col">
                <span className="t">{r.name} · suya</span>
                <span className="s">{pend ? `${pend} ${pend === 1 ? 'sugerencia pendiente' : 'sugerencias pendientes'} de respuesta` : 'Puedes sugerirle cambios'}</span>
              </span>
              <IcChev className="chev" />
            </a>
          );
        })}
        {assigned && (
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            <a className="txt u" style={{ fontSize: 14 }} href={href(`/biblioteca?para=${c.id}`)}>
              Cambiar de rutina
            </a>
            <a className="txt u" style={{ fontSize: 14 }} href={href(`/escribir?rutina=${assigned.id}&para=${c.id}`)}>
              Editar la suya actual
            </a>
          </div>
        )}

        <Sec title="Notas de sus sesiones" right={notes.length || undefined} style={{ marginTop: 22 }} />
        {notes.length === 0 && <p className="small mute" style={{ padding: '12px 0' }}>Las notas que deje al entrenar aparecerán aquí.</p>}
        {notes.map((nt) => (
          <button key={nt.id} type="button" onClick={() => !nt.seen && store.update('notes', nt.id, { seen: true })} style={{ background: 'none', border: 0, borderBottom: '1px solid var(--line)', padding: '10px 0', textAlign: 'left', width: '100%' }}>
            <span className="xs mute" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!nt.seen && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />}
              {dateShort(nt.createdAt)}
              {nt.exerciseId ? ` · ${ex(nt.exerciseId)?.name}` : ''}
              {nt.kind === 'alert' ? ' · aviso' : ''}
            </span>
            <p style={{ marginTop: 3, fontSize: 15 }}>«{nt.text}»</p>
          </button>
        ))}
        <div style={{ display: 'flex', gap: 22, marginTop: 10 }}>
          <a className="txt u" style={{ fontSize: 14 }} href={href(`/exportar/${c.id}`)}>
            Exportar sus datos
          </a>
        </div>
      </div>
      <TrainerNav active="clientes" />
    </div>
  );
}
