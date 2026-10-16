import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { equivalent, ex, increment } from '../../data/catalog';
import { useApp, useMe } from '../../lib/app';
import { addNote } from '../../lib/api';
import { keepAwake, primeAudio, restOver, tapFeedback, warnSoon } from '../../lib/alerts';
import { useApprovedAlts, useMachinePrefs } from '../../lib/hooks';
import { go, href } from '../../lib/router';
import type { EntryLog, Feel, SetLog } from '../../lib/types';
import { clone, mmss, n, uid } from '../../lib/util';
import { compatibleNext, entryDone, finishWorkout, loadLive, nextOpen, nextSetIndex, saveLive, syncLive, type LiveState } from '../../lib/workout';
import { IcBack, IcCheck, IcChev, IcClock, IcMore, IcPen, IcPhone, IcPlay, IcPlus, IcSkip, IcStop, IcVideo } from '../../ui/icons';
import { ClientNav, Sheet, Stepper, toast } from '../../ui/kit';
import { Drawing } from '../../ui/drawings';

const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

export function plateSplit(total: number, base: number): number[] | null {
  let side = (total - base) / 2;
  if (side < 0) return null;
  const out: number[] = [];
  for (const p of PLATES) {
    while (side >= p - 1e-6) {
      out.push(p);
      side -= p;
    }
  }
  return side > 0.01 ? null : out;
}

export function LiveWorkout() {
  const { store, settings } = useApp();
  const me = useMe();
  const [s, setS] = useState<LiveState | null>(() => loadLive(me.id));
  const [now, setNow] = useState(Date.now());
  const [sheet, setSheet] = useState<null | 'busy' | 'more' | 'load' | 'note' | { edit: number }>(() => (location.hash.includes('ocupada=1') ? 'busy' : null));
  const [feelUntil, setFeelUntil] = useState(0);
  const [prefs] = useMachinePrefs();
  const approved = useApprovedAlts();
  const warned = useRef(false);
  const ended = useRef(false);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    if (!s && !location.hash.startsWith('#/resumen')) go('/hoy', true);
  }, [s]);

  useEffect(() => {
    void keepAwake(settings.wakeLock);
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    const vis = () => document.visibilityState === 'visible' && settings.wakeLock && keepAwake(true);
    document.addEventListener('visibilitychange', vis);
    return () => {
      void keepAwake(false);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [settings.wakeLock]);

  const sRef = useRef(s);
  const update = useCallback(
    (fn: (d: LiveState) => void, sync = false): LiveState | null => {
      const prev = sRef.current;
      if (!prev) return null;
      const d = clone(prev);
      fn(d);
      sRef.current = d;
      saveLive(d);
      if (sync) syncLive(store, d);
      setS(d);
      return d;
    },
    [store],
  );

  // reloj del descanso
  useEffect(() => {
    if (!s?.restUntil && !s?.waitingSince) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [s?.restUntil, s?.waitingSince]);

  const resting = Boolean(s?.restUntil);
  const left = s?.restUntil ? Math.ceil((s.restUntil - now) / 1000) : 0;

  useEffect(() => {
    if (!s?.restUntil) {
      warned.current = false;
      ended.current = false;
      return;
    }
    if (left <= 10 && left > 0 && !warned.current) {
      warned.current = true;
      warnSoon(settings);
    }
    if (left <= 0 && !ended.current) {
      ended.current = true;
      const e = s.workout.entries[s.current];
      void restOver(settings, e ? `Siguiente: ${e.name}` : 'A por la siguiente');
      update((d) => {
        d.restUntil = null;
      });
    }
  }, [left, s, settings, update]);

  const w = s?.workout;
  const entry = w ? w.entries[s!.current] : undefined;
  const x = ex(entry?.exerciseId);
  const setIdx = entry ? nextSetIndex(entry) : 0;
  const curSet: SetLog | undefined = entry?.sets[Math.min(setIdx, (entry?.sets.length || 1) - 1)];
  const inc = { machine: settings.incMachine, dumbbell: settings.incDumbbell };
  const step = increment(x, inc) || 1;
  const nextIdx = w ? nextOpen(w, s!.current, s!.pending) : -1;
  const nextEntry = w && nextIdx >= 0 ? w.entries[nextIdx] : undefined;
  const mset = x ? prefs.settings[x.id] : undefined;
  const base = mset?.base ?? (x?.load === 'barbell' ? 20 : 0);
  const plates = x && (x.load === 'plates' || x.load === 'barbell') && curSet?.weight ? plateSplit(curSet.weight, base) : null;
  const doneEntries = w ? w.entries.filter(entryDone).length : 0;

  const finish = useCallback(
    (status: 'done' | 'incomplete' = 'done') => {
      const cur = sRef.current;
      if (!cur) return;
      const fw = finishWorkout(store, cur, status);
      sRef.current = null;
      setS(null);
      go(`/resumen/${fw.id}`, true);
    },
    [store],
  );

  const setDone = () => {
    if (!s || !entry) return;
    primeAudio();
    tapFeedback();
    const restSec = settings.restSec;
    let finished = false;
    update((d) => {
      const e = d.workout.entries[d.current];
      const i = nextSetIndex(e);
      if (i >= e.sets.length) return;
      e.sets[i] = { ...e.sets[i], done: true, at: Date.now() };
      if (entryDone(e)) {
        // ¿queda algo pendiente por máquina ocupada?
        const nx = nextOpen(d.workout, d.current, d.pending);
        if (nx === -1 && !d.pending.length) {
          finished = true;
          return;
        }
        d.current = nx === -1 ? d.pending.shift()! : nx;
      }
      d.restUntil = Date.now() + restSec * 1000;
      d.restTotal = restSec;
    }, true);
    setFeelUntil(Date.now() + 6000);
    if (finished) finish('done');
  };

  const lastDoneSet = useMemo(() => {
    if (!w) return null;
    let best: { e: number; i: number; at: number } | null = null;
    w.entries.forEach((e, ei) =>
      e.sets.forEach((st, si) => {
        if (st.done && st.at && (!best || st.at > best.at)) best = { e: ei, i: si, at: st.at };
      }),
    );
    return best as { e: number; i: number; at: number } | null;
  }, [w]);

  const setFeel = (f: Feel) => {
    if (!lastDoneSet) return;
    tapFeedback();
    update((d) => {
      d.workout.entries[lastDoneSet.e].sets[lastDoneSet.i].feel = f;
    }, true);
    setFeelUntil(0);
  };

  if (!s || !w || !entry) return null;

  const progressPct = w.entries.length ? (doneEntries / w.entries.length) * 100 : 0;
  const elapsed = Math.floor((now - w.startedAt) / 1000);
  const lastFeel = lastDoneSet ? w.entries[lastDoneSet.e].sets[lastDoneSet.i].feel : null;
  const prevEntry = lastDoneSet ? w.entries[lastDoneSet.e] : null;
  const suggestUp =
    resting && prevEntry === entry && lastFeel === 'easy' && curSet?.weight && x?.load !== 'bodyweight' && x?.load !== 'dumbbell' && setIdx < entry.sets.length;
  const pendingBack = s.pending.length > 0 && resting && w.entries[s.pending[0]];

  return (
    <div className="screen" style={{ paddingBottom: 'calc(52px + env(safe-area-inset-bottom))' }}>
      <header className="pad" style={{ paddingTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="m small" style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>
            {doneEntries + (entryDone(entry) ? 0 : 1)} de {w.entries.length}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 14 }} className="small mute">
            {!online && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--mute)' }} />
                Sin conexión
              </span>
            )}
            <span>{mmss(elapsed)}</span>
            <button type="button" className="icon-btn plain" style={{ marginRight: -12 }} aria-label="Más opciones de la sesión" onClick={() => setSheet('more')}>
              <IcMore />
            </button>
          </span>
        </div>
        <div className="progress">
          <i style={{ width: `${progressPct}%` }} />
        </div>
      </header>

      {!resting ? (
        <div className="main" style={{ paddingTop: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <h1 className="h-ex">{entry.name}</h1>
            <a className="icon-btn" href={href(`/ejercicio/${entry.exerciseId}`)} aria-label="Ver ficha y vídeo del ejercicio">
              <IcPlay />
            </a>
          </div>
          {x?.imported && x.load === 'other' && <p className="small mute" style={{ marginTop: 6 }}>Peso externo total: suma ambas mancuernas si usas dos.</p>}
          {entry.substituteOf && <p className="small mute" style={{ marginTop: 4 }}>Alternativa de {ex(entry.substituteOf)?.name}</p>}
          {x && (
            <a href={href(`/maquina/${x.id}`)} style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '72px minmax(0,1fr) 18px', columnGap: 14, alignItems: 'center', minHeight: 58, color: 'inherit', textDecoration: 'none' }}>
              <Drawing kind={x.kind} height={56} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{x.equipment}</span>
                <span className="small mute" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {prefs.notes[x.id] ? `Tu nota: ${prefs.notes[x.id]}` : 'Toca para ver cómo reconocerla'}
                </span>
                {mset && (mset.asiento || mset.tope || mset.pies) && (
                  <span className="small mute">{[mset.asiento && `Asiento ${mset.asiento}`, mset.tope && `Tope ${mset.tope}`, mset.pies && `Pies ${mset.pies}`].filter(Boolean).join(' · ')}</span>
                )}
              </span>
              <IcChev className="chev" />
            </a>
          )}
          <hr className="rule" style={{ margin: '14px 0 18px' }} />

          <button type="button" onClick={() => setSheet('load')} aria-label="Ajustar peso y repeticiones" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', display: 'flex', gap: 36, alignItems: 'flex-end' }}>
            {x?.load !== 'bodyweight' && (
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span className="big">{curSet?.weight !== null && curSet?.weight !== undefined ? n(curSet.weight) : '—'}</span>
                <span className="mute" style={{ fontSize: 17 }}>{x?.load === 'dumbbell' ? 'kg/mano' : 'kg'}</span>
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span className="big">{curSet?.reps ?? '—'}</span>
              <span className="mute" style={{ fontSize: 17 }}>{x?.measure === 'seconds' ? 's' : 'reps'}</span>
            </span>
          </button>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 15, gap: 12 }}>
            <span className="m">
              Serie {Math.min(setIdx + 1, entry.sets.length)} de {entry.sets.length}
            </span>
            {plates && plates.length > 0 && <span className="mute">Por lado {plates.map((p) => n(p, 2)).join(' + ')}</span>}
          </div>

          <div role="list" aria-label="Series de hoy" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(entry.sets.length, 6)}, minmax(0,1fr))`, columnGap: 10, marginTop: 16 }}>
            {entry.sets.map((st, i) => (
              <button
                type="button"
                role="listitem"
                key={i}
                onClick={() => st.done && setSheet({ edit: i })}
                style={{ background: 'none', border: 0, borderBottom: `2px solid ${i === setIdx ? 'var(--accent)' : st.done ? 'var(--mute)' : 'var(--line)'}`, padding: '0 0 8px', textAlign: 'left', color: st.done ? 'var(--mute)' : 'inherit' }}
              >
                <span className="xs" style={{ display: 'flex', justifyContent: 'space-between', color: i === setIdx ? 'var(--accent-text)' : undefined, fontWeight: i === setIdx ? 600 : 400 }}>
                  {i + 1}
                  {st.done ? <IcCheck width={12} height={12} /> : i === setIdx ? <span>Ahora</span> : null}
                </span>
                <span style={{ fontSize: 14, fontWeight: i === setIdx ? 600 : 400 }}>
                  {st.weight !== null ? n(st.weight) + ' × ' : ''}
                  {st.reps}
                </span>
              </button>
            ))}
          </div>

          {x && (
            <>
              <hr className="rule" style={{ margin: '16px 0 10px' }} />
              <span className="kicker">Cómo se hace</span>
              <ol style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {x.steps.map((t, i) => (
                  <li key={i} className="small" style={{ display: 'grid', gridTemplateColumns: '18px 1fr' }}>
                    <span className="accent-t b">{i + 1}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          <div className="grow" />
          {nextEntry && (
            <div style={{ padding: '14px 0 12px', borderTop: '1px solid var(--line)', marginTop: 16 }}>
              <span className="kicker">A continuación</span>
              <p style={{ marginTop: 4, fontSize: 16, fontWeight: 500 }}>
                {nextEntry.name}{' '}
                <span className="mute" style={{ fontWeight: 400 }}>
                  · {nextEntry.sets.length} × {nextEntry.target.reps}
                </span>
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="main" style={{ paddingTop: 26 }}>
          <p style={{ fontSize: 17, fontWeight: 500 }}>
            {prevEntry?.name} <span className="mute" style={{ fontWeight: 400 }}>· serie {lastDoneSet ? lastDoneSet.i + 1 : ''} hecha</span>
          </p>
          <div style={{ marginTop: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="mute">
            <span className="kicker">Descanso</span>
            <span className="xs" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IcPhone /> Aviso a falta de 10 s
            </span>
          </div>
          <div role="timer" aria-label={`Descanso restante ${mmss(left)}`} className="huge" style={{ marginTop: 6 }}>
            {mmss(left)}
          </div>
          <div className="progress thick" style={{ marginTop: 18 }}>
            <i style={{ width: `${s.restTotal ? Math.max(0, (left / s.restTotal) * 100) : 0}%` }} />
          </div>

          {now < feelUntil && (
            <>
              <p className="mute" style={{ marginTop: 24, fontSize: 15 }}>¿Cómo fue?</p>
              <div role="group" aria-label="Esfuerzo de la serie" className="grid3" style={{ marginTop: 4 }}>
                {(
                  [
                    ['easy', 'Fácil'],
                    ['ok', 'Justo'],
                    ['hard', 'Duro'],
                  ] as [Feel, string][]
                ).map(([f, t]) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={lastFeel === f}
                    onClick={() => setFeel(f)}
                    style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', minHeight: 52, fontSize: 22, color: lastFeel === f ? 'var(--ink)' : 'var(--mute)', fontWeight: lastFeel === f ? 600 : 400 }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <span className="xs mute">Opcional · se oculta en unos segundos</span>
            </>
          )}

          <hr className="rule" style={{ margin: '22px 0 14px' }} />
          {pendingBack ? (
            <>
              <span className="kicker accent">Pendiente · máquina ocupada</span>
              <p style={{ marginTop: 6, fontSize: 30, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.05 }}>¿{w.entries[s.pending[0]].name} libre?</p>
              <div className="row-actions" style={{ marginTop: 6 }}>
                <button
                  type="button"
                  className="txt accent"
                  onClick={() =>
                    update((d) => {
                      d.current = d.pending.shift()!;
                    }, true)
                  }
                >
                  Sí, vamos
                </button>
                <button
                  type="button"
                  className="txt"
                  onClick={() =>
                    update((d) => {
                      const nx = nextOpen(d.workout, d.current, d.pending);
                      if (nx !== -1) d.current = nx;
                      else toast('Solo queda esa: prueba una alternativa desde «Máquina ocupada».');
                    })
                  }
                >
                  Aún no · hacer otro
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="kicker">{prevEntry === entry ? 'Siguiente serie' : 'Siguiente ejercicio'}</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6, gap: 12 }}>
                <span style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em' }}>
                  {prevEntry === entry ? '' : entry.name + ' · '}
                  {curSet?.weight !== null && curSet?.weight !== undefined ? `${n(curSet.weight)} kg × ` : ''}
                  {curSet?.reps}
                </span>
                <span className="small mute">
                  Serie {Math.min(setIdx + 1, entry.sets.length)} de {entry.sets.length}
                </span>
              </div>
              {suggestUp && (
                <div className="row-actions" style={{ marginTop: 4 }}>
                  <span className="mute" style={{ fontSize: 15 }}>¿Subir a {n((curSet!.weight || 0) + step)} kg?</span>
                  <button
                    type="button"
                    className="txt accent"
                    onClick={() =>
                      update((d) => {
                        const e = d.workout.entries[d.current];
                        for (let i = nextSetIndex(e); i < e.sets.length; i++) e.sets[i].weight = (e.sets[i].weight || 0) + step;
                      })
                    }
                  >
                    Subir
                  </button>
                </div>
              )}
            </>
          )}
          <div className="grow" />
        </div>
      )}

      <div className="bottom" style={{ bottom: 'calc(52px + env(safe-area-inset-bottom))' }}>
        {!resting ? (
          <>
            <button type="button" className="btn xl" onClick={setDone} onContextMenu={(e) => e.preventDefault()}>
              Serie hecha
            </button>
            <div className="row-actions">
              <button
                type="button"
                className="txt"
                disabled={!lastDoneSet}
                onClick={() =>
                  update((d) => {
                    if (!lastDoneSet) return;
                    d.workout.entries[lastDoneSet.e].sets[lastDoneSet.i].done = false;
                    d.current = lastDoneSet.e;
                    d.restUntil = null;
                  }, true)
                }
              >
                <IcBack /> Deshacer
              </button>
              <button type="button" className="txt u" onClick={() => setSheet('busy')}>
                Máquina ocupada
              </button>
            </div>
          </>
        ) : (
          <div className="grid3" style={{ borderTop: '1px solid var(--line)', margin: '0 calc(-1 * var(--gutter))' }}>
            <button type="button" style={{ background: 'none', border: 0, height: 64, fontSize: 18 }} aria-label="Restar 15 segundos" onClick={() => update((d) => void (d.restUntil = (d.restUntil || Date.now()) - 15000))}>
              −15 s
            </button>
            <button type="button" style={{ background: 'none', border: 0, borderLeft: '1px solid var(--line)', height: 64, fontSize: 18 }} aria-label="Sumar 15 segundos" onClick={() => update((d) => {
              d.restUntil = (d.restUntil || Date.now()) + 15000;
              d.restTotal += 15;
            })}>
              +15 s
            </button>
            <button type="button" style={{ background: 'none', border: 0, borderLeft: '1px solid var(--line)', height: 64, fontSize: 18, fontWeight: 600, color: 'var(--accent-text)' }} onClick={() => update((d) => void (d.restUntil = null))}>
              Saltar
            </button>
          </div>
        )}
      </div>
      <ClientNav active="hoy" compact />

      {sheet === 'load' && curSet && (
        <LoadSheet
          weight={curSet.weight}
          reps={curSet.reps}
          step={step}
          bodyweight={x?.load === 'bodyweight'}
          seconds={x?.measure === 'seconds'}
          onClose={() => setSheet(null)}
          onSave={(wt, rp) => {
            update((d) => {
              const e = d.workout.entries[d.current];
              for (let i = nextSetIndex(e); i < e.sets.length; i++) {
                e.sets[i].weight = wt;
                e.sets[i].reps = rp;
              }
            });
            setSheet(null);
          }}
        />
      )}
      {sheet && typeof sheet === 'object' && 'edit' in sheet && (
        <LoadSheet
          title={`Corregir serie ${sheet.edit + 1}`}
          weight={entry.sets[sheet.edit].weight}
          reps={entry.sets[sheet.edit].reps}
          step={step}
          bodyweight={x?.load === 'bodyweight'}
          seconds={x?.measure === 'seconds'}
          onClose={() => setSheet(null)}
          onSave={(wt, rp) => {
            const i = (sheet as { edit: number }).edit;
            update((d) => {
              const st = d.workout.entries[d.current].sets[i];
              st.weight = wt;
              st.reps = rp;
            }, true);
            setSheet(null);
          }}
          onUndo={() => {
            const i = (sheet as { edit: number }).edit;
            update((d) => {
              d.workout.entries[d.current].sets[i].done = false;
            }, true);
            setSheet(null);
          }}
        />
      )}
      {sheet === 'busy' && (
        <BusySheet
          s={s}
          entry={entry}
          approved={approved}
          inc={inc}
          onClose={() => setSheet(null)}
          onAdvance={(to) => {
            update((d) => {
              if (!d.pending.includes(d.current)) d.pending.push(d.current);
              d.workout.busy = [...(d.workout.busy || []), { exerciseId: entry.exerciseId || '', at: Date.now() }];
              d.current = to;
            }, true);
            setSheet(null);
          }}
          onAlternative={(altId, weight) => {
            update((d) => {
              const e = d.workout.entries[d.current];
              const alt = ex(altId)!;
              const remaining = e.sets.filter((st) => !st.done).length || e.target.sets;
              const reps = alt.measure === ex(e.exerciseId)?.measure ? e.target.reps : alt.measure === 'seconds' ? 30 : 10;
              const doneSets = e.sets.filter((st) => st.done);
              const newEntry: EntryLog = {
                id: uid(8),
                planId: null,
                exerciseId: altId,
                name: alt.name,
                substituteOf: e.exerciseId,
                target: { ...e.target, weight, reps },
                sets: Array.from({ length: remaining }, () => ({ weight: alt.load === 'bodyweight' ? null : weight, reps, done: false, feel: null, at: null })),
              };
              d.workout.busy = [...(d.workout.busy || []), { exerciseId: e.exerciseId || '', at: Date.now() }];
              if (doneSets.length) {
                e.sets = doneSets;
                d.workout.entries.splice(d.current + 1, 0, newEntry);
                d.current = d.current + 1;
              } else d.workout.entries[d.current] = newEntry;
            }, true);
            const alt = ex(altId)!;
            setSheet((alt.load !== 'bodyweight' && weight === null) || alt.measure !== x?.measure ? 'load' : null);
          }}
          onWait={() => {
            update((d) => void (d.waitingSince = Date.now()));
            setSheet(null);
            toast('Esperando la máquina. Te pregunto a los 3 minutos.');
            setTimeout(() => {
              const cur = loadLive(me.id);
              if (cur?.waitingSince && Date.now() - cur.waitingSince >= 179000) {
                if (confirm('¿Sigue ocupada? Acepta para ver otras opciones.')) setSheet('busy');
                update((d) => void (d.waitingSince = null));
              }
            }, 180000);
          }}
        />
      )}
      {sheet === 'more' && (
        <Sheet label="Opciones del ejercicio" onClose={() => setSheet(null)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '16px 0 12px' }}>
            <h2 className="h2" style={{ fontSize: 24 }}>{entry.name}</h2>
            <span className="small mute">Serie {Math.min(setIdx + 1, entry.sets.length)} de {entry.sets.length}</span>
          </div>
          <OptionRow
            icon={<IcPlus />}
            title="Añadir una serie"
            sub={`Serie ${entry.sets.length + 1} · ${curSet?.weight !== null && curSet?.weight !== undefined ? n(curSet.weight) + ' kg × ' : ''}${entry.target.reps}`}
            onClick={() => {
              update((d) => {
                const e = d.workout.entries[d.current];
                const last = e.sets[e.sets.length - 1];
                e.sets.push({ weight: last?.weight ?? null, reps: last?.reps ?? e.target.reps, done: false, feel: null, at: null });
              }, true);
              setSheet(null);
            }}
          />
          <OptionRow
            icon={<IcSkip />}
            title="Saltar este ejercicio"
            sub="Pasa al final; si no lo haces, queda como saltado"
            onClick={() => {
              update((d) => {
                const cur = d.current;
                const nx = nextOpen(d.workout, cur, [...d.pending, cur]);
                if (nx === -1) d.workout.entries[cur].skipped = true;
                else {
                  const [e] = d.workout.entries.splice(cur, 1);
                  d.workout.entries.push(e);
                  d.pending = d.pending.map((p) => (p > cur ? p - 1 : p));
                  d.current = nx > cur ? nx - 1 : nx;
                }
              }, true);
              setSheet(null);
            }}
          />
          <OptionRow icon={<IcPen />} title="Nota sobre este ejercicio" sub={me.trainerId ? '«Me molestó la rodilla». La ve tu entrenador' : 'Queda guardada con la sesión'} onClick={() => setSheet('note')} />
          <OptionRow icon={<IcVideo />} title="Ficha del ejercicio" sub="Vídeo, ajustes, discos y alternativas" onClick={() => go(`/ejercicio/${entry.exerciseId}`)} />
          <OptionRow icon={<IcStop />} title="Terminar la sesión" sub={`Guarda lo hecho: ${w.entries.reduce((a, e) => a + e.sets.filter((x2) => x2.done).length, 0)} de ${w.entries.reduce((a, e) => a + e.sets.length, 0)} series`} onClick={() => finish(w.entries.every(entryDone) ? 'done' : 'incomplete')} last />
          <button type="button" className="txt mute" style={{ width: '100%', justifyContent: 'center', minHeight: 56 }} onClick={() => setSheet(null)}>
            Cerrar
          </button>
        </Sheet>
      )}
      {sheet === 'note' && (
        <NoteSheet
          initial={entry.note || ''}
          onClose={() => setSheet(null)}
          onSave={(text) => {
            update((d) => void (d.workout.entries[d.current].note = text), true);
            if (text.trim()) void addNote(store, me, text.trim(), 'note', { exerciseId: entry.exerciseId, workoutId: w.id });
            setSheet(null);
            toast(me.trainerId ? 'Nota enviada a tu entrenador' : 'Nota guardada');
          }}
        />
      )}
      {s.waitingSince && !resting && (
        <div className="toast" style={{ bottom: 'calc(150px + env(safe-area-inset-bottom))' }}>
          <IcClock /> Esperando {entry.name.toLowerCase()} · {mmss((now - s.waitingSince) / 1000)}
        </div>
      )}
    </div>
  );
}

function OptionRow({ icon, title, sub, onClick, last }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void; last?: boolean }) {
  return (
    <button type="button" onClick={onClick} style={{ background: 'none', border: 0, borderTop: '1px solid var(--line)', borderBottom: last ? '1px solid var(--line)' : 0, padding: '10px 0', width: '100%', textAlign: 'left', minHeight: 62, display: 'grid', gridTemplateColumns: '30px minmax(0,1fr)', alignItems: 'center' }}>
      {icon}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="m">{title}</span>
        <span className="small mute">{sub}</span>
      </span>
    </button>
  );
}

function LoadSheet({ title = 'Peso y repeticiones', weight, reps, step, bodyweight, seconds = false, onClose, onSave, onUndo }: { title?: string; weight: number | null; reps: number; step: number; bodyweight: boolean; seconds?: boolean; onClose: () => void; onSave: (w: number | null, r: number) => void; onUndo?: () => void }) {
  const [wt, setWt] = useState(weight ?? 0);
  const [rp, setRp] = useState(reps);
  return (
    <Sheet label={title} onClose={onClose}>
      <h2 className="h2" style={{ margin: '16px 0 8px', fontSize: 24 }}>{title}</h2>
      {!bodyweight && (
        <div className="row" style={{ minHeight: 72 }}>
          <span className="t">Peso</span>
          <Stepper value={wt} onChange={setWt} step={step} label="peso" unit="kg" big />
        </div>
      )}
      <div className="row" style={{ minHeight: 72 }}>
        <span className="t">{seconds ? 'Segundos' : 'Repeticiones'}</span>
        <Stepper value={rp} onChange={(v) => setRp(Math.max(1, Math.round(v)))} step={1} label={seconds ? 'segundos' : 'repeticiones'} big />
      </div>
      <p className="xs mute" style={{ marginTop: 8 }}>Se aplica a las series que faltan.</p>
      <button type="button" className="btn" style={{ marginTop: 16 }} onClick={() => onSave(bodyweight ? null : wt, rp)}>
        Guardar
      </button>
      {onUndo && (
        <button type="button" className="txt" style={{ width: '100%', justifyContent: 'center' }} onClick={onUndo}>
          Marcar como no hecha
        </button>
      )}
    </Sheet>
  );
}

function NoteSheet({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (t: string) => void }) {
  const [t, setT] = useState(initial);
  return (
    <Sheet label="Nota" onClose={onClose}>
      <h2 className="h2" style={{ margin: '16px 0 8px', fontSize: 24 }}>Nota</h2>
      <label className="sr" htmlFor="note">Nota</label>
      <textarea id="note" className="notes" style={{ fontFamily: 'inherit', minHeight: 110 }} value={t} onChange={(e) => setT(e.target.value)} placeholder="Me molestó un poco la rodilla…" autoFocus />
      <button type="button" className="btn" style={{ marginTop: 16 }} onClick={() => onSave(t)}>
        Guardar nota
      </button>
    </Sheet>
  );
}

function BusySheet({
  s,
  entry,
  approved,
  inc,
  onClose,
  onAdvance,
  onAlternative,
  onWait,
}: {
  s: LiveState;
  entry: EntryLog;
  approved: (id: string | null, d: string[]) => string[];
  inc: { machine: number; dumbbell: number };
  onClose: () => void;
  onAdvance: (to: number) => void;
  onAlternative: (id: string, weight: number | null) => void;
  onWait: () => void;
}) {
  const x = ex(entry.exerciseId);
  const nx = compatibleNext(s.workout, s.current);
  const next = nx >= 0 ? s.workout.entries[nx] : null;
  const alts = approved(entry.exerciseId, x?.alts || []).map((id) => ex(id)).filter(Boolean);
  const weight = entry.sets.find((st) => !st.done)?.weight ?? entry.target.weight;
  const doneCount = entry.sets.filter((st) => st.done).length;
  return (
    <Sheet label="Máquina ocupada: elige cómo seguir" onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '18px 0 16px' }}>
        <h2 className="h2">{x?.name.split(' ')[0] || 'Máquina'} ocupada</h2>
        {doneCount > 0 && (
          <span className="small mute" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IcCheck /> {doneCount} {doneCount === 1 ? 'serie guardada' : 'series guardadas'}
          </span>
        )}
      </div>
      {next && (
        <button type="button" onClick={() => onAdvance(nx)} style={{ background: 'none', border: 0, borderTop: '1px solid var(--line)', width: '100%', textAlign: 'left', display: 'grid', gridTemplateColumns: '36px minmax(0,1fr) 20px', alignItems: 'center', padding: '18px 0' }}>
          <span className="small b accent-t" style={{ alignSelf: 'start', paddingTop: 2 }}>01</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="kicker accent">Recomendado</span>
            <span style={{ fontSize: 19, fontWeight: 500 }}>Adelantar {next.name.toLowerCase()}</span>
            <span className="small mute">
              {next.sets.length} × {next.target.reps} · Vuelves a {x?.name.toLowerCase()} después
            </span>
          </span>
          <IcChev className="chev" />
        </button>
      )}
      {alts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '36px minmax(0,1fr)', padding: '18px 0 6px', borderTop: '1px solid var(--line)' }}>
          <span className={`small b ${next ? 'mute' : 'accent-t'}`} style={{ paddingTop: 2 }}>{next ? '02' : '01'}</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 19, fontWeight: 500 }}>{next ? 'Alternativa aprobada' : 'Haz una alternativa'}</span>
            {alts.map((a, i) => {
              const eq = equivalent(x, a!, weight, inc);
              return (
                <button key={a!.id} type="button" onClick={() => onAlternative(a!.id, a!.load === 'bodyweight' ? null : eq)} style={{ background: 'none', border: 0, borderTop: i ? '1px solid var(--line)' : 0, padding: 0, marginTop: i ? 0 : 6, textAlign: 'left', minHeight: 52, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="m">{a!.name}</span>
                    <span className="xs mute">{a!.equipment}</span>
                    <span className="xs mute">{x?.alternativeNotes?.[a!.id] || 'Seleccionada por tu entrenador'}</span>
                  </span>
                  <span style={{ fontSize: 15 }}>
                    {a!.load === 'bodyweight' ? 'Peso corporal' : eq === null ? 'Ajustar carga' : `${a!.load === 'dumbbell' ? '2 × ' : ''}${n(eq)} kg`} · {a!.measure === x?.measure ? entry.target.reps : a!.measure === 'seconds' ? 30 : 10}{a!.measure === 'seconds' ? ' s' : ' reps'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <button type="button" onClick={onWait} style={{ background: 'none', border: 0, borderTop: '1px solid var(--line)', width: '100%', textAlign: 'left', display: 'grid', gridTemplateColumns: '36px minmax(0,1fr) 20px', alignItems: 'center', padding: '18px 0' }}>
        <span className="small b mute" style={{ alignSelf: 'start', paddingTop: 2 }}>{next && alts.length ? '03' : next || alts.length ? '02' : '01'}</span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 19, fontWeight: 500 }}>Esperar</span>
          <span className="small mute">Contador aparte · te pregunto a los 3 min</span>
        </span>
        <IcClock className="chev" />
      </button>
      <button type="button" className="txt mute" style={{ width: '100%', justifyContent: 'center', minHeight: 56, borderTop: '1px solid var(--line)' }} onClick={onClose}>
        Cerrar
      </button>
    </Sheet>
  );
}
