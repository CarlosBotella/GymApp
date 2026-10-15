import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp, useAsync } from '../../lib/app';
import { navigate } from '../../lib/router';
import { alternatives, getEquipment, getExercise } from '../../data/catalog';
import { lastPerformance } from '../../lib/stats';
import { buildEntry, emptySet, loadDraft, pendingWorkouts, saveDraft, setPending, type Draft } from '../../lib/workout';
import { fmtClock, fmtKg, parseNum, cx } from '../../lib/util';
import type { CenterId, LoggedSet, Workout, WorkoutEntry } from '../../lib/types';
import { Empty, ExerciseThumb, Sheet, TopBar } from '../../components/ui';
import { ExercisePicker } from '../../components/ExercisePicker';
import { PlateCalc } from '../../components/PlateCalc';
import { IconCheck, IconMore, IconNote, IconPlus } from '../../components/icons';

const FEEL = [
  { v: 1, t: 'Fatal' }, { v: 2, t: 'Flojo' }, { v: 3, t: 'Normal' }, { v: 4, t: 'Bien' }, { v: 5, t: 'Brutal' },
];

export function WorkoutLive() {
  const { repo, me, setMe, toast } = useApp();
  const [draft, setDraftState] = useState<Draft | null>(() => loadDraft(me.id));
  const history = useAsync(() => repo.listWorkouts(me.id), [me.id]);
  const [menu, setMenu] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'swap'; uid: string } | null>(null);
  const [plates, setPlates] = useState<{ uid: string; idx: number } | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const setDraft = useCallback((fn: (d: Draft) => Draft) => {
    setDraftState((prev) => {
      if (!prev) return prev;
      const next = fn(structuredClone(prev));
      saveDraft(me.id, next);
      return next;
    });
  }, [me.id]);

  useWakeLock();

  if (!draft) {
    return (
      <div className="screen no-tabs">
        <TopBar backTo="/" />
        <Empty title="No hay ningún entreno abierto" action={<button className="btn primary" onClick={() => navigate('/')}>Ir a Hoy</button>}>
          Empieza uno desde un día de tu rutina o con un entreno libre.
        </Empty>
      </div>
    );
  }

  const w = draft.workout;
  const past: Workout[] = history.data ?? [];

  const updateEntry = (uid: string, fn: (e: WorkoutEntry) => void) =>
    setDraft((d) => {
      const e = d.workout.entries.find((x) => x.uid === uid);
      if (e) fn(e);
      return d;
    });

  function toggleSet(entry: WorkoutEntry, idx: number) {
    const wasDone = entry.sets[idx].done;
    setDraft((d) => {
      const e = d.workout.entries.find((x) => x.uid === entry.uid)!;
      const s = e.sets[idx];
      s.done = !s.done;
      if (s.done) {
        const last = lastPerformance(past, e.exerciseId, d.workout.id);
        const prev = last?.sets[Math.min(idx, last.sets.length - 1)];
        if (s.weight == null && getExercise(e.exerciseId).logType === 'weight_reps') s.weight = prev?.weight ?? null;
        if (s.reps == null) s.reps = prev?.reps ?? null;
        d.restUntil = Date.now() + e.restSec * 1000;
        d.restTotal = e.restSec;
      }
      return d;
    });
    if (!wasDone && navigator.vibrate) navigator.vibrate(30);
  }

  function changeSet(uid: string, idx: number, field: keyof LoggedSet, value: number | null) {
    updateEntry(uid, (e) => {
      const old = e.sets[idx][field];
      (e.sets[idx] as any)[field] = value;
      // Arrastra el peso a las series siguientes que tenían el mismo valor y no están hechas.
      if (field === 'weight') {
        for (let j = idx + 1; j < e.sets.length; j++) {
          if (!e.sets[j].done && (e.sets[j].weight === old || e.sets[j].weight == null)) e.sets[j].weight = value;
          else break;
        }
      }
    });
  }

  async function finish(feeling: number | null, notes: string) {
    const done: Workout = {
      ...w,
      entries: w.entries.filter((e) => e.sets.some((s) => s.done)).map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })),
      finishedAt: new Date().toISOString(),
      feeling,
      notes,
    };
    if (!done.entries.length) {
      toast('No has marcado ninguna serie');
      return;
    }
    try {
      await repo.saveWorkout(done);
    } catch {
      setPending(me.id, [...pendingWorkouts(me.id), done]);
      toast('Sin conexión: se guardará al volver');
    }
    sessionStorage.setItem('gymapp.justDone', JSON.stringify(done));
    saveDraft(me.id, null);
    navigate(`/done/${done.id}`, { replace: true });
  }

  const totalSets = w.entries.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = w.entries.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  const menuEntry = w.entries.find((e) => e.uid === menu);
  const plateEntry = plates ? w.entries.find((e) => e.uid === plates.uid) : undefined;

  return (
    <div className="screen no-tabs">
      <TopBar backTo="/" right={<Clock since={w.startedAt} />} />
      <div className="wk-head">
        <h1 className="display" style={{ fontSize: 34 }}>{w.dayName}</h1>
      </div>
      <p className="muted small" style={{ margin: 0 }}>{doneSets} de {totalSets} series hechas</p>

      {w.entries.map((e) => (
        <ExerciseBlock
          key={e.uid}
          entry={e}
          past={past}
          workoutId={w.id}
          machineNote={me.exerciseNotes[e.exerciseId]}
          onToggle={(i) => toggleSet(e, i)}
          onChange={(i, f, v) => changeSet(e.uid, i, f, v)}
          onMenu={() => setMenu(e.uid)}
          onAddSet={() => updateEntry(e.uid, (x) => {
            const last = x.sets[x.sets.length - 1];
            x.sets.push({ ...emptySet(), weight: last?.weight ?? null, reps: last?.reps ?? null, seconds: last?.seconds ?? null });
          })}
          onPlates={(i) => setPlates({ uid: e.uid, idx: i })}
        />
      ))}

      {!w.entries.length && (
        <Empty title="Añade tu primer ejercicio">Te enseñamos solo los de {w.dayName.toLowerCase()}.</Empty>
      )}

      <button className="btn block" style={{ marginTop: 18 }} onClick={() => setPicker({ mode: 'add' })}>
        <IconPlus size={20} /> Añadir ejercicio
      </button>
      <button className="btn ghost danger block" style={{ marginTop: 10 }} onClick={() => setConfirmDiscard(true)}>Descartar entreno</button>

      {!draft.restUntil && (
        <div className="cta-bar"><div><button className="btn primary block" onClick={() => setFinishing(true)}>Terminar entreno</button></div></div>
      )}
      {draft.restUntil && (
        <RestBar
          until={draft.restUntil}
          total={draft.restTotal}
          onAdd={(s) => setDraft((d) => ({ ...d, restUntil: (d.restUntil ?? Date.now()) + s * 1000, restTotal: d.restTotal + s }))}
          onEnd={() => setDraft((d) => ({ ...d, restUntil: null }))}
        />
      )}

      {/* Menú de ejercicio */}
      <Sheet open={!!menuEntry} onClose={() => setMenu(null)} title={menuEntry ? getExercise(menuEntry.exerciseId).name : ''}>
        {menuEntry && (
          <div className="stack">
            <button className="btn" onClick={() => { setPicker({ mode: 'swap', uid: menuEntry.uid }); setMenu(null); }}>Cambiar por otra máquina</button>
            <button className="btn" onClick={() => { setNoteFor(menuEntry.exerciseId); setMenu(null); }}>Ajustes de la máquina</button>
            <RestEditor value={menuEntry.restSec} onChange={(v) => updateEntry(menuEntry.uid, (x) => { x.restSec = v; })} />
            <div className="row">
              <button className="btn grow" onClick={() => setDraft((d) => move(d, menuEntry.uid, -1))}>Subir</button>
              <button className="btn grow" onClick={() => setDraft((d) => move(d, menuEntry.uid, 1))}>Bajar</button>
            </div>
            {menuEntry.sets.length > 1 && (
              <button className="btn" onClick={() => updateEntry(menuEntry.uid, (x) => { x.sets.pop(); })}>Quitar la última serie</button>
            )}
            <button className="btn danger" onClick={() => { setDraft((d) => ({ ...d, workout: { ...d.workout, entries: d.workout.entries.filter((x) => x.uid !== menuEntry.uid) } })); setMenu(null); }}>
              Quitar ejercicio del entreno
            </button>
          </div>
        )}
      </Sheet>

      <ExercisePicker
        open={picker?.mode === 'add'}
        onClose={() => setPicker(null)}
        groups={draft.groups}
        center={me.center}
        onPick={(ex) => setDraft((d) => {
          d.workout.entries.push(buildEntry(ex.id, [{ reps: '12' }, { reps: '10' }, { reps: '10' }], 90, past));
          return d;
        })}
      />
      <SwapPicker
        entry={picker?.mode === 'swap' ? w.entries.find((e) => e.uid === picker.uid) : undefined}
        center={me.center}
        onClose={() => setPicker(null)}
        onPick={(uid, exId) => updateEntry(uid, (x) => {
          const fresh = buildEntry(exId, x.target, x.restSec, past);
          x.replacedId = x.replacedId ?? x.exerciseId;
          x.exerciseId = exId;
          x.sets = x.sets.map((s, i) => (s.done ? s : fresh.sets[i] ?? s));
        })}
      />

      <PlateCalc
        open={!!plates && !!plateEntry}
        onClose={() => setPlates(null)}
        base={getEquipment(getExercise(plateEntry?.exerciseId ?? '').equipmentId)?.baseWeight ?? 0}
        onUse={(kg) => plates && changeSet(plates.uid, plates.idx, 'weight', kg)}
      />

      <MachineNoteSheet
        exerciseId={noteFor}
        value={noteFor ? me.exerciseNotes[noteFor] ?? '' : ''}
        onClose={() => setNoteFor(null)}
        onSave={async (text) => {
          const notes = { ...me.exerciseNotes };
          if (text.trim()) notes[noteFor!] = text.trim();
          else delete notes[noteFor!];
          setMe(await repo.updateMe({ exerciseNotes: notes }));
          setNoteFor(null);
          toast('Ajustes guardados');
        }}
      />

      <FinishSheet open={finishing} onClose={() => setFinishing(false)} doneSets={doneSets} totalSets={totalSets} onFinish={finish} />

      <Sheet open={confirmDiscard} onClose={() => setConfirmDiscard(false)} title="¿Descartar el entreno?">
        <p className="lede">Se borra todo lo que has apuntado hoy en este entreno.</p>
        <div className="stack">
          <button className="btn danger" onClick={() => { saveDraft(me.id, null); setDraftState(null); navigate('/', { replace: true }); }}>Descartar</button>
          <button className="btn" onClick={() => setConfirmDiscard(false)}>Seguir entrenando</button>
        </div>
      </Sheet>
    </div>
  );
}

function move(d: Draft, uid: string, dir: number): Draft {
  const list = d.workout.entries;
  const i = list.findIndex((x) => x.uid === uid);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return d;
  [list[i], list[j]] = [list[j], list[i]];
  return d;
}

function ExerciseBlock({
  entry, past, workoutId, machineNote, onToggle, onChange, onMenu, onAddSet, onPlates,
}: {
  entry: WorkoutEntry;
  past: Workout[];
  workoutId: string;
  machineNote?: string;
  onToggle(i: number): void;
  onChange(i: number, f: keyof LoggedSet, v: number | null): void;
  onMenu(): void;
  onAddSet(): void;
  onPlates(i: number): void;
}) {
  const ex = getExercise(entry.exerciseId);
  const eq = getEquipment(ex.equipmentId);
  const last = lastPerformance(past, entry.exerciseId, workoutId);
  const allDone = entry.sets.length > 0 && entry.sets.every((s) => s.done);
  const canPlates = eq && (eq.kind === 'plate_loaded' || eq.kind === 'smith' || ex.equipmentId === 'barbell');
  const lt = ex.logType;

  return (
    <section className="ex-block" aria-label={ex.name}>
      <div className="ex-title">
        <ExerciseThumb exerciseId={ex.id} />
        <div className="grow">
          <h3>{ex.name} {allDone && <span className="ex-done-mark"><IconCheck size={20} /></span>}</h3>
          <div className="eq">
            {eq ? [eq.brand, eq.model ?? eq.name].filter(Boolean).join(' ') : ''}
            {ex.unilateral ? ' · por lado' : ''}
            {` · descanso ${fmtClock(entry.restSec)}`}
          </div>
        </div>
        <button className="icon-btn" aria-label={`Opciones de ${ex.name}`} onClick={onMenu}><IconMore /></button>
      </div>
      {entry.replacedId && <div className="ex-note muted">En lugar de {getExercise(entry.replacedId).name}</div>}
      {machineNote && <div className="ex-note"><IconNote size={16} /> {machineNote}</div>}
      {entry.note && <div className="ex-note muted">{entry.note}</div>}
      <div className="ex-last">
        {last
          ? <>Última vez: <b>{last.sets.map((s) => setText(s, lt)).join(' · ')}</b></>
          : 'Primera vez con este ejercicio'}
      </div>

      <div className="sets">
        <div className="set-head">
          <span>Serie</span>
          <span>{lt === 'weight_reps' ? 'kg' : lt === 'cardio' ? 'min' : lt === 'time' ? 'seg' : ''}</span>
          <span />
          <span>{lt === 'cardio' ? 'km' : lt === 'time' ? '' : 'reps'}</span>
          <span />
        </div>
        {entry.sets.map((s, i) => {
          const prev = last?.sets[Math.min(i, last.sets.length - 1)];
          const tgt = entry.target[i]?.reps;
          return (
            <div key={i} className={cx('set-row', s.done && 'done')}>
              <span className="idx">{i + 1}</span>
              {lt === 'weight_reps' && (
                <NumInput label={`Peso serie ${i + 1}`} value={s.weight} placeholder={prev?.weight} onChange={(v) => onChange(i, 'weight', v)}
                  onLongPress={canPlates ? () => onPlates(i) : undefined} />
              )}
              {lt === 'reps' && <span />}
              {lt === 'time' && (
                <NumInput label={`Segundos serie ${i + 1}`} value={s.seconds} placeholder={prev?.seconds} onChange={(v) => onChange(i, 'seconds', v)} />
              )}
              {lt === 'cardio' && (
                <NumInput label="Minutos" value={s.seconds != null ? s.seconds / 60 : null} placeholder={prev?.seconds != null ? prev.seconds / 60 : null} onChange={(v) => onChange(i, 'seconds', v == null ? null : Math.round(v * 60))} />
              )}
              <span className="x">{lt === 'weight_reps' ? '×' : ''}</span>
              {lt === 'weight_reps' || lt === 'reps' ? (
                <NumInput label={`Repeticiones serie ${i + 1}`} value={s.reps} placeholder={prev?.reps ?? (tgt ? parseNum(tgt) : null)} integer onChange={(v) => onChange(i, 'reps', v)} />
              ) : lt === 'cardio' ? (
                <NumInput label="Kilómetros" value={s.km} placeholder={prev?.km} onChange={(v) => onChange(i, 'km', v)} />
              ) : <span />}
              <button className="check" aria-pressed={s.done} aria-label={`Serie ${i + 1} ${s.done ? 'hecha' : 'pendiente'}`} onClick={() => onToggle(i)}>
                <IconCheck size={26} />
              </button>
              {tgt && <span className="tgt">Objetivo {tgt}{lt === 'time' ? ' s' : ' reps'}</span>}
            </div>
          );
        })}
      </div>
      <div className="ex-tools">
        <button className="btn small ghost" onClick={onAddSet}><IconPlus size={18} /> Serie</button>
        {canPlates && <button className="btn small ghost" onClick={() => onPlates(Math.max(0, entry.sets.findIndex((s) => !s.done)))}>Calcular discos</button>}
      </div>
    </section>
  );
}

function setText(s: LoggedSet, lt: string): string {
  if (lt === 'weight_reps') return `${fmtKg(s.weight)}×${s.reps ?? '–'}`;
  if (lt === 'reps') return `${s.reps ?? '–'}`;
  if (lt === 'time') return `${s.seconds ?? '–'} s`;
  return `${s.seconds != null ? Math.round(s.seconds / 60) : '–'} min${s.km ? ` · ${fmtKg(s.km)} km` : ''}`;
}

/** Input numérico que acepta coma decimal y no pierde lo que escribes a medias. */
function NumInput({ value, onChange, placeholder, label, integer, onLongPress }: {
  value: number | null;
  onChange(v: number | null): void;
  placeholder?: number | null;
  label: string;
  integer?: boolean;
  onLongPress?(): void;
}) {
  const [text, setText] = useState(value == null ? '' : fmtKg(value));
  const focused = useRef(false);
  const press = useRef<number>();
  useEffect(() => {
    if (!focused.current) setText(value == null ? '' : fmtKg(value));
  }, [value]);
  return (
    <input
      className="num-in"
      aria-label={label}
      inputMode={integer ? 'numeric' : 'decimal'}
      enterKeyHint="done"
      value={text}
      placeholder={placeholder != null ? fmtKg(placeholder) : '–'}
      onFocus={(e) => { focused.current = true; e.target.select(); }}
      onBlur={() => { focused.current = false; setText(value == null ? '' : fmtKg(value)); }}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, '');
        setText(t);
        const n = parseNum(t);
        if (t === '' || n != null) onChange(n);
      }}
      onTouchStart={onLongPress ? () => { press.current = window.setTimeout(onLongPress, 550); } : undefined}
      onTouchEnd={onLongPress ? () => window.clearTimeout(press.current) : undefined}
      onTouchMove={onLongPress ? () => window.clearTimeout(press.current) : undefined}
    />
  );
}

function Clock({ since }: { since: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const s = (Date.now() - new Date(since).getTime()) / 1000;
  const h = Math.floor(s / 3600);
  return <span className="wk-clock" aria-label="Tiempo de entreno">{h ? `${h}:${fmtClock(s % 3600).padStart(5, '0')}` : fmtClock(s)}</span>;
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.55);
  } catch { /* sin audio */ }
}

function RestBar({ until, total, onAdd, onEnd }: { until: number; total: number; onAdd(s: number): void; onEnd(): void }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  useEffect(() => {
    fired.current = false;
  }, [until]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const left = (until - now) / 1000;
  useEffect(() => {
    if (left <= 0 && !fired.current) {
      fired.current = true;
      navigator.vibrate?.([200, 100, 200]);
      beep();
    }
    if (left < -8) onEnd();
  }, [left, onEnd]);
  const pct = Math.max(0, Math.min(100, (left / Math.max(total, 1)) * 100));
  return (
    <div className={cx('rest', left <= 0 && 'over')} role="timer" aria-live="off">
      <span className="bar" style={{ width: `${pct}%` }} />
      <div>
        <span className="clock">{left > 0 ? fmtClock(left) : '¡Ya!'}</span>
        <span className="grow small muted">{left > 0 ? 'Descanso' : 'A por la siguiente serie'}</span>
        <button className="btn small" onClick={() => onAdd(15)}>+15 s</button>
        <button className="btn small" onClick={onEnd}>{left > 0 ? 'Saltar' : 'Cerrar'}</button>
      </div>
    </div>
  );
}

function RestEditor({ value, onChange }: { value: number; onChange(v: number): void }) {
  const opts = [45, 60, 75, 90, 120, 150, 180];
  return (
    <div className="field">
      <span>Descanso entre series</span>
      <div className="chips">
        {opts.map((o) => (
          <button key={o} className="chip" aria-pressed={value === o} onClick={() => onChange(o)}>{fmtClock(o)}</button>
        ))}
      </div>
    </div>
  );
}

function SwapPicker({ entry, center, onClose, onPick }: { entry?: WorkoutEntry; center: CenterId; onClose(): void; onPick(uid: string, exId: string): void }) {
  if (!entry) return null;
  const alts = alternatives(entry.exerciseId, center);
  const ex = getExercise(entry.exerciseId);
  return (
    <ExercisePicker
      open
      onClose={onClose}
      title={alts.length ? `En lugar de ${ex.name}` : 'Cambiar por…'}
      only={alts.length ? alts : undefined}
      center={center}
      onPick={(n) => onPick(entry.uid, n.id)}
    />
  );
}

function MachineNoteSheet({ exerciseId, value, onClose, onSave }: { exerciseId: string | null; value: string; onClose(): void; onSave(t: string): void }) {
  const [t, setT] = useState(value);
  useEffect(() => setT(value), [value, exerciseId]);
  return (
    <Sheet open={!!exerciseId} onClose={onClose} title="Ajustes de la máquina">
      <p className="lede small">Se guarda para la próxima vez: altura del asiento, respaldo, agarre…</p>
      <textarea className="input" value={t} onChange={(e) => setT(e.target.value)} placeholder="Asiento en 4, respaldo en 2" autoFocus />
      <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => onSave(t)}>Guardar ajustes</button>
    </Sheet>
  );
}

function FinishSheet({ open, onClose, onFinish, doneSets, totalSets }: { open: boolean; onClose(): void; onFinish(f: number | null, n: string): Promise<void>; doneSets: number; totalSets: number }) {
  const [feel, setFeel] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="Terminar entreno">
      {doneSets < totalSets && (
        <p className="lede small">Llevas {doneSets} de {totalSets} series. Las que no has marcado no se guardan.</p>
      )}
      <div className="field">
        <span>¿Qué tal ha ido?</span>
        <div className="feel">
          {FEEL.map((f) => (
            <button key={f.v} aria-pressed={feel === f.v} onClick={() => setFeel(feel === f.v ? null : f.v)}>
              <b>{f.v}</b>{f.t}
            </button>
          ))}
        </div>
      </div>
      <label className="field" style={{ marginTop: 14 }}>
        <span>Notas para tu entrenador (opcional)</span>
        <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Molestia en la rodilla izquierda en el hack" />
      </label>
      <button className="btn primary block" style={{ marginTop: 16 }} disabled={busy || doneSets === 0} onClick={async () => {
        setBusy(true);
        try { await onFinish(feel, notes); } finally { setBusy(false); }
      }}>Guardar entreno</button>
      {doneSets === 0 && <p className="muted small" style={{ textAlign: 'center' }}>Marca al menos una serie con ✓ para guardar.</p>}
    </Sheet>
  );
}

function useWakeLock() {
  useEffect(() => {
    let lock: any = null;
    const req = async () => {
      try { lock = await (navigator as any).wakeLock?.request('screen'); } catch { /* no soportado */ }
    };
    req();
    const onVis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release?.();
    };
  }, []);
}
