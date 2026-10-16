import { EMPTY_FILTERS, matchesFilters } from '../../data/free-exercises';
import { ExerciseFilters } from '../../ui/exercise-filters';
import { ExerciseThumb } from '../../ui/exercise-media';
import { useMemo, useState } from 'react';
import { DAY_GROUP_NAMES, GROUP_NAMES, LOAD_LABEL, ex, inferDayGroup, searchCatalog } from '../../data/catalog';
import { BASES } from '../../data/templates';
import { useApp } from '../../lib/app';
import { buildDraft, toNotes } from '../../lib/quicknotes';
import type { GroupId, PlanExercise, RoutineDay } from '../../lib/types';
import { clone, n, uid } from '../../lib/util';
import { IcArrowDown, IcArrowUp, IcCheck, IcPlus, IcSearch } from '../../ui/icons';
import { Seg, Sheet, Stepper } from '../../ui/kit';
import { NotesEditor } from './notes';

// Crear o editar una rutina de dos maneras, con el mismo resultado:
//  · «Ejercicio a ejercicio»: eliges del catálogo y ajustas series, reps y kg con botones.
//  · «Como en notas»: escribes libre («prensa 4x10 120») y se convierte solo.
// Se puede cambiar de una a otra en cualquier momento sin perder nada.
// Si la rutina está vacía, también se puede partir de una plantilla.

export type BuilderMode = 'lista' | 'notas';

export interface BuilderState {
  mode: BuilderMode;
  days: RoutineDay[];
  text: string;
  choices: Record<number, string>;
}

const MODE_KEY = 'gym:editor';

function savedBuilderMode(): BuilderMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'notas' ? 'notas' : 'lista';
  } catch {
    return 'lista';
  }
}

function emptyDay(i: number): RoutineDay {
  return { id: uid(8), name: `Día ${String.fromCharCode(65 + i)}`, group: 'fullbody', exercises: [] };
}

export function initBuilder(days?: RoutineDay[]): BuilderState {
  const mode = savedBuilderMode();
  const d = days && days.length ? clone(days) : [emptyDay(0)];
  return { mode, days: d, text: days && days.length ? toNotes(days) : '', choices: {} };
}

/** Rutina final, la haya hecho como haya hecho */
export function builderDays(s: BuilderState, lastWeight: (id: string) => number | null, prevDays?: RoutineDay[]): RoutineDay[] {
  if (s.mode === 'notas') return buildDraft(s.text, s.choices, lastWeight, {}, prevDays).days;
  return s.days
    .filter((d) => d.exercises.length)
    .map((d) => ({ ...d, name: d.name.trim() || 'Día', group: inferDayGroup(d.exercises.map((p) => p.exerciseId)) }));
}

export function RoutineBuilder({
  state,
  setState,
  lastWeight,
  prevDays,
  audience,
}: {
  state: BuilderState;
  setState: (s: BuilderState) => void;
  lastWeight: (id: string) => number | null;
  prevDays?: RoutineDay[];
  audience: string;
}) {
  const switchMode = (mode: BuilderMode) => {
    if (mode === state.mode) return;
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* sin almacenamiento: da igual */
    }
    if (mode === 'notas') {
      const days = state.days.filter((d) => d.exercises.length);
      setState({ ...state, mode, text: toNotes(days), choices: {} });
    } else {
      const days = buildDraft(state.text, state.choices, lastWeight, {}, prevDays).days;
      setState({ ...state, mode, days: days.length ? days : [emptyDay(0)] });
    }
  };
  const isEmpty = state.mode === 'notas' ? !state.text.trim() : state.days.every((d) => !d.exercises.length);
  const applyBase = (key: string) => {
    const b = BASES.find((x) => x.key === key);
    if (!b) return;
    const days = b.build().map((d) => ({ ...d, exercises: d.exercises.map((p) => ({ ...p, weight: p.exerciseId ? lastWeight(p.exerciseId) : null })) }));
    setState({ ...state, days, text: toNotes(days), choices: {} });
  };

  return (
    <>
      <span className="kicker" style={{ display: 'block' }}>
        Cómo quieres hacerla
      </span>
      <div style={{ marginTop: 2 }}>
        <Seg
          value={state.mode}
          onChange={switchMode}
          label="Forma de crear la rutina"
          options={[
            ['lista', 'Ejercicio a ejercicio'],
            ['notas', 'Como en notas'],
          ]}
        />
      </div>
      <div style={{ marginTop: 14 }}>
        {state.mode === 'notas' ? (
          <NotesEditor
            text={state.text}
            setText={(text) => setState({ ...state, text })}
            choices={state.choices}
            setChoices={(choices) => setState({ ...state, choices })}
            lastWeight={lastWeight}
            prevDays={prevDays}
            audience={audience}
          />
        ) : (
          <ListEditor days={state.days} setDays={(days) => setState({ ...state, days })} lastWeight={lastWeight} />
        )}
      </div>
      {isEmpty && (
        <div style={{ marginTop: 26 }}>
          <div className="sec">
            <span className="kicker">O parte de una plantilla</span>
            <span>la cambias a tu gusto</span>
          </div>
          {BASES.map((b) => (
            <button key={b.key} type="button" className="row" style={{ width: '100%', textAlign: 'left' }} onClick={() => applyBase(b.key)}>
              <span className="col">
                <span className="t">{b.name}</span>
                <span className="s">
                  {b.daysLabel} · {b.build().length} {b.build().length === 1 ? 'día' : 'días'}
                </span>
              </span>
              <span className="xs b accent-t">Usar</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function ListEditor({ days, setDays, lastWeight }: { days: RoutineDay[]; setDays: (d: RoutineDay[]) => void; lastWeight: (id: string) => number | null }) {
  const { settings } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ dayId: string; replace?: string } | null>(null);
  const total = days.reduce((a, d) => a + d.exercises.reduce((b, p) => b + p.sets, 0), 0);
  const count = days.reduce((a, d) => a + d.exercises.length, 0);

  const updDay = (dayId: string, fn: (d: RoutineDay) => RoutineDay) => setDays(days.map((d) => (d.id === dayId ? fn(d) : d)));
  const updPlan = (dayId: string, planId: string, patch: Partial<PlanExercise>) =>
    updDay(dayId, (d) => ({ ...d, exercises: d.exercises.map((p) => (p.id === planId ? { ...p, ...patch } : p)) }));
  const move = (dayId: string, i: number, dir: -1 | 1) =>
    updDay(dayId, (d) => {
      const list = [...d.exercises];
      const j = i + dir;
      if (j < 0 || j >= list.length) return d;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...d, exercises: list };
    });
  const remove = (dayId: string, planId: string) => updDay(dayId, (d) => ({ ...d, exercises: d.exercises.filter((p) => p.id !== planId) }));
  const add = (dayId: string, exerciseId: string) => {
    const plan: PlanExercise = { id: uid(8), exerciseId, sets: 3, reps: ex(exerciseId)?.measure === 'seconds' ? 30 : ex(exerciseId)?.load === 'bodyweight' ? 12 : 10, weight: lastWeight(exerciseId) };
    updDay(dayId, (d) => ({ ...d, exercises: [...d.exercises, plan] }));
  };
  const replace = (dayId: string, planId: string, exerciseId: string) => updPlan(dayId, planId, { exerciseId, rawName: undefined, weight: lastWeight(exerciseId) });
  const pickDay = picker ? days.find((d) => d.id === picker.dayId) : undefined;

  return (
    <>
      <div className="sec">
        <span className="kicker">Así queda</span>
        <span>
          {count} ejercicios · {total} series
        </span>
      </div>
      {days.map((d, di) => (
        <div key={d.id} style={{ marginTop: di ? 22 : 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'end', columnGap: 12, borderBottom: '1px solid var(--ink)' }}>
            <label className="sr" htmlFor={`dn-${d.id}`}>
              Nombre del día {di + 1}
            </label>
            <input
              id={`dn-${d.id}`}
              value={d.name}
              onChange={(e) => updDay(d.id, (x) => ({ ...x, name: e.target.value }))}
              placeholder={`Día ${di + 1}`}
              style={{ border: 0, background: 'transparent', fontSize: 19, fontWeight: 600, height: 44, padding: 0, minWidth: 0, outline: 'none', color: 'var(--ink)' }}
            />
            <span className="xs mute" style={{ paddingBottom: 12 }}>
              {d.exercises.length ? DAY_GROUP_NAMES[inferDayGroup(d.exercises.map((p) => p.exerciseId))] : ''}
              {days.length > 1 && (
                <button
                  type="button"
                  className="txt mute"
                  style={{ marginLeft: 14, minHeight: 32, fontSize: 13 }}
                  onClick={() => {
                    if (d.exercises.length && !confirm(`¿Quitar ${d.name || 'este día'} y sus ${d.exercises.length} ejercicios?`)) return;
                    setDays(days.filter((x) => x.id !== d.id));
                  }}
                >
                  Quitar día
                </button>
              )}
            </span>
          </div>

          {d.exercises.length === 0 && <p className="small mute" style={{ padding: '14px 0 6px' }}>Todavía no hay ejercicios en este día.</p>}

          {d.exercises.map((p, i) => {
            const x = ex(p.exerciseId);
            const isOpen = open === p.id;
            const dumb = x?.load === 'dumbbell';
            const body = x?.load === 'bodyweight';
            const step = dumb ? settings.incDumbbell : 2.5;
            return (
              <div key={p.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : p.id)}
                  style={{ display: 'grid', gridTemplateColumns: '22px minmax(0,1fr) auto', columnGap: 8, alignItems: 'center', width: '100%', minHeight: 58, padding: '8px 0', background: 'none', border: 0, textAlign: 'left', color: 'inherit' }}
                >
                  <span className="small mute">{i + 1}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span className="m">{x?.name || `«${p.rawName}»`}</span>
                    <span className="small mute">
                      {p.sets} × {p.reps}{x?.measure === 'seconds' ? ' s' : ''}
                      {!body && (p.weight !== null ? ` · ${dumb ? '2 × ' : ''}${n(p.weight)} kg` : ' · sin peso')}
                    </span>
                  </span>
                  <span className={`xs ${isOpen ? 'b' : 'mute'}`}>{isOpen ? 'Listo' : 'Ajustar'}</span>
                </button>
                {isOpen && (
                  <div style={{ paddingBottom: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', rowGap: 4, alignItems: 'center' }}>
                      <span className="small">Series</span>
                      <Stepper value={p.sets} step={1} label="series" onChange={(v) => updPlan(d.id, p.id, { sets: Math.max(1, Math.min(10, v)) })} />
                      <span className="small">{x?.measure === 'seconds' ? 'Segundos' : 'Repeticiones'}</span>
                      <Stepper value={p.reps} step={1} label="repeticiones" onChange={(v) => updPlan(d.id, p.id, { reps: Math.max(1, v) })} />
                      {!body && (
                        <>
                          <span className="small">
                            Peso{x?.imported ? ' externo total' : dumb ? ' por mancuerna' : ''}
                            {p.weight === null && <span className="xs mute" style={{ display: 'block' }}>Vacío: usa el de la última vez</span>}
                          </span>
                          <Stepper
                            value={p.weight ?? 0}
                            step={step}
                            unit="kg"
                            label="peso"
                            onChange={(v) =>
                              updPlan(d.id, p.id, {
                                // desde vacío, «+» pone el de la última vez (o uno típico) en vez de 2,5 kg
                                weight: p.weight === null ? (v > 0 ? (x && lastWeight(x.id)) || x?.ref || v : null) : v > 0 ? v : null,
                              })
                            }
                          />
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 8 }}>
                      <button type="button" className="txt" style={{ gap: 4 }} disabled={i === 0} onClick={() => move(d.id, i, -1)} aria-label="Subir en el orden">
                        <IcArrowUp width={16} height={16} /> Subir
                      </button>
                      <button type="button" className="txt" style={{ gap: 4 }} disabled={i === d.exercises.length - 1} onClick={() => move(d.id, i, 1)} aria-label="Bajar en el orden">
                        <IcArrowDown width={16} height={16} /> Bajar
                      </button>
                      <button type="button" className="txt" onClick={() => setPicker({ dayId: d.id, replace: p.id })}>
                        Cambiar
                      </button>
                      <button type="button" className="txt mute" onClick={() => (remove(d.id, p.id), setOpen(null))}>
                        Quitar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <button type="button" className="txt accent" style={{ gap: 6, minHeight: 50 }} onClick={() => setPicker({ dayId: d.id })}>
            <IcPlus /> Añadir ejercicio
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn2"
        style={{ marginTop: 18, gap: 6 }}
        onClick={() => {
          const nd = emptyDay(days.length);
          setDays([...days, nd]);
          setPicker({ dayId: nd.id });
        }}
      >
        <IcPlus /> Añadir día
      </button>

      {picker && pickDay && (
        <Picker
          title={picker.replace ? 'Cambiar ejercicio' : `Añadir a ${pickDay.name || 'este día'}`}
          added={pickDay.exercises.map((p) => p.exerciseId || '')}
          replacing={!!picker.replace}
          onPick={(id) => {
            if (picker.replace) {
              replace(pickDay.id, picker.replace, id);
              setPicker(null);
            } else add(pickDay.id, id);
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  );
}

function Picker({ title, added, replacing, onPick, onClose }: { title: string; added: string[]; replacing: boolean; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [g, setG] = useState<'all' | GroupId>('all');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [limit, setLimit] = useState(60);
  const list = useMemo(() => searchCatalog(q, g).filter((x) => matchesFilters(x, filters)), [g, q, filters]);
  const justAdded = added.length;
  return (
    <Sheet label={title} onClose={onClose}>
      <div style={{ position: 'sticky', top: 0, background: 'var(--sheet)', zIndex: 1, paddingTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="b" style={{ fontSize: 20, margin: 0 }}>
            {title}
          </h2>
          {!replacing && (
            <span className="xs mute">
              {justAdded} en el día
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--ink)', color: 'var(--mute)', marginTop: 8 }}>
          <IcSearch />
          <label htmlFor="pq" className="sr">
            Buscar ejercicio
          </label>
          <input
            id="pq"
            type="search"
            placeholder="Buscar: prensa, remo, glúteo…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(60); }}
            style={{ flex: '1 1 auto', minWidth: 0, height: 44, border: 0, background: 'transparent', fontSize: 16, outline: 'none', color: 'var(--ink)' }}
          />
        </div>
        <Seg value={g} onChange={(v) => { setG(v); setLimit(60); }} label="Grupo" options={[['all', 'Todos'], ...(Object.entries(GROUP_NAMES) as [GroupId, string][])]} />
        <ExerciseFilters value={filters} onChange={(v) => { setFilters(v); setLimit(60); }} />
        <p className="xs mute" style={{ margin: '6px 0' }}>{list.length} ejercicios · imágenes e instrucciones gratuitas</p>
      </div>
      <div style={{ minHeight: '40dvh' }}>
        {list.length === 0 && <p className="small mute" style={{ padding: '16px 0' }}>No hay ningún ejercicio con «{q}».</p>}
        {list.slice(0, limit).map((x) => {
          const times = added.filter((a) => a === x.id).length;
          return (
            <button key={x.id} type="button" className="row" style={{ width: '100%', textAlign: 'left' }} onClick={() => onPick(x.id)}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <ExerciseThumb exercise={x} />
                <span className="col">
                <span className="t">{x.name}</span>
                <span className="s">
                  {GROUP_NAMES[x.group]} · {x.equipment || LOAD_LABEL[x.load]}
                </span>
              </span>
              </span>
              {times > 0 && !replacing ? (
                <span className="xs b" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <IcCheck /> {times > 1 ? `${times}` : 'Añadido'}
                </span>
              ) : (
                <span className="xs b accent-t">{replacing ? 'Elegir' : 'Añadir'}</span>
              )}
            </button>
          );
        })}
        {list.length > limit && <button type="button" className="btn2" style={{ width: '100%', marginTop: 12 }} onClick={() => setLimit(limit + 60)}>Ver 60 más ({list.length - limit} restantes)</button>}
      </div>
      <div style={{ position: 'sticky', bottom: 0, background: 'var(--sheet)', paddingTop: 10 }}>
        <button type="button" className="btn" onClick={onClose}>
          {replacing ? 'Cancelar' : 'Listo'}
        </button>
      </div>
    </Sheet>
  );
}
