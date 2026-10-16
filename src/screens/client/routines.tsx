import { useCallback, useEffect, useState } from 'react';
import { DAY_GROUP_NAMES, ex } from '../../data/catalog';
import { useApp, useMe } from '../../lib/app';
import { answerSuggestion } from '../../lib/api';
import { useClientData } from '../../lib/hooks';
import { go, href } from '../../lib/router';
import { exerciseSeries } from '../../lib/stats';
import type { Routine, RoutineDay } from '../../lib/types';
import { DOW_NAME, n, todayLabel, uid } from '../../lib/util';
import { startWorkout } from '../../lib/workout';
import { IcChev, IcPlus } from '../../ui/icons';
import { ClientNav, Loading, Sec, TopBar, WeekStrip, toast } from '../../ui/kit';
import { RoutineBuilder, builderDays, initBuilder, type BuilderState } from '../shared/builder';

const DAYS_ES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

function daysOfRoutine(r: Routine, learned: ReturnType<typeof useClientData>['learned']): string {
  if (!learned.ready) return `${r.days.length} ${r.days.length === 1 ? 'día' : 'días'}`;
  const names = r.days.map((d) => {
    const idx = learned.days.map((x, i) => (x.group === d.group ? i : -1)).filter((i) => i >= 0);
    return idx.map((i) => DAYS_ES[i]);
  });
  const flat = [...new Set(names.flat())];
  return flat.length ? flat.join(' y ').replace(/ y (?=.* y )/g, ', ') : `${r.days.length} días`;
}

export function Routines() {
  const me = useMe();
  const d = useClientData(me.id, me);
  const [planned, setPlanned] = useState(false);
  if (!d.ready) return <Loading />;
  const pendingBy = (rid: string) => d.suggestions.filter((s) => s.routineId === rid && s.status === 'pending').length;
  const learnedText = d.learned.days
    .map((x, i) => (x.group ? `${DAY_GROUP_NAMES[x.group].toLowerCase()} el ${DOW_NAME[i]}` : null))
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
  return (
    <div className="screen with-nav">
      <div className="topbar">
        <span className="meta">{todayLabel()}</span>
      </div>
      <div className="pad">
        <h1 className="h1" style={{ marginTop: 4 }}>Rutina</h1>
      </div>
      <div className="main">
        {d.learned.ready ? (
          <>
            <Sec title="Tu semana" right={`Aprendida de ${d.learned.weeks} semanas`} />
            <div style={{ marginTop: 12 }}>
              <WeekStrip learned={d.learned} />
            </div>
            <p className="small mute" style={{ marginTop: 12, fontSize: 14 }}>
              Sueles hacer {learnedText}. {planned ? 'Hecho: te propondré así cada día en Hoy.' : '¿Planifico así la próxima semana?'}
            </p>
            {!planned && (
              <div style={{ display: 'flex', gap: 24 }}>
                <button
                  type="button"
                  className="txt accent"
                  onClick={() => {
                    setPlanned(true);
                    toast('Hoy te propondrá el día que sueles hacer');
                  }}
                >
                  Sí, así
                </button>
                <a className="txt" href={href('/hoy')}>
                  Cambiar días
                </a>
              </div>
            )}
          </>
        ) : (
          <>
            <Sec title="Tu semana" right={`Aprendiendo · ${d.learned.weeks} de 3 semanas`} />
            <p className="small mute" style={{ marginTop: 10 }}>Cuando lleves tres semanas, la app te propondrá un grupo para cada día según cuándo sueles entrenar.</p>
          </>
        )}

        <Sec title="De tu entrenador" right={d.fromTrainer.length} />
        {d.fromTrainer.length === 0 && <p className="small mute" style={{ padding: '14px 0' }}>{me.trainerId ? 'Aún no te ha asignado ninguna.' : 'No tienes entrenador vinculado.'}</p>}
        {d.fromTrainer.map((r) => (
          <a key={r.id} className="row" style={{ minHeight: 58 }} href={href(`/rutina/${r.id}`)}>
            <span className="col">
              <span className="t" style={{ fontSize: 17 }}>{r.name}</span>
              <span className="s">
                {r.days.length} {r.days.length === 1 ? 'día' : 'días'} · {daysOfRoutine(r, d.learned)}
              </span>
            </span>
            <IcChev className="chev" />
          </a>
        ))}

        <Sec title="Tuyas" right="Las editas tú" style={{ marginTop: 22 }} />
        {d.mine.map((r) => (
          <a key={r.id} className="row" style={{ minHeight: 58 }} href={href(`/rutina/${r.id}`)}>
            <span className="col">
              <span className="t" style={{ fontSize: 17 }}>{r.name}</span>
              <span className="s">{r.days.reduce((a, x) => a + x.exercises.length, 0)} ejercicios · creada por ti</span>
            </span>
            {pendingBy(r.id) ? (
              <span className="small b accent-t" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                {pendingBy(r.id)} {pendingBy(r.id) === 1 ? 'sugerencia' : 'sugerencias'}
              </span>
            ) : (
              <IcChev className="chev" />
            )}
          </a>
        ))}
        <a className="txt" style={{ minHeight: 52, gap: 8, fontSize: 16 }} href={href('/rutina/nueva')}>
          <IcPlus /> Nueva rutina
        </a>
      </div>
      {d.next && (
        <div className="bottom">
          <a className="btn" href={href('/hoy')}>
            Hoy toca {DAY_GROUP_NAMES[d.next.group].toLowerCase()} · Empezar
          </a>
        </div>
      )}
      <ClientNav active="rutinas" />
    </div>
  );
}

export function RoutineView({ routineId }: { routineId: string }) {
  const { store, settings } = useApp();
  const me = useMe();
  const d = useClientData(me.id, me);
  if (!d.ready) return <Loading />;
  const r = [...d.fromTrainer, ...d.mine].find((x) => x.id === routineId);
  if (!r)
    return (
      <div className="screen with-nav">
        <TopBar back="/rutinas" backLabel="Rutinas" />
        <div className="main">
          <p className="lead" style={{ marginTop: 20 }}>Esta rutina ya no existe.</p>
        </div>
        <ClientNav active="rutinas" />
      </div>
    );
  const mine = r.ownerId === me.id;
  const pending = d.suggestions.filter((s) => s.routineId === r.id && s.status === 'pending');
  const sug = pending[0];
  const startDay = (day: RoutineDay) => {
    const s = startWorkout(me, r, day, d.workouts, { machine: settings.incMachine, dumbbell: settings.incDumbbell });
    void store.set('workouts', s.workout.id, s.workout);
    go('/entreno');
  };
  const tryOnce = sug && sug.status === 'pending';
  return (
    <div className="screen with-nav">
      <TopBar
        back="/rutinas"
        backLabel="Rutinas"
        right={
          mine ? (
            <a className="txt m" href={href(`/rutina/${r.id}/editar`)}>
              Editar
            </a>
          ) : undefined
        }
      />
      <div className="pad">
        <span className="kicker" style={{ display: 'block', marginTop: 4 }}>{mine ? 'Creada por ti' : `De ${me.trainerName || 'tu entrenador'}${r.week > 1 ? ` · semana ${r.week}` : ''}`}</span>
        <h1 className="h1" style={{ marginTop: 6, fontSize: 34 }}>{r.name}</h1>
        <p className="small mute" style={{ marginTop: 6, fontSize: 14 }}>
          {r.days.reduce((a, x) => a + x.exercises.length, 0)} ejercicios · {r.days.length} {r.days.length === 1 ? 'día' : 'días'}
        </p>
      </div>
      <div className="main">
        {sug && (
          <section className="callout" aria-label="Sugerencia de tu entrenador">
            <span className="kicker accent">Sugerido por tu entrenador</span>
            <p style={{ marginTop: 8, fontSize: 18, lineHeight: 1.3, fontWeight: 500 }}>
              Cambiar {ex(sug.fromExerciseId)?.name.toLowerCase()} por {ex(sug.toExerciseId)?.name.toLowerCase()}
            </p>
            {sug.reason && <p className="small mute" style={{ marginTop: 4, fontSize: 14 }}>«{sug.reason}»</p>}
            <div style={{ display: 'flex', gap: 22, marginTop: 4, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="txt accent"
                onClick={async () => {
                  await answerSuggestion(store, sug, 'accepted', r);
                  toast('Cambio aplicado a tu rutina');
                }}
              >
                Aceptar
              </button>
              {tryOnce && (
                <button
                  type="button"
                  className="txt"
                  onClick={async () => {
                    await answerSuggestion(store, sug, 'tryonce', r);
                    const day = r.days.find((x) => x.id === sug.dayId);
                    if (!day) return;
                    const swapped = { ...day, exercises: day.exercises.map((p) => (p.id === sug.planId ? { ...p, exerciseId: sug.toExerciseId, id: uid(8) } : p)) };
                    startDay(swapped);
                  }}
                >
                  Probar una vez
                </button>
              )}
              <button type="button" className="txt mute" onClick={() => answerSuggestion(store, sug, 'rejected', r)}>
                No, gracias
              </button>
            </div>
          </section>
        )}
        {r.days.map((day) => (
          <div key={day.id}>
            <Sec title={day.name} right={DAY_GROUP_NAMES[day.group]} />
            {day.exercises.map((p, i) => {
              const x = ex(p.exerciseId);
              const flagged = pending.some((s) => s.planId === p.id);
              const series = p.exerciseId ? exerciseSeries(d.workouts, p.exerciseId) : [];
              const last = series[series.length - 1];
              return (
                <a key={p.id} className="row num" href={p.exerciseId ? href(`/ejercicio/${p.exerciseId}`) : undefined}>
                  <span className={`small ${flagged ? 'b accent-t' : 'mute'}`}>{i + 1}</span>
                  <span className="col">
                    <span className="t">{x?.name || p.rawName}</span>
                    <span className="s">
                      {p.sets} × {p.reps}
                      {p.weight !== null ? ` · ${x?.load === 'dumbbell' ? '2 × ' : ''}${n(p.weight)} kg` : last ? ` · última vez ${n(last.weight)} kg` : ''}
                    </span>
                  </span>
                  {flagged ? <span className="xs b accent-t">Sugerencia</span> : <IcChev className="chev" />}
                </a>
              );
            })}
            <button type="button" className="txt accent" style={{ marginTop: 4 }} onClick={() => startDay(day)}>
              Empezar · {day.name}
            </button>
          </div>
        ))}
      </div>
      <ClientNav active="rutinas" />
    </div>
  );
}

export function RoutineEdit({ routineId }: { routineId: string | null }) {
  const { store } = useApp();
  const me = useMe();
  const d = useClientData(me.id, me);
  const existing = routineId ? d.mine.find((r) => r.id === routineId) : null;
  const [name, setName] = useState('');
  const [b, setB] = useState<BuilderState>(() => initBuilder());
  const [loaded, setLoaded] = useState(!routineId);
  useEffect(() => {
    if (loaded || !existing) return;
    setName(existing.name);
    setB(initBuilder(existing.days));
    setLoaded(true);
  }, [existing, loaded]);
  const lastWeight = useCallback(
    (id: string) => {
      const s = exerciseSeries(d.workouts, id);
      return s.length ? s[s.length - 1].weight : null;
    },
    [d.workouts],
  );
  if (!d.ready || !loaded) return <Loading />;
  const save = async () => {
    const days = builderDays(b, lastWeight, existing?.days);
    if (!days.length) return toast('Añade al menos un ejercicio');
    const now = Date.now();
    const r: Routine = existing
      ? { ...existing, name: name.trim() || existing.name, days, updatedAt: now }
      : {
          id: uid(),
          ownerId: me.id,
          ownerRole: 'client',
          clientId: me.id,
          trainerId: me.trainerId || null,
          name: name.trim() || days[0].name,
          days,
          template: false,
          week: 1,
          createdAt: now,
          updatedAt: now,
        };
    await store.set('routines', r.id, r);
    toast('Rutina guardada');
    go(`/rutina/${r.id}`, true);
  };
  return (
    <div className="screen">
      <TopBar
        back={existing ? `/rutina/${existing.id}` : '/rutinas'}
        backLabel={existing ? existing.name : 'Rutinas'}
        right={
          existing ? (
            <button
              type="button"
              className="txt mute"
              onClick={async () => {
                if (!confirm('¿Borrar esta rutina?')) return;
                await store.remove('routines', existing.id);
                go('/rutinas', true);
              }}
            >
              Borrar
            </button>
          ) : undefined
        }
      />
      <div className="main">
        <div className="field" style={{ marginTop: 4 }}>
          <label htmlFor="rn">Nombre de la rutina</label>
          <input id="rn" className="input" style={{ fontSize: 24, fontWeight: 500 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Sábado · Brazos" />
        </div>
        <div style={{ marginTop: 18 }}>
          <RoutineBuilder state={b} setState={setB} lastWeight={lastWeight} prevDays={existing?.days} audience="tu rutina" />
        </div>
        {me.trainerId && <p className="xs mute" style={{ marginTop: 12 }}>Tu entrenador podrá verla y sugerirte cambios; tú decides si los aceptas.</p>}
      </div>
      <div className="bottom">
        <button type="button" className="btn" onClick={save}>
          Guardar rutina
        </button>
      </div>
    </div>
  );
}
