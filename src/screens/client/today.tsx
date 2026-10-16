import { useEffect, useState } from 'react';
import { DAY_GROUP_NAMES, ex } from '../../data/catalog';
import { useApp, useMe } from '../../lib/app';
import { useClientData } from '../../lib/hooks';
import { go, href } from '../../lib/router';
import { lastEntryFor, plannedSetCount, doneSetCount, finished } from '../../lib/stats';
import { finishWorkout, loadLive, startWorkout, targetFor } from '../../lib/workout';
import type { RoutineDay } from '../../lib/types';
import { DOW_NAME, dow, n, time, todayLabel } from '../../lib/util';
import { IcCheck, IcClock, IcSliders } from '../../ui/icons';
import { ClientNav, Loading } from '../../ui/kit';

export function Today() {
  const { store, settings } = useApp();
  const me = useMe();
  const d = useClientData(me.id, me);
  const [live, setLive] = useState(() => loadLive(me.id));
  const [pick, setPick] = useState<string | null>(null);

  useEffect(() => {
    if (!live) return;
    const w = live.workout;
    const lastTouch = Math.max(w.startedAt, ...w.entries.flatMap((e) => e.sets.map((s) => s.at || 0)));
    // Pasadas 12 h se guarda sola como incompleta
    if (Date.now() - lastTouch > 12 * 3600000) {
      finishWorkout(store, live, 'incomplete');
      setLive(null);
    }
  }, [live, store]);

  if (!d.ready) return <Loading />;

  if (live) {
    const w = live.workout;
    const done = doneSetCount(w);
    const total = plannedSetCount(w);
    const cur = w.entries[live.current];
    const curSet = cur ? cur.sets.findIndex((s) => !s.done) : -1;
    {
      return (
        <div className="screen with-nav">
          <div className="topbar">
            <span className="meta">{todayLabel()} · {time(Date.now())}</span>
          </div>
          <div className="pad">
            <span className="kicker accent" style={{ display: 'block', marginTop: 18 }}>Sesión a medias</span>
            <h1 className="h1 xl" style={{ marginTop: 8 }}>{w.dayName}</h1>
            <p className="lead" style={{ marginTop: 10, fontSize: 15 }}>Empezada a las {time(w.startedAt)}.</p>
          </div>
          <div className="main" style={{ paddingTop: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="stat">
                {done} <span style={{ fontSize: 16 }} className="mute">de {total} series</span>
              </span>
              <span className="small mute">{w.entries.filter((e) => e.sets.every((s) => s.done)).length} de {w.entries.length} ejercicios</span>
            </div>
            <div className="progress thick" style={{ marginTop: 12 }}>
              <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
            </div>
            {cur && (
              <div style={{ marginTop: 28, borderTop: '1px solid var(--ink)', paddingTop: 12 }}>
                <span className="kicker">Te quedaste en</span>
                <p style={{ marginTop: 8, fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em' }}>
                  {cur.name} · serie {Math.max(1, curSet + 1)} de {cur.sets.length}
                </p>
                <p className="mute" style={{ marginTop: 4 }}>
                  {n(cur.sets[Math.max(0, curSet)]?.weight)} kg × {cur.sets[Math.max(0, curSet)]?.reps}
                </p>
              </div>
            )}
            <p className="small mute" style={{ marginTop: 22, display: 'flex', gap: 8 }}>
              <IcCheck style={{ flex: 'none', marginTop: 2 }} />
              Lo que hiciste está guardado en el móvil y se sincroniza solo al recuperar conexión.
            </p>
          </div>
          <div className="bottom">
            <a className="btn xl" href={href('/entreno')}>Seguir donde lo dejé</a>
            <div className="row-actions">
              <button
                type="button"
                className="txt u"
                onClick={() => {
                  const fw = finishWorkout(store, live, 'incomplete');
                  go(`/resumen/${fw.id}`);
                }}
              >
                Terminarla y guardar
              </button>
              <button
                type="button"
                className="txt mute"
                onClick={() => {
                  if (!confirm('¿Descartar esta sesión? Se perderán las series de hoy.')) return;
                  void store.remove('workouts', w.id);
                  localStorage.removeItem('gym:active');
                  setLive(null);
                }}
              >
                Descartar
              </button>
            </div>
          </div>
          <ClientNav active="hoy" />
        </div>
      );
    }
  }

  const routine = d.main;
  const allDays = [...d.fromTrainer, ...d.mine].flatMap((r) => r.days.map((day) => ({ r, day })));
  const chosen = pick ? allDays.find((x) => x.day.id === pick) : null;
  const day: RoutineDay | null = chosen?.day || d.next;
  const r = chosen?.r || routine;
  const lastAt = finished(d.workouts).filter((w) => dow(w.startedAt) === dow(Date.now())).map((w) => w.startedAt);
  const usualHour = lastAt.length >= 2 ? Math.round(lastAt.map((t) => new Date(t).getHours() + new Date(t).getMinutes() / 60).reduce((a, b) => a + b, 0) / lastAt.length) : null;
  const inc = { machine: settings.incMachine, dumbbell: settings.incDumbbell };
  const doneToday = finished(d.workouts).some((w) => w.status === 'done' && new Date(w.startedAt).toDateString() === new Date().toDateString());

  const start = () => {
    if (!day) return;
    const s = startWorkout(me, r, day, d.workouts, inc);
    void store.set('workouts', s.workout.id, s.workout);
    go('/entreno');
  };

  return (
    <div className="screen with-nav">
      <div className="topbar">
        <span className="meta">{todayLabel()}</span>
        <a className="icon-btn" href={href('/ajustes')} aria-label="Ajustes">
          <IcSliders />
        </a>
      </div>
      {!day ? (
        <div className="main">
          <span className="kicker" style={{ marginTop: 18 }}>Hoy</span>
          <h1 className="h1 xl" style={{ marginTop: 8 }}>Sin rutina todavía</h1>
          <p className="lead" style={{ marginTop: 12 }}>
            {me.trainerId ? `${me.trainerName || 'Tu entrenador'} aún no te ha asignado una rutina. Mientras, puedes crear la tuya.` : 'Crea tu propia rutina o pide a tu entrenador el enlace de invitación.'}
          </p>
          <a className="btn" style={{ marginTop: 24 }} href={href('/rutina/nueva')}>Crear mi rutina</a>
        </div>
      ) : (
        <>
          <div className="pad">
            <span className="kicker accent" style={{ display: 'block', marginTop: 18 }}>{doneToday ? 'Ya has entrenado hoy · otra sesión' : 'Hoy toca'}</span>
            <h1 className="h1 xl" style={{ marginTop: 8 }}>{day.name}</h1>
            <p className="lead" style={{ marginTop: 10, fontSize: 15 }}>
              {day.exercises.length} ejercicios · {day.exercises.reduce((a, p) => a + p.sets, 0)} series · unos {Math.round(day.exercises.reduce((a, p) => a + p.sets, 0) * 3.2)} min
            </p>
          </div>
          <div className="main" style={{ paddingTop: 22 }}>
            <div style={{ borderTop: '1px solid var(--ink)' }}>
              {day.exercises.map((p, i) => {
                const x = ex(p.exerciseId);
                const last = lastEntryFor(d.workouts, p, day.id);
                const lastW = last?.sets.find((st) => st.done)?.weight ?? null;
                const lastR = last?.sets.find((st) => st.done)?.reps ?? null;
                const t = targetFor(p, d.workouts, day.id, r?.updatedAt || 0, inc);
                const dW = t.weight !== null && lastW !== null ? t.weight - lastW : 0;
                const dR = lastR !== null && t.weight === lastW ? t.reps - lastR : 0;
                return (
                  <div key={p.id} className="row num">
                    <span className="small mute">{i + 1}</span>
                    <span className="col">
                      <span className="t">{x?.name || p.rawName}</span>
                      <span className="s">
                        {p.sets} × {t.reps}
                        {t.weight !== null ? ` · ${x?.load === 'dumbbell' ? '2 × ' : ''}${n(t.weight)} kg` : ''}
                      </span>
                    </span>
                    {dW > 0 ? <span className="xs b accent-t">+{n(dW)} kg</span> : dR > 0 ? <span className="xs b accent-t">+{dR} rep</span> : <span />}
                  </div>
                );
              })}
            </div>
            <div className="small mute" style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <IcCheck /> Funciona sin conexión
              </span>
              {usualHour !== null && (
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <IcClock /> Los {DOW_NAME[dow(Date.now())]} sueles empezar sobre las {usualHour}:00
                </span>
              )}
              {d.learned.ready && d.learned.days[dow(Date.now())].group && (
                <span>Los {DOW_NAME[dow(Date.now())]} sueles hacer {DAY_GROUP_NAMES[d.learned.days[dow(Date.now())].group!].toLowerCase()}.</span>
              )}
            </div>
            {allDays.length > 1 && (
              <details style={{ marginTop: 14 }}>
                <summary className="txt u" style={{ listStyle: 'none' }}>Hoy prefiero otro día</summary>
                <div>
                  {allDays.map(({ r: rr, day: dd }) => (
                    <button key={dd.id} type="button" className="row" onClick={() => setPick(dd.id)}>
                      <span className="col">
                        <span className="t">{dd.name}</span>
                        <span className="s">{rr.name}</span>
                      </span>
                      {dd.id === day.id ? <IcCheck /> : <span />}
                    </button>
                  ))}
                </div>
              </details>
            )}
          </div>
          <div className="bottom">
            <button type="button" className="btn xl" onClick={start}>
              Empezar
            </button>
          </div>
        </>
      )}
      <ClientNav active="hoy" />
    </div>
  );
}
