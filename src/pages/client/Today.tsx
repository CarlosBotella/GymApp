import { useEffect, useMemo, useState } from 'react';
import { useApp, useAsync } from '../../lib/app';
import { Link, navigate } from '../../lib/router';
import { GROUPS } from '../../data/catalog';
import { effectiveRoutine, loadDraft, pendingWorkouts, saveDraft, setPending, startFree } from '../../lib/workout';
import { finished, streakWeeks } from '../../lib/stats';
import { fmtDuration, relDay, weekStart } from '../../lib/util';
import type { GroupId, Routine, Workout } from '../../lib/types';
import { Empty, ErrorBox, Loading, Sheet } from '../../components/ui';
import { IconChevron } from '../../components/icons';

export function Today() {
  const { repo, me, toast } = useApp();
  const { data, error, loading, reload } = useAsync(async () => {
    const [routines, workouts, trainer] = await Promise.all([
      repo.listRoutines(me.id),
      repo.listWorkouts(me.id),
      me.trainerId ? repo.getProfile(me.trainerId).catch(() => null) : Promise.resolve(null),
    ]);
    return { routines, workouts, trainer };
  }, [me.id, me.trainerId]);
  const draft = loadDraft(me.id);
  const [freeOpen, setFreeOpen] = useState(false);

  // Reintenta subir entrenos que se quedaron sin guardar.
  useEffect(() => {
    const pending = pendingWorkouts(me.id);
    if (!pending.length) return;
    (async () => {
      const left = [];
      for (const w of pending) {
        try { await repo.saveWorkout(w); } catch { left.push(w); }
      }
      setPending(me.id, left);
      if (left.length < pending.length) { toast('Entrenos pendientes guardados'); reload(); }
    })();
  }, [repo, me.id, toast, reload]);

  if (loading) return <div className="screen"><Loading /></div>;
  if (error || !data) return <div className="screen"><ErrorBox error={error!} onRetry={reload} /></div>;

  const routine = effectiveRoutine(data.routines);
  const done = finished(data.workouts);
  const thisWeek = done.filter((w) => new Date(w.startedAt) >= weekStart(new Date())).length;

  return (
    <div className="screen">
      <h1 className="display">Hola, {me.name.split(' ')[0] || 'campeón'}</h1>
      <p className="lede">{todayLabel()}</p>

      {draft && (
        <Link to="/workout" className="resume">
          <div className="grow">
            <strong>Continuar entreno</strong>
            {draft.workout.dayName} · empezado hace {fmtDuration(Date.now() - new Date(draft.workout.startedAt).getTime())}
          </div>
          <IconChevron />
        </Link>
      )}

      <div className="stats3" style={{ marginTop: 12 }}>
        <div><b>{thisWeek}</b><span>esta semana</span></div>
        <div><b>{streakWeeks(data.workouts)}</b><span>semanas seguidas</span></div>
        <div><b style={{ fontSize: 22, lineHeight: 1.36 }}>{relDay(done[0]?.startedAt)}</b><span>último entreno</span></div>
      </div>

      {routine ? (
        <RoutineWeek routine={routine} workouts={data.workouts} trainerName={data.trainer?.name} />
      ) : (
        <Empty
          title="Sin rutina activa"
          action={<button className="btn primary" onClick={() => navigate(`/routine/${me.id}/new`)}>Crear mi rutina</button>}
        >
          {me.trainerId
            ? `${data.trainer?.name ?? 'Tu entrenador'} aún no te ha puesto rutina. Mientras tanto puedes crear la tuya.`
            : 'Crea tu rutina o vincúlate con tu entrenador desde Perfil para que te la ponga él.'}
        </Empty>
      )}

      <h2 className="section">Entreno libre</h2>
      <p className="lede small">Elige qué toca hoy y te enseñamos solo las máquinas de esa parte.</p>
      <button className="btn block" onClick={() => {
        if (draft) return navigate('/workout');
        setFreeOpen(true);
      }}>Empezar entreno libre</button>

      <FreeSheet open={freeOpen} onClose={() => setFreeOpen(false)} onStart={(groups) => {
        const name = groups.map((g) => GROUPS.find((x) => x.id === g)!.name).join(' + ');
        saveDraft(me.id, startFree(me.id, groups, name));
        navigate('/workout');
      }} />
    </div>
  );
}

function nextDayId(routine: Routine, workouts: Workout[]): string | null {
  const last = finished(workouts).find((w) => w.routineId === routine.id && w.dayId);
  if (!last) return routine.days[0]?.id ?? null;
  const i = routine.days.findIndex((d) => d.id === last.dayId);
  return routine.days[(i + 1) % routine.days.length]?.id ?? null;
}

function RoutineWeek({ routine, workouts, trainerName }: { routine: Routine; workouts: Workout[]; trainerName?: string }) {
  const next = useMemo(() => nextDayId(routine, workouts), [routine, workouts]);
  const lastByDay = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of finished(workouts)) if (w.dayId && !m.has(w.dayId)) m.set(w.dayId, w.startedAt);
    return m;
  }, [workouts]);

  return (
    <>
      <h2 className="section">
        {routine.name}
        <small>{routine.authorRole === 'trainer' ? `De ${trainerName ?? 'tu entrenador'}` : 'Tu rutina'}</small>
      </h2>
      <div className="week">
        {routine.days.map((d, i) => (
          <Link key={d.id} to={`/day/${routine.id}/${d.id}`} className={d.id === next ? 'next' : ''}>
            <span className="num">{i + 1}</span>
            <span>
              <span className="dname">{d.name}</span>
              <span className="dmeta" style={{ display: 'block' }}>
                {d.exercises.length} ejercicios · {d.id === next ? <span className="badge plate">Te toca</span> : lastByDay.has(d.id) ? relDay(lastByDay.get(d.id)) : 'Sin hacer'}
              </span>
            </span>
            <IconChevron />
          </Link>
        ))}
      </div>
    </>
  );
}

function FreeSheet({ open, onClose, onStart }: { open: boolean; onClose(): void; onStart(g: GroupId[]): void }) {
  const [sel, setSel] = useState<GroupId[]>([]);
  useEffect(() => { if (open) setSel([]); }, [open]);
  const toggle = (g: GroupId) => setSel(sel.includes(g) ? sel.filter((x) => x !== g) : [...sel, g]);
  return (
    <Sheet open={open} onClose={onClose} title="¿Qué toca hoy?">
      <div className="chips wrap">
        {GROUPS.map((g) => (
          <button key={g.id} className="chip" aria-pressed={sel.includes(g.id)} onClick={() => toggle(g.id)}>{g.name}</button>
        ))}
      </div>
      <button className="btn primary block" style={{ marginTop: 18 }} disabled={!sel.length} onClick={() => { onStart(sel); onClose(); }}>
        Empezar
      </button>
    </Sheet>
  );
}


function todayLabel() {
  const s = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
