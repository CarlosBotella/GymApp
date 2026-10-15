import { useMemo, useState } from 'react';
import { useApp, useAsync } from '../lib/app';
import { Link } from '../lib/router';
import { getEquipment, getExercise, GROUPS, MUSCLES } from '../data/catalog';
import { dayKey, exerciseHistory, finished, trainedDays, weeklySetsByGroup } from '../lib/stats';
import { fmtDate, fmtKg, weekStart } from '../lib/util';
import type { Workout } from '../lib/types';
import { Empty, ErrorBox, ExerciseThumb, Loading, TopBar } from '../components/ui';
import { LineChart } from '../components/LineChart';
import { WorkoutHistory } from '../components/WorkoutList';
import { IconChevron } from '../components/icons';

export function Progress() {
  const { repo, me, toast } = useApp();
  const { data, error, loading, reload } = useAsync(() => repo.listWorkouts(me.id), [me.id]);
  if (loading) return <div className="screen"><Loading /></div>;
  if (error || !data) return <div className="screen"><ErrorBox error={error!} onRetry={reload} /></div>;
  return (
    <div className="screen">
      <h1 className="display">Progreso</h1>
      <ProgressView clientId={me.id} workouts={data} onDelete={async (w) => { await repo.deleteWorkout(w); toast('Entreno borrado'); reload(); }} />
    </div>
  );
}

/** Bloque de progreso reutilizado por el cliente y por la ficha del entrenador. */
export function ProgressView({ clientId, workouts, onComment, onDelete }: {
  clientId: string;
  workouts: Workout[];
  onComment?(w: Workout, t: string): Promise<void>;
  onDelete?(w: Workout): Promise<void>;
}) {
  const done = finished(workouts);
  const weekly = weeklySetsByGroup(workouts);
  const maxSets = Math.max(10, ...Object.values(weekly));

  const exercises = useMemo(() => {
    const ids = new Set<string>();
    done.forEach((w) => w.entries.forEach((e) => ids.add(e.exerciseId)));
    return [...ids]
      .map((id) => ({ id, hist: exerciseHistory(workouts, id) }))
      .filter((x) => x.hist.length)
      .sort((a, b) => b.hist[b.hist.length - 1].date.localeCompare(a.hist[a.hist.length - 1].date));
  }, [workouts, done]);

  if (!done.length) {
    return <Empty title="Sin entrenos todavía">Cuando termines tu primer entreno verás aquí tus pesos, récords y constancia.</Empty>;
  }

  return (
    <>
      <h2 className="section">Constancia <small>últimas 12 semanas</small></h2>
      <Heatmap workouts={workouts} />

      <h2 className="section">Series esta semana</h2>
      <div className="bars">
        {GROUPS.filter((g) => g.id !== 'cardio' || weekly.cardio).map((g) => (
          <div key={g.id} className="b">
            <span>{g.name}</span>
            <div className="track"><div className="fill" style={{ width: `${(weekly[g.id] / maxSets) * 100}%` }} /></div>
            <span className="val">{weekly[g.id]}</span>
          </div>
        ))}
      </div>
      <p className="muted small">Para ganar músculo suele recomendarse entre 10 y 20 series semanales por grupo.</p>

      <h2 className="section">Ejercicios</h2>
      <div className="list">
        {exercises.map(({ id, hist }) => {
          const ex = getExercise(id);
          const last = hist[hist.length - 1];
          const first = hist[0];
          const diff = last.topWeight != null && first.topWeight != null ? last.topWeight - first.topWeight : null;
          return (
            <Link key={id} to={`/progress/${clientId}/${id}`} className="item">
              <ExerciseThumb exerciseId={id} />
              <div className="grow">
                <div className="name">{ex.name}</div>
                <div className="meta">
                  {last.topWeight != null ? `${fmtKg(last.topWeight)} kg` : `${last.totalReps} reps`} · {hist.length} {hist.length === 1 ? 'sesión' : 'sesiones'}
                  {diff ? <span style={{ color: diff > 0 ? 'var(--ok)' : 'var(--danger)' }}> · {diff > 0 ? '+' : ''}{fmtKg(diff)} kg</span> : null}
                </div>
              </div>
              <IconChevron />
            </Link>
          );
        })}
      </div>

      <h2 className="section">Historial</h2>
      <WorkoutHistory workouts={workouts} onComment={onComment} onDelete={onDelete} />
    </>
  );
}

function Heatmap({ workouts }: { workouts: Workout[] }) {
  const days = trainedDays(workouts);
  const start = weekStart(new Date());
  start.setDate(start.getDate() - 7 * 11);
  const todayKey = dayKey(new Date());
  const cells = [];
  let count = 0;
  for (let i = 0; i < 84; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = dayKey(d);
    const on = days.has(k);
    if (on) count++;
    cells.push(<i key={k} className={(on ? 'on' : '') + (k === todayKey ? ' today' : '')} title={`${fmtDate(d.toISOString())}${on ? ': entrenado' : ''}`} />);
  }
  return (
    <>
      <div className="heat" role="img" aria-label={`${count} días entrenados en las últimas 12 semanas`}>{cells}</div>
      <p className="muted small">{count} días entrenados. Cada columna es una semana, de lunes a domingo.</p>
    </>
  );
}

export function ExerciseProgress({ clientId, exerciseId }: { clientId: string; exerciseId: string }) {
  const { repo } = useApp();
  const { data, error, loading, reload } = useAsync(() => repo.listWorkouts(clientId), [clientId]);
  const [metric, setMetric] = useState<'top' | 'e1rm' | 'volume'>('top');
  const ex = getExercise(exerciseId);
  const eq = getEquipment(ex.equipmentId);

  if (loading) return <div className="screen"><TopBar /><Loading /></div>;
  if (error || !data) return <div className="screen"><TopBar /><ErrorBox error={error!} onRetry={reload} /></div>;

  const hist = exerciseHistory(data, exerciseId);
  const weighted = ex.logType === 'weight_reps';
  const series = hist
    .map((h) => ({ date: h.date, value: (metric === 'top' ? h.topWeight : metric === 'e1rm' ? h.bestE1rm : h.volume) ?? 0 }))
    .filter((p) => p.value > 0);
  const bestTop = Math.max(0, ...hist.map((h) => h.topWeight ?? 0));
  const bestE = Math.max(0, ...hist.map((h) => h.bestE1rm ?? 0));

  return (
    <div className="screen">
      <TopBar title={ex.name} />
      <h1 className="display" style={{ fontSize: 34 }}>{ex.name}</h1>
      <p className="lede">
        {MUSCLES[ex.primary]}{ex.secondary.length ? ` (también ${ex.secondary.map((m) => MUSCLES[m].toLowerCase()).join(', ')})` : ''}
        {eq && eq.kind !== 'bodyweight' ? ` · ${[eq.brand, eq.model ?? eq.name].filter(Boolean).join(' ')}` : ''}
      </p>

      {!hist.length ? (
        <Empty title="Sin registros">Todavía no hay series de este ejercicio.</Empty>
      ) : (
        <>
          {weighted && (
            <div className="stats3">
              <div><b>{fmtKg(bestTop)}</b><span>kg máximo</span></div>
              <div><b>{fmtKg(bestE)}</b><span>1RM estimado</span></div>
              <div><b>{hist.length}</b><span>sesiones</span></div>
            </div>
          )}
          {weighted && (
            <>
              <div className="segmented" style={{ marginTop: 18 }}>
                <button aria-pressed={metric === 'top'} onClick={() => setMetric('top')}>Peso máx.</button>
                <button aria-pressed={metric === 'e1rm'} onClick={() => setMetric('e1rm')}>1RM est.</button>
                <button aria-pressed={metric === 'volume'} onClick={() => setMetric('volume')}>Volumen</button>
              </div>
              <h2 className="section" style={{ marginTop: 16 }}>
                {metric === 'top' ? 'Peso máximo por sesión' : metric === 'e1rm' ? '1RM estimado por sesión' : 'Volumen por sesión (kg × reps)'}
              </h2>
              {series.length ? <LineChart points={series} label={ex.name} /> : <p className="muted">Sin datos para esta métrica.</p>}
            </>
          )}

          <h2 className="section">Sesiones</h2>
          <div className="list">
            {[...hist].reverse().map((h) => (
              <div key={h.workoutId} className="item" style={{ display: 'block' }}>
                <div className="row">
                  <span className="name grow">{fmtDate(h.date)}</span>
                  {h.topWeight != null && <span className="muted small">máx. {fmtKg(h.topWeight)} kg</span>}
                </div>
                <div className="meta">
                  {h.sets.map((s) => weighted ? `${fmtKg(s.weight)}×${s.reps ?? '–'}` : ex.logType === 'cardio' ? `${Math.round((s.seconds ?? 0) / 60)} min${s.km ? ` ${fmtKg(s.km)} km` : ''}` : ex.logType === 'time' ? `${s.seconds} s` : `${s.reps} reps`).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
