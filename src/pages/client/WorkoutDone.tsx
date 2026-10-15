import { useApp, useAsync } from '../../lib/app';
import { navigate } from '../../lib/router';
import { getExercise } from '../../data/catalog';
import { prsInWorkout, workoutTotals } from '../../lib/stats';
import { fmtKg } from '../../lib/util';
import type { Workout } from '../../lib/types';
import { Empty, Loading } from '../../components/ui';
import { IconTrophy } from '../../components/icons';
import { WorkoutSets } from '../../components/WorkoutList';

export function WorkoutDone({ workoutId }: { workoutId: string }) {
  const { repo, me } = useApp();
  const { data, loading } = useAsync(async () => {
    const all = await repo.listWorkouts(me.id).catch(() => [] as Workout[]);
    let w = all.find((x) => x.id === workoutId);
    if (!w) {
      const cached = sessionStorage.getItem('gymapp.justDone');
      const parsed: Workout | null = cached ? JSON.parse(cached) : null;
      if (parsed?.id === workoutId) { w = parsed; all.push(parsed); }
    }
    return { w, all };
  }, [workoutId]);

  if (loading) return <div className="screen no-tabs"><Loading /></div>;
  const w = data?.w;
  if (!w) return <div className="screen no-tabs"><Empty title="Entreno no encontrado" action={<button className="btn" onClick={() => navigate('/')}>Ir a Hoy</button>} /></div>;

  const t = workoutTotals(w);
  const prs = prsInWorkout(w, data!.all);

  return (
    <div className="screen no-tabs">
      <h1 className="display" style={{ marginTop: 28 }}>Entreno guardado</h1>
      <p className="lede">{w.dayName}</p>
      <div className="stats3">
        <div><b>{dur(t.ms)}</b><span>{t.ms >= 3600000 ? 'horas' : 'minutos'}</span></div>
        <div><b>{t.sets}</b><span>series</span></div>
        <div><b>{t.volume >= 10000 ? `${fmtKg(Math.round(t.volume / 100) / 10)} t` : fmtKg(t.volume)}</b><span>{t.volume >= 10000 ? 'movidas' : 'kg movidos'}</span></div>
      </div>

      {prs.length > 0 && (
        <>
          <h2 className="section">Récords nuevos</h2>
          <div className="pr-list">
            {prs.map((p) => (
              <div key={p.exerciseId} className="pr">
                <IconTrophy />
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{getExercise(p.exerciseId).name}</div>
                  <div className="small muted">{p.kind === 'peso' ? 'Peso máximo' : '1RM estimado'}{p.previous ? `, antes ${fmtKg(p.previous)} kg` : ''}</div>
                </div>
                <b>{fmtKg(p.value)} kg</b>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="section">Resumen</h2>
      <WorkoutSets workout={w} />

      <div className="cta-bar"><div><button className="btn primary block" onClick={() => navigate('/', { replace: true })}>Hecho</button></div></div>
    </div>
  );
}

function dur(ms: number): string {
  const m = Math.round(ms / 60000);
  return m < 60 ? String(m) : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}
