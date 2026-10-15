import { useEffect, useState } from 'react';
import { useApp, useAsync } from '../lib/app';
import { back, navigate } from '../lib/router';
import { getExercise, GROUPS, MUSCLES } from '../data/catalog';
import { weekDays } from '../data/seed';
import { hasTrainerRoutine } from '../lib/workout';
import { clone, uid } from '../lib/util';
import type { GroupId, Profile, Routine, RoutineDay, RoutineExercise } from '../lib/types';
import { Empty, ErrorBox, ExerciseThumb, Loading, Sheet, TopBar } from '../components/ui';
import { ExercisePicker } from '../components/ExercisePicker';
import { IconDown, IconPlus, IconTrash, IconUp } from '../components/icons';

function blankRoutine(clientId: string, me: Profile): Routine {
  const now = new Date().toISOString();
  return {
    id: uid(), clientId, authorId: me.id, authorRole: me.role,
    name: '', description: '', days: [newDay('Día 1', [])], active: true, createdAt: now, updatedAt: now,
  };
}

function newDay(name: string, groups: GroupId[]): RoutineDay {
  return { id: uid(), name, groups, exercises: [] };
}

export function RoutineEditor({ clientId, routineId }: { clientId: string; routineId: string }) {
  const { repo, me, toast } = useApp();
  const isNew = routineId === 'new';
  const { data, error, loading, reload } = useAsync(async () => {
    const [routines, client] = await Promise.all([
      repo.listRoutines(clientId),
      clientId === me.id ? Promise.resolve(me) : repo.getProfile(clientId),
    ]);
    return { routines, client };
  }, [clientId, routineId]);

  const [r, setR] = useState<Routine | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!data) return;
    setReady(true);
    if (isNew) {
      setR(blankRoutine(clientId, me));
      setStartOpen(true);
    } else {
      const found = data.routines.find((x) => x.id === routineId);
      setR(found ? clone(found) : null);
    }
    setDirty(false);
  }, [data, isNew, routineId, clientId, me]);

  if (loading || (data && !ready)) return <div className="screen no-tabs"><Loading /></div>;
  if (error || !data) return <div className="screen no-tabs"><ErrorBox error={error!} onRetry={reload} /></div>;
  if (!r) return <div className="screen no-tabs"><TopBar /><Empty title="Rutina no encontrada" /></div>;

  const isTrainer = me.role === 'trainer';
  const readOnly = !isTrainer && r.authorRole === 'trainer';
  const blockedNew = isNew && !isTrainer && hasTrainerRoutine(data.routines);

  if (blockedNew) {
    return (
      <div className="screen no-tabs">
        <TopBar />
        <Empty title="Ya tienes rutina del entrenador" action={<button className="btn" onClick={() => navigate('/')}>Ver mi rutina</button>}>
          Mientras tu entrenador tenga una rutina activa para ti, es la que manda. Podrás crear la tuya cuando no haya ninguna puesta.
        </Empty>
      </div>
    );
  }

  const update = (fn: (x: Routine) => void) => {
    setR((prev) => {
      const next = clone(prev!);
      fn(next);
      return next;
    });
    setDirty(true);
  };
  const updateDay = (dayId: string, fn: (d: RoutineDay) => void) => update((x) => { const d = x.days.find((y) => y.id === dayId); if (d) fn(d); });

  async function save() {
    if (!r) return;
    if (!r.name.trim()) return toast('Ponle un nombre a la rutina');
    if (!r.days.length) return toast('Añade al menos un día');
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const toSave = { ...r, name: r.name.trim(), updatedAt: now };
      // Solo una rutina activa de cada autor: al activar esta se archivan las otras.
      if (toSave.active) {
        for (const other of data!.routines) {
          if (other.id !== toSave.id && other.active && other.authorRole === toSave.authorRole) {
            await repo.saveRoutine({ ...other, active: false, updatedAt: now });
          }
        }
      }
      await repo.saveRoutine(toSave);
      setDirty(false);
      toast(isNew ? 'Rutina creada' : 'Rutina guardada');
      if (isNew) navigate(isTrainer ? `/client/${clientId}` : '/routines', { replace: true });
    } catch (e: any) {
      toast(e?.message ?? 'No se ha podido guardar');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!r || !confirm(`¿Borrar la rutina "${r.name || 'sin nombre'}"? Los entrenos ya hechos se conservan.`)) return;
    await repo.deleteRoutine(r);
    toast('Rutina borrada');
    back(isTrainer ? `/client/${clientId}` : '/routines');
  }

  const pickDay = r.days.find((d) => d.id === pickFor);
  const forWhom = isTrainer && data.client ? `para ${data.client.name}` : '';

  return (
    <div className="screen no-tabs">
      <TopBar title={isNew ? 'Nueva rutina' : readOnly ? 'Rutina' : 'Editar rutina'} right={
        !readOnly && !isNew ? <button className="icon-btn" aria-label="Borrar rutina" onClick={remove}><IconTrash /></button> : undefined
      } />

      {readOnly ? (
        <>
          <h1 className="display">{r.name}</h1>
          {r.description && <p className="lede">{r.description}</p>}
          <p className="muted small">Esta rutina la ha puesto tu entrenador. Si una máquina está ocupada, cámbiala durante el entreno.</p>
        </>
      ) : (
        <div className="stack" style={{ marginBottom: 20 }}>
          {forWhom && <p className="muted" style={{ margin: 0 }}>Rutina {forWhom}</p>}
          <label className="field">
            <span>Nombre</span>
            <input className="input" value={r.name} placeholder="Hipertrofia 6 días" onChange={(e) => update((x) => { x.name = e.target.value; })} />
          </label>
          <label className="field">
            <span>Descripción (opcional)</span>
            <textarea className="input" value={r.description ?? ''} placeholder="Objetivo, cómo hacer las series de aproximación…" onChange={(e) => update((x) => { x.description = e.target.value; })} />
          </label>
          <label className="row">
            <input type="checkbox" checked={r.active} onChange={(e) => update((x) => { x.active = e.target.checked; })} />
            <span>Rutina activa {isTrainer ? '(es la que verá el cliente)' : '(la que usas ahora)'}</span>
          </label>
        </div>
      )}

      {r.days.map((d, di) => (
        <div key={d.id} className="day-card">
          <header>
            <span className="muted" style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 20 }}>{di + 1}</span>
            {readOnly ? (
              <strong style={{ flex: 1, fontFamily: 'var(--display)', fontSize: 22 }}>{d.name}</strong>
            ) : (
              <input aria-label="Nombre del día" value={d.name} onChange={(e) => updateDay(d.id, (x) => { x.name = e.target.value; })} />
            )}
            {!readOnly && (
              <>
                <button className="icon-btn" aria-label="Subir día" disabled={di === 0} onClick={() => update((x) => { [x.days[di - 1], x.days[di]] = [x.days[di], x.days[di - 1]]; })}><IconUp size={20} /></button>
                <button className="icon-btn" aria-label="Borrar día" onClick={() => confirm(`¿Quitar "${d.name}"?`) && update((x) => { x.days.splice(di, 1); })}><IconTrash size={20} /></button>
              </>
            )}
          </header>
          <div className="day-body">
            {!readOnly && (
              <div className="field" style={{ marginTop: 10 }}>
                <span>¿Qué parte toca?</span>
                <div className="chips wrap">
                  {GROUPS.map((g) => (
                    <button key={g.id} className="chip" aria-pressed={d.groups.includes(g.id)} onClick={() => updateDay(d.id, (x) => {
                      x.groups = x.groups.includes(g.id) ? x.groups.filter((y) => y !== g.id) : [...x.groups, g.id];
                    })}>{g.name}</button>
                  ))}
                </div>
              </div>
            )}
            {d.exercises.map((re, i) => (
              <ExerciseRow
                key={re.uid}
                re={re}
                readOnly={readOnly}
                first={i === 0}
                last={i === d.exercises.length - 1}
                onChange={(fn) => updateDay(d.id, (x) => fn(x.exercises[i]))}
                onMove={(dir) => updateDay(d.id, (x) => { const j = i + dir; [x.exercises[i], x.exercises[j]] = [x.exercises[j], x.exercises[i]]; })}
                onRemove={() => updateDay(d.id, (x) => { x.exercises.splice(i, 1); })}
              />
            ))}
            {!d.exercises.length && <p className="muted small">{readOnly ? 'Sin ejercicios.' : d.groups.length ? 'Añade ejercicios: solo verás los de ' + d.groups.map((g) => GROUPS.find((x) => x.id === g)!.name.toLowerCase()).join(' y ') + '.' : 'Marca qué parte del cuerpo toca y añade ejercicios.'}</p>}
            {!readOnly && (
              <button className="btn small block" style={{ marginTop: 10 }} onClick={() => setPickFor(d.id)}><IconPlus size={18} /> Añadir ejercicio</button>
            )}
          </div>
        </div>
      ))}

      {!readOnly && (
        <button className="btn block ghost" onClick={() => update((x) => { x.days.push(newDay(`Día ${x.days.length + 1}`, [])); })}>
          <IconPlus size={20} /> Añadir día
        </button>
      )}

      {!readOnly && (
        <div className="cta-bar"><div>
          <button className="btn ghost" onClick={() => back(isTrainer ? `/client/${clientId}` : '/routines')}>{dirty ? 'Descartar' : 'Volver'}</button>
          <button className="btn primary grow" disabled={busy || !dirty} onClick={save}>{isNew ? 'Crear rutina' : 'Guardar cambios'}</button>
        </div></div>
      )}

      <ExercisePicker
        open={!!pickDay}
        onClose={() => setPickFor(null)}
        groups={pickDay?.groups}
        center={data.client?.center ?? me.center}
        onPick={(ex) => pickDay && updateDay(pickDay.id, (x) => {
          x.exercises.push({ uid: uid(), exerciseId: ex.id, sets: ['12', '10', '10'].map((reps) => ({ reps })), restSec: ex.primary === 'cuadriceps' || ex.primary === 'dorsal' || ex.primary === 'pecho' ? 120 : 90 });
          if (!x.groups.length) x.groups = [GROUPS.find((g) => g.muscles.includes(ex.primary))!.id];
        })}
      />

      <StartSheet
        open={startOpen}
        onClose={() => setStartOpen(false)}
        trainer={isTrainer}
        clientId={clientId}
        onPick={(days, name) => {
          update((x) => { x.days = days; if (name && !x.name) x.name = name; });
          setStartOpen(false);
        }}
      />
    </div>
  );
}

function ExerciseRow({ re, readOnly, first, last, onChange, onMove, onRemove }: {
  re: RoutineExercise; readOnly: boolean; first: boolean; last: boolean;
  onChange(fn: (x: RoutineExercise) => void): void; onMove(dir: number): void; onRemove(): void;
}) {
  const ex = getExercise(re.exerciseId);
  const [reps, setReps] = useState(re.sets.map((s) => s.reps).join('-'));
  useEffect(() => setReps(re.sets.map((s) => s.reps).join('-')), [re.sets]);
  return (
    <div className="re-row">
      <div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <ExerciseThumb exerciseId={re.exerciseId} />
          <div className="grow">
            <div className="name">{ex.name}</div>
            <div className="muted small">{MUSCLES[ex.primary]}{readOnly ? ` · ${re.sets.length} series · ${re.sets.map((s) => s.reps).join('-')} · descanso ${Math.round(re.restSec)} s` : ''}</div>
          </div>
        </div>
        {!readOnly && (
          <div className="cfg">
            <label style={{ flex: 2 }}>
              Reps por serie
              <input value={reps} inputMode="text" placeholder="12-10-10" onChange={(e) => setReps(e.target.value)} onBlur={() => {
                const parts = reps.split(/[-\s,/]+/).map((p) => p.trim()).filter(Boolean);
                if (parts.length) onChange((x) => { x.sets = parts.map((p) => ({ reps: p })); });
                else setReps(re.sets.map((s) => s.reps).join('-'));
              }} />
            </label>
            <label style={{ flex: 1 }}>
              Descanso (s)
              <input value={re.restSec} inputMode="numeric" onChange={(e) => onChange((x) => { x.restSec = Number(e.target.value.replace(/\D/g, '')) || 0; })} />
            </label>
          </div>
        )}
        {!readOnly ? (
          <div className="cfg">
            <label style={{ flex: 1 }}>
              Nota (opcional)
              <input value={re.note ?? ''} placeholder="Tempo 3-1-1, al fallo en la última…" onChange={(e) => onChange((x) => { x.note = e.target.value || undefined; })} />
            </label>
          </div>
        ) : re.note ? <div className="small" style={{ color: 'var(--plate)', marginTop: 4 }}>{re.note}</div> : null}
      </div>
      {!readOnly && (
        <div className="ops">
          <button aria-label="Subir" disabled={first} onClick={() => onMove(-1)}><IconUp size={20} /></button>
          <button aria-label="Bajar" disabled={last} onClick={() => onMove(1)}><IconDown size={20} /></button>
          <button aria-label="Quitar" onClick={onRemove}><IconTrash size={18} /></button>
        </div>
      )}
    </div>
  );
}

/** Al crear: en blanco, plantilla de 6 días o copiar la de otro cliente (entrenador). */
function StartSheet({ open, onClose, trainer, clientId, onPick }: { open: boolean; onClose(): void; trainer: boolean; clientId: string; onPick(days: RoutineDay[], name?: string): void }) {
  const { repo } = useApp();
  const others = useAsync(async () => {
    if (!trainer || !open) return [] as { client: Profile; routine: Routine }[];
    const clients = await repo.listClients();
    const lists = await Promise.all(clients.filter((c) => c.id !== clientId).map(async (c) => (await repo.listRoutines(c.id)).map((routine) => ({ client: c, routine }))));
    return lists.flat();
  }, [trainer, open, clientId]);

  const copyDays = (days: RoutineDay[]) => clone(days).map((d) => ({ ...d, id: uid(), exercises: d.exercises.map((e) => ({ ...e, uid: uid() })) }));

  return (
    <Sheet open={open} onClose={onClose} title="¿Cómo empiezas?">
      <div className="stack">
        <button className="btn" onClick={() => onPick([newDay('Día 1', [])])}>En blanco</button>
        <button className="btn" onClick={() => onPick(weekDays(), 'Hipertrofia 6 días')}>Plantilla de 6 días (torso / pierna)</button>
      </div>
      {trainer && (others.data?.length ?? 0) > 0 && (
        <>
          <h2 className="section">Copiar de otro cliente</h2>
          <div className="list">
            {others.data!.map(({ client, routine }) => (
              <button key={routine.id} className="item" onClick={() => onPick(copyDays(routine.days), routine.name)}>
                <div className="grow">
                  <div className="name">{routine.name}</div>
                  <div className="meta">{client.name} · {routine.days.length} días</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
