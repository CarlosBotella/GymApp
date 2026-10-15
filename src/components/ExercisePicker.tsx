import { useEffect, useMemo, useState } from 'react';
import { filterExercises, getEquipment, GROUPS, MUSCLES } from '../data/catalog';
import type { CenterId, Exercise, GroupId, MuscleId } from '../lib/types';
import { ExerciseThumb, Sheet } from './ui';

/**
 * Selector de ejercicios: primero la parte del cuerpo, luego el músculo.
 * Si hoy toca pierna, solo salen máquinas y ejercicios de pierna.
 */
export function ExercisePicker({
  open, onClose, onPick, groups, center, title = 'Añadir ejercicio', only,
}: {
  open: boolean;
  onClose(): void;
  onPick(ex: Exercise): void;
  /** Partes del cuerpo del día; si se pasa, el filtro arranca ahí. */
  groups?: GroupId[];
  center?: CenterId | null;
  title?: string;
  /** Lista cerrada (p. ej. alternativas para sustituir). */
  only?: Exercise[];
}) {
  const [group, setGroup] = useState<GroupId | 'all'>('all');
  const [muscle, setMuscle] = useState<MuscleId | null>(null);
  const [q, setQ] = useState('');
  const [allCenters, setAllCenters] = useState(false);
  const [anyGroup, setAnyGroup] = useState(false);

  useEffect(() => {
    if (open) {
      setGroup(groups?.length === 1 ? groups[0] : 'all');
      setMuscle(null);
      setQ('');
      setAnyGroup(false);
    }
  }, [open, groups]);

  const limited = Boolean(groups?.length) && !anyGroup;
  const dayGroups = useMemo(() => (limited ? GROUPS.filter((g) => groups!.includes(g.id)) : GROUPS), [limited, groups]);
  const list = useMemo(() => {
    if (only) return only;
    const gs = group === 'all' ? dayGroups.map((g) => g.id) : [group];
    return filterExercises({ groups: gs, muscle, center: allCenters ? null : center, query: q });
  }, [only, group, muscle, q, center, allCenters, dayGroups]);

  const muscles = group === 'all' ? [] : GROUPS.find((g) => g.id === group)!.muscles;

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {!only && (
        <div className="sheet-head">
          <input className="input" placeholder="Buscar ejercicio o máquina" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips" style={{ marginTop: 10 }}>
            {dayGroups.length > 1 && (
              <button className="chip" aria-pressed={group === 'all'} onClick={() => { setGroup('all'); setMuscle(null); }}>
                {limited ? 'Todo el día' : 'Todo'}
              </button>
            )}
            {dayGroups.map((g) => (
              <button key={g.id} className="chip" aria-pressed={group === g.id} onClick={() => { setGroup(g.id); setMuscle(null); }}>
                {g.name}
              </button>
            ))}
            {limited && (
              <button className="chip" onClick={() => { setAnyGroup(true); setGroup('all'); setMuscle(null); }}>Otra parte…</button>
            )}
          </div>
          {muscles.length > 1 && (
            <div className="chips">
              {muscles.map((m) => (
                <button key={m} className="chip" aria-pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
                  {MUSCLES[m]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="list" style={{ marginTop: 6 }}>
        {list.map((ex) => {
          const eq = getEquipment(ex.equipmentId);
          return (
            <button key={ex.id} className="item" onClick={() => { onPick(ex); onClose(); }}>
              <ExerciseThumb exerciseId={ex.id} />
              <div className="grow">
                <div className="name">{ex.name}</div>
                <div className="meta">
                  {MUSCLES[ex.primary]}
                  {eq && eq.kind !== 'bodyweight' ? ` · ${eq.brand ? eq.brand + ' ' : ''}${eq.name}` : ''}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {!list.length && (
        <div className="empty">
          <p>No hay ejercicios con ese filtro{center && !allCenters ? ' en tu centro' : ''}.</p>
        </div>
      )}
      {!only && center && (
        <label className="row small muted" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={allCenters} onChange={(e) => setAllCenters(e.target.checked)} />
          Mostrar también máquinas de otros centros
        </label>
      )}
    </Sheet>
  );
}
