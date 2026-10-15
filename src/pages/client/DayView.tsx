import { useState } from 'react';
import { useApp, useAsync } from '../../lib/app';
import { Link, navigate } from '../../lib/router';
import { getExercise, MUSCLES } from '../../data/catalog';
import { lastPerformance } from '../../lib/stats';
import { loadDraft, saveDraft, startFromDay } from '../../lib/workout';
import { fmtKg, repsLabel, setsLabel } from '../../lib/util';
import { Empty, ErrorBox, ExerciseThumb, Loading, Sheet, TopBar } from '../../components/ui';
import { IconChevron } from '../../components/icons';

export function DayView({ routineId, dayId }: { routineId: string; dayId: string }) {
  const { repo, me } = useApp();
  const { data, error, loading, reload } = useAsync(async () => {
    const [routines, workouts] = await Promise.all([repo.listRoutines(me.id), repo.listWorkouts(me.id)]);
    return { routine: routines.find((r) => r.id === routineId) ?? null, workouts };
  }, [routineId]);
  const [conflict, setConflict] = useState(false);

  if (loading) return <div className="screen"><Loading /></div>;
  if (error || !data) return <div className="screen"><ErrorBox error={error!} onRetry={reload} /></div>;
  const routine = data.routine;
  const day = routine?.days.find((d) => d.id === dayId);
  if (!routine || !day) return <div className="screen"><TopBar /><Empty title="Este día ya no existe">Puede que tu entrenador haya cambiado la rutina.</Empty></div>;

  function start(force = false) {
    const draft = loadDraft(me.id);
    if (draft && !force) return setConflict(true);
    saveDraft(me.id, startFromDay(me.id, routine!, day!, data!.workouts));
    navigate('/workout');
  }

  return (
    <div className="screen">
      <TopBar backTo="/" />
      <h1 className="display">{day.name}</h1>
      {day.description && <p className="lede">{day.description}</p>}

      <div className="list" style={{ marginTop: 16 }}>
        {day.exercises.map((re) => {
          const ex = getExercise(re.exerciseId);
          const last = lastPerformance(data.workouts, re.exerciseId);
          const top = last ? Math.max(...last.sets.map((s) => s.weight ?? 0)) : 0;
          return (
            <Link key={re.uid} to={`/progress/${me.id}/${re.exerciseId}`} className="item">
              <ExerciseThumb exerciseId={re.exerciseId} large />
              <div className="grow">
                <div className="name">{ex.name}</div>
                <div className="meta">{setsLabel(re.sets)} · {repsLabel(re.sets)}</div>
                <div className="meta">{top ? `Última vez hasta ${fmtKg(top)} kg` : MUSCLES[ex.primary]}</div>
                {me.exerciseNotes[re.exerciseId] && <div className="meta" style={{ color: 'var(--plate)' }}>{me.exerciseNotes[re.exerciseId]}</div>}
              </div>
              <IconChevron />
            </Link>
          );
        })}
      </div>
      {!day.exercises.length && <Empty title="Día vacío">Este día todavía no tiene ejercicios.</Empty>}

      <div style={{ height: 84 }} />
      <div className="cta-bar"><div><button className="btn primary block" onClick={() => start()}>Iniciar entrenamiento</button></div></div>

      <Sheet open={conflict} onClose={() => setConflict(false)} title="Tienes un entreno abierto">
        <p className="lede">Si empiezas este, se descarta el que tienes a medias sin guardar.</p>
        <div className="stack">
          <button className="btn primary" onClick={() => navigate('/workout')}>Continuar el abierto</button>
          <button className="btn danger" onClick={() => start(true)}>Descartar y empezar {day.name}</button>
        </div>
      </Sheet>
    </div>
  );
}
