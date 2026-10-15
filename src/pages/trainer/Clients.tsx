import { useApp, useAsync } from '../../lib/app';
import { Link } from '../../lib/router';
import { effectiveRoutine } from '../../lib/workout';
import { finished, prsInWorkout } from '../../lib/stats';
import { daysAgo, relDay } from '../../lib/util';
import { CENTERS } from '../../data/catalog';
import { Empty, ErrorBox, Loading } from '../../components/ui';
import { IconChevron } from '../../components/icons';

export function Clients() {
  const { repo, me } = useApp();
  const { data, error, loading, reload } = useAsync(async () => {
    const clients = await repo.listClients();
    return Promise.all(clients.map(async (c) => {
      const [routines, workouts] = await Promise.all([repo.listRoutines(c.id), repo.listWorkouts(c.id)]);
      const done = finished(workouts);
      const routine = effectiveRoutine(routines);
      const last = done[0];
      return {
        c,
        routine,
        last,
        idle: daysAgo(last?.startedAt),
        prs: last && (daysAgo(last.startedAt) ?? 99) <= 7 ? prsInWorkout(last, workouts).length : 0,
        unread: done.filter((w) => w.notes && !w.trainerComment && (daysAgo(w.startedAt) ?? 99) <= 14).length,
      };
    }));
  }, [me.id]);

  if (loading) return <div className="screen"><Loading /></div>;
  if (error || !data) return <div className="screen"><ErrorBox error={error!} onRetry={reload} /></div>;

  const score = (x: (typeof data)[number]) => (x.routine ? 0 : 3) + ((x.idle ?? 99) >= 7 ? 2 : 0) + (x.unread ? 1 : 0);
  const sorted = [...data].sort((a, b) => score(b) - score(a) || a.c.name.localeCompare(b.c.name));
  const center = (id: string) => CENTERS.find((c) => c.id === id)?.name.replace('On Air ', '') ?? '';

  return (
    <div className="screen">
      <h1 className="display">Clientes</h1>
      {data.length ? (
        <>
          <p className="lede">{data.length} {data.length === 1 ? 'cliente' : 'clientes'}. Arriba, los que necesitan algo de ti.</p>
          <div className="list">
            {sorted.map(({ c, routine, last, idle, prs, unread }) => (
              <Link key={c.id} to={`/client/${c.id}`} className="item">
                <div className="thumb" style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 22, color: 'var(--ink)' }}>
                  {c.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="grow">
                  <div className="name">{c.name}</div>
                  <div className="meta">{center(c.center)} · último entreno {relDay(last?.startedAt).toLowerCase()}</div>
                  <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {!routine && <span className="badge warn">Sin rutina</span>}
                    {routine?.authorRole === 'client' && <span className="badge">Rutina propia</span>}
                    {(idle ?? 99) >= 7 && <span className="badge warn">{idle == null ? 'Nunca ha entrenado' : `${idle} días sin entrenar`}</span>}
                    {prs > 0 && <span className="badge ok">{prs} {prs === 1 ? 'récord' : 'récords'}</span>}
                    {unread > 0 && <span className="badge plate">{unread} {unread === 1 ? 'nota' : 'notas'} sin responder</span>}
                  </div>
                </div>
                <IconChevron />
              </Link>
            ))}
          </div>
        </>
      ) : (
        <Empty title="Aún no tienes clientes">
          Pásales tu código <b style={{ color: 'var(--plate)' }}>{me.code}</b>. Lo escriben en su Perfil y aparecerán aquí.
        </Empty>
      )}
    </div>
  );
}
