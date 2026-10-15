import { useState } from 'react';
import { useApp } from '../lib/app';
import { Link } from '../lib/router';
import { CENTERS, EQUIPMENT, EXERCISES, filterExercises, getEquipment, GROUPS, MUSCLES } from '../data/catalog';
import type { CenterId, EquipmentKind, GroupId } from '../lib/types';
import { ExerciseThumb } from '../components/ui';
import { EquipmentGlyph, IconChevron } from '../components/icons';

const KIND_NAMES: Record<EquipmentKind, string> = {
  plate_loaded: 'Máquinas de discos',
  selectorized: 'Máquinas de placas',
  cable: 'Poleas',
  smith: 'Smith',
  free_weight: 'Peso libre',
  bench: 'Bancos',
  bodyweight: 'Peso corporal',
  cardio: 'Cardio',
};

export function Catalog() {
  const { me } = useApp();
  const [view, setView] = useState<'ex' | 'eq'>('ex');
  const [center, setCenter] = useState<CenterId | 'all'>(me.center);
  const [group, setGroup] = useState<GroupId>('pierna');
  const [q, setQ] = useState('');

  const c = center === 'all' ? null : center;
  const exs = filterExercises({ groups: q ? undefined : [group], center: c, query: q });
  const eqs = EQUIPMENT.filter((e) => !c || e.centers.includes(c));
  const kinds = [...new Set(eqs.map((e) => e.kind))];

  return (
    <div className="screen">
      <h1 className="display">Máquinas</h1>
      <p className="lede">{EQUIPMENT.length} equipos y {EXERCISES.length} ejercicios de los centros On Air.</p>

      <div className="segmented">
        <button aria-pressed={view === 'ex'} onClick={() => setView('ex')}>Por músculo</button>
        <button aria-pressed={view === 'eq'} onClick={() => setView('eq')}>Por máquina</button>
      </div>
      <div className="chips" style={{ marginTop: 12 }}>
        <button className="chip" aria-pressed={center === 'all'} onClick={() => setCenter('all')}>Todos los centros</button>
        {CENTERS.map((x) => (
          <button key={x.id} className="chip" aria-pressed={center === x.id} onClick={() => setCenter(x.id)}>{x.name.replace('On Air ', '')}</button>
        ))}
      </div>

      {view === 'ex' ? (
        <>
          <input className="input" style={{ marginTop: 8 }} placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
          {!q && (
            <div className="chips" style={{ marginTop: 10 }}>
              {GROUPS.map((g) => <button key={g.id} className="chip" aria-pressed={group === g.id} onClick={() => setGroup(g.id)}>{g.name}</button>)}
            </div>
          )}
          <div className="list" style={{ marginTop: 6 }}>
            {exs.map((ex) => {
              const eq = getEquipment(ex.equipmentId);
              const inner = (
                <>
                  <ExerciseThumb exerciseId={ex.id} />
                  <div className="grow">
                    <div className="name">{ex.name}</div>
                    <div className="meta">{MUSCLES[ex.primary]}{eq && eq.kind !== 'bodyweight' ? ` · ${[eq.brand, eq.name].filter(Boolean).join(' ')}` : ''}</div>
                  </div>
                </>
              );
              return me.role === 'client' ? (
                <Link key={ex.id} to={`/progress/${me.id}/${ex.id}`} className="item">{inner}<IconChevron /></Link>
              ) : (
                <div key={ex.id} className="item">{inner}</div>
              );
            })}
          </div>
          {!exs.length && <p className="muted">No hay nada con ese filtro.</p>}
        </>
      ) : (
        kinds.map((k) => (
          <section key={k}>
            <h2 className="section">{KIND_NAMES[k]}</h2>
            <div className="list">
              {eqs.filter((e) => e.kind === k).map((e) => (
                <div key={e.id} className="item">
                  <div className="thumb"><EquipmentGlyph kind={e.kind} /></div>
                  <div className="grow">
                    <div className="name">{e.name}</div>
                    <div className="meta">
                      {[e.brand, e.model].filter(Boolean).join(' · ') || 'Genérica'}
                      {' · '}
                      {e.centers.length === CENTERS.length ? 'Ambos centros' : CENTERS.filter((x) => e.centers.includes(x.id)).map((x) => x.name.replace('On Air ', '')).join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
