import { useApp, useAsync } from '../lib/app';
import { Link, navigate } from '../lib/router';
import { effectiveRoutine, hasTrainerRoutine } from '../lib/workout';
import { relDay } from '../lib/util';
import type { Routine } from '../lib/types';
import { Empty, ErrorBox, Loading } from '../components/ui';
import { IconChevron, IconPlus } from '../components/icons';

/** Lista de rutinas del cliente: la del entrenador manda; la propia solo si no hay otra puesta. */
export function Routines() {
  const { repo, me } = useApp();
  const { data, error, loading, reload } = useAsync(() => repo.listRoutines(me.id), [me.id]);
  if (loading) return <div className="screen"><Loading /></div>;
  if (error || !data) return <div className="screen"><ErrorBox error={error!} onRetry={reload} /></div>;

  const blocked = hasTrainerRoutine(data);
  const current = effectiveRoutine(data);
  const sorted = [...data].sort((a, b) => Number(b.id === current?.id) - Number(a.id === current?.id) || b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="screen">
      <h1 className="display">Rutinas</h1>
      {blocked ? (
        <p className="lede">Tienes una rutina puesta por tu entrenador. Mientras esté activa, es la que sigues; puedes cambiar ejercicios en el momento si una máquina está ocupada.</p>
      ) : (
        <p className="lede">No tienes rutina del entrenador activa, así que puedes montarte la tuya. Si te pone una, pasará a ser la principal.</p>
      )}

      {!blocked && (
        <button className="btn primary block" onClick={() => navigate(`/routine/${me.id}/new`)}>
          <IconPlus size={20} /> Crear rutina
        </button>
      )}

      {sorted.length ? (
        <div className="list" style={{ marginTop: 16 }}>
          {sorted.map((r) => <RoutineRow key={r.id} r={r} current={r.id === current?.id} clientId={me.id} />)}
        </div>
      ) : (
        <Empty title="Aún no hay rutinas">Crea una por días: elige qué parte del cuerpo toca y solo verás los ejercicios de esa parte.</Empty>
      )}
    </div>
  );
}

export function RoutineRow({ r, current, clientId }: { r: Routine; current: boolean; clientId: string }) {
  return (
    <Link to={`/routine/${clientId}/${r.id}`} className="item">
      <div className="grow">
        <div className="name">{r.name}</div>
        <div className="meta">
          {r.days.length} {r.days.length === 1 ? 'día' : 'días'} · {r.authorRole === 'trainer' ? 'Del entrenador' : 'Propia'} · editada {relDay(r.updatedAt).toLowerCase()}
        </div>
        <div className="row" style={{ gap: 6, marginTop: 4 }}>
          {current && <span className="badge plate">En uso</span>}
          {r.active && !current && <span className="badge">Activa</span>}
          {!r.active && <span className="badge">Archivada</span>}
        </div>
      </div>
      <IconChevron />
    </Link>
  );
}
