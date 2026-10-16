import { EMPTY_FILTERS, matchesFilters } from '../../data/free-exercises';
import { ExerciseFilters } from '../../ui/exercise-filters';
import { ExerciseThumb } from '../../ui/exercise-media';
import { href } from '../../lib/router';
import { useState } from 'react';
import { EXERCISES, GROUP_NAMES, ex, searchCatalog } from '../../data/catalog';
import { findExercise } from '../../lib/quicknotes';
import { useApp, useMe } from '../../lib/app';
import type { GroupId } from '../../lib/types';
import { norm } from '../../lib/util';
import { IcDown, IcSearch, IcUp } from '../../ui/icons';
import { Loading, Seg, Sheet, Switch, TrainerNav, toast } from '../../ui/kit';
import { useTrainerData } from './data';

export function Exercises() {
  const { store } = useApp();
  const me = useMe();
  const td = useTrainerData();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [limit, setLimit] = useState(60);
  const [g, setG] = useState<'all' | GroupId>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [assign, setAssign] = useState<{ routineId: string; planId: string; raw: string } | null>(null);
  const [pickQ, setPickQ] = useState('');
  if (!td.ready) return <Loading />;
  const approved = me.approvedAlts || {};
  const altsOf = (id: string) => approved[id] ?? ex(id)?.alts ?? [];
  const toggle = (id: string, alt: string, on: boolean) => {
    const cur = altsOf(id);
    const next = on ? [...new Set([...cur, alt])] : cur.filter((a) => a !== alt);
    void store.update('users', me.id, { approvedAlts: { ...approved, [id]: next } });
  };
  // Lo que necesita su ojo: nombres sin reconocer en sus rutinas y alternativas que se usan sin estar aprobadas
  const unknown = td.routines
    .filter((r) => r.ownerId === me.id)
    .flatMap((r) => r.days.flatMap((d) => d.exercises.filter((p) => !p.exerciseId).map((p) => ({ r, d, p }))));
  const unapproved: { from: string; to: string; who: string; times: number }[] = [];
  for (const w of td.workouts.slice(-60)) {
    for (const e of w.entries) {
      if (!e.substituteOf || !e.exerciseId) continue;
      if (altsOf(e.substituteOf).includes(e.exerciseId)) continue;
      const k = unapproved.find((u) => u.from === e.substituteOf && u.to === e.exerciseId);
      if (k) k.times++;
      else unapproved.push({ from: e.substituteOf, to: e.exerciseId, who: td.clients.find((c) => c.id === w.clientId)?.name || 'Un cliente', times: 1 });
    }
  }
  const list = searchCatalog(q, g).filter((x) => matchesFilters(x, filters));
  return (
    <div className="screen with-nav">
      <div className="topbar">
        <span className="meta">Catálogo de ejercicios</span>
      </div>
      <div className="pad">
        <h1 className="h1" style={{ marginTop: 4 }}>Ejercicios</h1>
      </div>
      <div className="main" style={{ paddingTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--ink)', color: 'var(--mute)' }}>
          <IcSearch />
          <label htmlFor="eq" className="sr">Buscar ejercicio</label>
          <input id="eq" type="search" placeholder="Buscar por nombre o apodo" value={q} onChange={(e) => { setQ(e.target.value); setLimit(60); }} style={{ flex: '1 1 auto', minWidth: 0, height: 44, border: 0, background: 'transparent', fontSize: 16, outline: 'none' }} />
        </div>
        <div style={{ marginTop: 4 }}>
          <Seg value={g} onChange={(v) => { setG(v); setLimit(60); }} label="Grupo" options={[['all', 'Todos'], ...(Object.entries(GROUP_NAMES) as [GroupId, string][])]} />
        </div>

        <ExerciseFilters value={filters} onChange={(v) => { setFilters(v); setLimit(60); }} />
        <p className="xs mute">{list.length} resultados · catálogo gratuito · sin suscripciones</p>

        {(unknown.length > 0 || unapproved.length > 0) && (
          <>
            <div className="sec" style={{ marginTop: 18 }}>
              <span className="kicker">Necesitan tu ojo</span>
              <span>{unknown.length + unapproved.length}</span>
            </div>
            {unknown.slice(0, 5).map(({ r, p }) => (
              <div key={p.id} className="row" style={{ minHeight: 62 }}>
                <span className="col">
                  <span className="t">«{p.rawName}» no se reconoció</span>
                  <span className="s">Escrito en {r.name}</span>
                </span>
                <button type="button" className="btn2 sm" onClick={() => (setAssign({ routineId: r.id, planId: p.id, raw: p.rawName || '' }), setPickQ(p.rawName || ''))}>
                  Asignar
                </button>
              </div>
            ))}
            {unapproved.slice(0, 5).map((u) => (
              <div key={u.from + u.to} className="row" style={{ minHeight: 62 }}>
                <span className="col">
                  <span className="t">{ex(u.to)?.name} en vez de {ex(u.from)?.name?.toLowerCase()}</span>
                  <span className="s">
                    {u.who} la usó {u.times} {u.times === 1 ? 'vez' : 'veces'} sin aprobar
                  </span>
                </span>
                <button type="button" className="btn2 sm accent" onClick={() => (toggle(u.from, u.to, true), toast('Alternativa aprobada'))}>
                  Aprobar
                </button>
              </div>
            ))}
          </>
        )}

        <div className="sec" style={{ marginTop: 22 }}>
          <span className="kicker">Catálogo · {EXERCISES.length}</span>
          <span>toca para ver alternativas</span>
        </div>
        {list.slice(0, limit).map((x) => {
          const isOpen = open === x.id;
          const cur = altsOf(x.id);
          const candidates = [...new Set([...x.alts, ...cur])];
          return (
            <div key={x.id} style={{ borderBottom: '1px solid var(--line)' }}>
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : x.id)} className="row" style={{ borderBottom: 0, minHeight: 54 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <ExerciseThumb exercise={x} />
                  <span className="col">
                  <span className="t" style={{ fontWeight: isOpen ? 600 : 500 }}>{x.name}</span>
                  <span className="s">
                    {GROUP_NAMES[x.group]} · {x.equipment.toLowerCase()} · {cur.length} alt.
                  </span>
                </span>
                </span>
                {isOpen ? <IcUp /> : <IcDown />}
              </button>
              {isOpen && (
                <div style={{ paddingBottom: 10 }}>
                  {candidates.map((a) => (
                    <div key={a} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
                      <span style={{ fontSize: 15 }}>{ex(a)?.name}</span>
                      <Switch on={cur.includes(a)} onChange={(v) => toggle(x.id, a, v)} label={`Aprobar ${ex(a)?.name}`} />
                    </div>
                  ))}
                  {!candidates.length && <p className="xs mute">Sin alternativas aprobadas para este ejercicio.</p>}
                  <a className="txt accent" href={href(`/ejercicio/${x.id}`)}>Ver imágenes e instrucciones</a>
                </div>
              )}
            </div>
          );
        })}
        {!list.length && <p className="small mute">No hay ejercicios con estos filtros.</p>}
        {list.length > limit && <button type="button" className="btn2" onClick={() => setLimit(limit + 60)}>Ver 60 más ({list.length - limit} restantes)</button>}
      </div>
      <TrainerNav active="ejercicios" />
      {assign && (
        <Sheet label="Asignar ejercicio" onClose={() => setAssign(null)}>
          <h2 className="h2" style={{ margin: '16px 0 4px', fontSize: 24 }}>¿Qué es «{assign.raw}»?</h2>
          <label htmlFor="pq" className="sr">Buscar</label>
          <input id="pq" className="input" value={pickQ} onChange={(e) => setPickQ(e.target.value)} autoFocus />
          {(findExercise(pickQ).length ? findExercise(pickQ).map((m) => m.exercise) : EXERCISES.filter((x) => norm(x.name).includes(norm(pickQ)))).slice(0, 6).map((x) => (
            <button
              key={x.id}
              type="button"
              className="row"
              onClick={async () => {
                const r = td.routines.find((y) => y.id === assign.routineId)!;
                const days = r.days.map((d) => ({ ...d, exercises: d.exercises.map((p) => (p.id === assign.planId ? { ...p, exerciseId: x.id, rawName: undefined } : p)) }));
                await store.update('routines', r.id, { days, updatedAt: Date.now() });
                setAssign(null);
                toast(`Asignado a ${x.name}`);
              }}
            >
              <span className="col">
                <span className="t">{x.name}</span>
                <span className="s">{x.equipment}</span>
              </span>
              <span />
            </button>
          ))}
        </Sheet>
      )}
    </div>
  );
}
