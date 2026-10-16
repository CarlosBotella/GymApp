import { useState } from 'react';
import { ex } from '../../data/catalog';
import { useApp, useDoc, useMe } from '../../lib/app';
import { addNote } from '../../lib/api';
import { useClientData } from '../../lib/hooks';
import { href } from '../../lib/router';
import { bestSet, doneSetCount, plannedSetCount, progress, workoutVolume } from '../../lib/stats';
import type { Workout } from '../../lib/types';
import { DAY, n, startOfWeek, time, tons } from '../../lib/util';
import { IcPen } from '../../ui/icons';
import { ClientNav, Loading, Sheet, toast } from '../../ui/kit';

export function Summary({ workoutId }: { workoutId: string }) {
  const { store, settings } = useApp();
  const me = useMe();
  const w = useDoc<Workout>('workouts', workoutId);
  const d = useClientData(me.id, me);
  const [note, setNote] = useState(false);
  const [text, setText] = useState('');
  if (w === undefined || !d.ready) return <Loading />;
  if (!w)
    return (
      <div className="screen with-nav">
        <div className="main" style={{ justifyContent: 'center' }}>
          <p className="lead">No encuentro esta sesión.</p>
        </div>
        <ClientNav active="hoy" />
      </div>
    );

  const before = d.workouts.filter((x) => x.startedAt < w.startedAt && x.status !== 'active');
  // récord: mejor peso de algún ejercicio por encima de todo lo anterior
  let record: { name: string; weight: number; reps: number; prev: number } | null = null;
  for (const e of w.entries) {
    if (!e.exerciseId) continue;
    const b = bestSet(e);
    if (!b || !b.weight) continue;
    let prev = 0;
    for (const o of before) for (const oe of o.entries) if (oe.exerciseId === e.exerciseId) prev = Math.max(prev, bestSet(oe)?.weight || 0);
    if (prev > 0 && b.weight > prev && (!record || b.weight - prev > record.weight - record.prev)) record = { name: e.name, ...b, prev };
  }
  const routine = [...d.fromTrainer, ...d.mine].find((r) => r.id === w.routineId);
  const day = routine?.days.find((x) => x.id === w.dayId);
  const inc = { machine: settings.incMachine, dumbbell: settings.incDumbbell };
  const changes = day
    ? day.exercises
        .map((p) => {
          const e = w.entries.find((x) => x.planId === p.id);
          return e ? progress({ ...p, weight: e.sets.find((st) => st.done)?.weight ?? p.weight, reps: Math.max(p.reps, e.target.reps) }, e, inc) : null;
        })
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const weekStart = startOfWeek(Date.now());
  const thisWeek = d.workouts.filter((x) => x.startedAt >= weekStart && x.status !== 'active').length;
  const perWeek = Math.max(me.days || 3, thisWeek);
  const mins = Math.round(((w.endedAt || Date.now()) - w.startedAt) / 60000);

  return (
    <div className="screen with-nav">
      <div className="topbar">
        <span className="meta">
          {w.status === 'done' ? 'Sesión terminada' : 'Sesión guardada a medias'} · {time(w.endedAt || Date.now())}
        </span>
      </div>
      <div className="pad">
        <h1 className="h1 xl" style={{ marginTop: 4 }}>
          {w.dayName.split(' · ')[0]}, hecha
        </h1>
        <div className="grid3" style={{ marginTop: 18 }}>
          <div className="stack">
            <span className="stat-s" style={{ fontSize: 24 }}>{mins} min</span>
            <span className="xs mute">duración</span>
          </div>
          <div className="stack">
            <span className="stat-s" style={{ fontSize: 24 }}>
              {doneSetCount(w)} / {Math.max(doneSetCount(w), plannedSetCount(w))}
            </span>
            <span className="xs mute">series</span>
          </div>
          <div className="stack">
            <span className="stat-s" style={{ fontSize: 24 }}>{tons(workoutVolume(w))}</span>
            <span className="xs mute">volumen</span>
          </div>
        </div>
      </div>
      <div className="main">
        {record && (
          <section className="callout" aria-label="Récord">
            <span className="kicker accent">Récord personal</span>
            <p style={{ marginTop: 6, fontSize: 28, lineHeight: 1.1, fontWeight: 500, letterSpacing: '-0.02em' }}>
              {record.name} · {n(record.weight)} kg × {record.reps}
            </p>
            <p className="small mute" style={{ marginTop: 4 }}>{n(record.weight - record.prev)} kg más que tu mejor marca</p>
          </section>
        )}
        {changes.length > 0 && (
          <>
            <div className="sec">
              <span className="kicker">La próxima vez</span>
            </div>
            {changes.map((c) => {
              const x = ex(c!.plan.exerciseId);
              return (
                <div key={c!.plan.id} className="row" style={{ minHeight: 50 }}>
                  <span className="col">
                    <span className="m" style={{ fontSize: 15 }}>{x?.name}</span>
                    <span className="xs mute">{c!.reason}</span>
                  </span>
                  {c!.change === 'keep' ? (
                    <span className="mute" style={{ fontSize: 15 }}>{c!.from.weight !== null ? `${n(c!.from.weight)} kg, igual` : 'igual'}</span>
                  ) : c!.change === 'up-weight' ? (
                    <span style={{ fontSize: 15 }}>
                      <span className="mute">{n(c!.from.weight)} → </span>
                      <span className="b">{n(c!.to.weight)} kg</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: 15 }}>
                      <span className="mute">{c!.from.reps} → </span>
                      <span className="b">{c!.to.reps} reps</span>
                    </span>
                  )}
                </div>
              );
            })}
          </>
        )}
        <div className="row-actions" style={{ marginTop: 18 }}>
          <span>Esta semana</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }} role="img" aria-label={`${thisWeek} de ${perWeek} sesiones`}>
            {Array.from({ length: perWeek }, (_, i) => (
              <span key={i} style={{ width: 28, height: 4, background: i < thisWeek ? 'var(--accent)' : 'var(--line)' }} />
            ))}
            <span className="b" style={{ marginLeft: 8 }}>
              {thisWeek} de {perWeek}
            </span>
          </span>
        </div>
        <button type="button" className="row" style={{ marginTop: 16, borderTop: '1px solid var(--line)' }} onClick={() => setNote(true)}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IcPen />
            <span className="col">
              <span className="t" style={{ fontSize: 15 }}>{w.note ? 'Editar la nota de la sesión' : 'Añadir nota a la sesión'}</span>
              <span className="xs mute">{me.trainerId ? 'La verá tu entrenador en tu ficha' : 'Queda guardada con la sesión'}</span>
            </span>
          </span>
          <span />
        </button>
      </div>
      <div className="bottom">
        <a className="btn" href={href('/hoy')}>Listo</a>
        {'share' in navigator && (
          <button
            type="button"
            className="txt"
            style={{ alignSelf: 'center' }}
            onClick={() =>
              navigator
                .share({ title: 'Entreno', text: `${w.dayName}: ${doneSetCount(w)} series, ${tons(workoutVolume(w))}${record ? `. Récord en ${record.name}: ${n(record.weight)} kg` : ''}.` })
                .catch(() => undefined)
            }
          >
            Compartir resumen
          </button>
        )}
      </div>
      <ClientNav active="hoy" />
      {note && (
        <Sheet label="Nota de la sesión" onClose={() => setNote(false)}>
          <h2 className="h2" style={{ margin: '16px 0 8px', fontSize: 24 }}>Nota de la sesión</h2>
          <textarea className="notes" style={{ fontFamily: 'inherit', minHeight: 110 }} defaultValue={w.note} onChange={(e) => setText(e.target.value)} aria-label="Nota" autoFocus />
          <button
            type="button"
            className="btn"
            style={{ marginTop: 16 }}
            onClick={() => {
              void store.update('workouts', w.id, { note: text });
              if (text.trim() && Date.now() - w.startedAt < DAY) void addNote(store, me, text.trim(), 'note', { workoutId: w.id });
              setNote(false);
              toast('Nota guardada');
            }}
          >
            Guardar
          </button>
        </Sheet>
      )}
    </div>
  );
}
