import { useApp, useAsync } from '../../lib/app';
import { Link, navigate } from '../../lib/router';
import { effectiveRoutine } from '../../lib/workout';
import { finished } from '../../lib/stats';
import { relDay, repsLabel } from '../../lib/util';
import { getExercise } from '../../data/catalog';
import { Empty, ErrorBox, Loading, TopBar } from '../../components/ui';
import { IconPlus } from '../../components/icons';
import { RoutineRow } from '../Routines';
import { ProgressView } from '../Progress';

export function ClientDetail({ clientId, tab }: { clientId: string; tab: string }) {
  const { repo, toast } = useApp();
  const { data, error, loading, reload } = useAsync(async () => {
    const [client, routines, workouts] = await Promise.all([repo.getProfile(clientId), repo.listRoutines(clientId), repo.listWorkouts(clientId)]);
    return { client, routines, workouts };
  }, [clientId]);

  if (loading) return <div className="screen"><TopBar backTo="/" /><Loading /></div>;
  if (error || !data) return <div className="screen"><TopBar backTo="/" /><ErrorBox error={error!} onRetry={reload} /></div>;
  if (!data.client) return <div className="screen"><TopBar backTo="/" /><Empty title="Cliente no encontrado">Puede que se haya desvinculado.</Empty></div>;

  const { client, routines, workouts } = data;
  const current = effectiveRoutine(routines);
  const last = finished(workouts)[0];
  const setTab = (t: string) => navigate(`/client/${clientId}?tab=${t}`, { replace: true });

  return (
    <div className="screen">
      <TopBar backTo="/" title={client.name} />
      <h1 className="display">{client.name}</h1>
      <p className="lede">Último entreno: {relDay(last?.startedAt).toLowerCase()}{last ? ` (${last.dayName})` : ''}</p>

      <div className="segmented">
        <button aria-pressed={tab === 'routine'} onClick={() => setTab('routine')}>Rutina</button>
        <button aria-pressed={tab === 'progress'} onClick={() => setTab('progress')}>Entrenos y progreso</button>
      </div>

      {tab === 'progress' ? (
        <ProgressView
          clientId={clientId}
          workouts={workouts}
          onComment={async (w, text) => { await repo.commentWorkout(w, text); toast('Comentario guardado'); reload(); }}
        />
      ) : (
        <>
          {current ? (
            <>
              <h2 className="section">
                {current.name}
                <small>{current.authorRole === 'client' ? 'Hecha por el cliente' : 'Puesta por ti'}</small>
              </h2>
              {current.authorRole === 'client' && (
                <p className="muted small" style={{ marginTop: 0 }}>Se la ha montado {client.name}. Puedes corregirla o ponerle una tuya, que pasará a mandar.</p>
              )}
              <div className="list">
                {current.days.map((d, i) => (
                  <div key={d.id} className="item" style={{ display: 'block' }}>
                    <div className="name">{i + 1}. {d.name}</div>
                    <div className="meta">{d.exercises.map((e) => `${getExercise(e.exerciseId).name} (${repsLabel(e.sets)})`).join(' · ') || 'Sin ejercicios'}</div>
                  </div>
                ))}
              </div>
              <Link to={`/routine/${clientId}/${current.id}`} className="btn block" style={{ marginTop: 12 }}>Editar rutina</Link>
            </>
          ) : (
            <Empty title="Sin rutina activa">Ponle una rutina: podrás partir de una plantilla o copiar la de otro cliente.</Empty>
          )}

          <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => navigate(`/routine/${clientId}/new`)}>
            <IconPlus size={20} /> Nueva rutina para {client.name}
          </button>

          {routines.length > 1 && (
            <>
              <h2 className="section">Todas sus rutinas</h2>
              <div className="list">
                {routines.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((r) => <RoutineRow key={r.id} r={r} current={r.id === current?.id} clientId={clientId} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
