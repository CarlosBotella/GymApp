import { ex } from '../data/catalog';
import type { Store } from './db';
import { lastEntryFor, progress } from './stats';
import type { EntryLog, PlanExercise, Profile, Routine, RoutineDay, Workout } from './types';
import { uid } from './util';

// Entreno en curso: se guarda en el móvil a cada toque (funciona sin conexión)
// y se copia a la base de datos al hacer cada serie.
const KEY = 'gym:active';

export interface LiveState {
  workout: Workout;
  current: number; // índice de la entrada en curso
  restUntil: number | null;
  restTotal: number;
  waitingSince: number | null;
  /** entrada cuya máquina estaba ocupada y queda pendiente */
  pending: number[];
  feelAsked: boolean;
}

export function loadLive(clientId: string): LiveState | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null') as LiveState | null;
    if (!s || s.workout.clientId !== clientId || s.workout.status !== 'active') return null;
    return s;
  } catch {
    return null;
  }
}

export function saveLive(s: LiveState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* lleno */
  }
}

/**
 * Carga de hoy: si el plan se cambió después del último entreno, manda el plan;
 * si no, se aplica la progresión sobre lo que hizo la última vez.
 */
export function targetFor(p: PlanExercise, history: Workout[], dayId: string | null, routineUpdatedAt: number, inc: { machine: number; dumbbell: number }) {
  const last = lastEntryFor(history, p, dayId);
  const lastAt = last ? Math.max(...last.sets.map((s) => s.at || 0)) : 0;
  if (!last || lastAt < routineUpdatedAt) {
    const lastW = last?.sets.find((s) => s.done)?.weight ?? null;
    return { weight: p.weight ?? lastW, reps: p.reps };
  }
  const lastW = last.sets.find((s) => s.done)?.weight ?? p.weight;
  const pr = progress({ ...p, weight: lastW }, last, inc);
  return { weight: pr.to.weight, reps: Math.max(p.reps, pr.to.reps) };
}

export function entryFromPlan(p: PlanExercise, history: Workout[], dayId: string | null, routineUpdatedAt = 0, inc = { machine: 2.5, dumbbell: 2 }): EntryLog {
  const x = ex(p.exerciseId);
  const t = targetFor(p, history, dayId, routineUpdatedAt, inc);
  return {
    id: uid(8),
    planId: p.id,
    exerciseId: p.exerciseId,
    name: x?.name || p.rawName || 'Ejercicio',
    target: { sets: p.sets, reps: t.reps, weight: t.weight },
    sets: Array.from({ length: p.sets }, () => ({ weight: t.weight, reps: t.reps, done: false, feel: null, at: null })),
  };
}

export function startWorkout(me: Profile, routine: Routine | null, day: RoutineDay, history: Workout[], inc = { machine: 2.5, dumbbell: 2 }): LiveState {
  const w: Workout = {
    id: uid(),
    clientId: me.id,
    trainerId: me.trainerId || null,
    routineId: routine?.id || null,
    dayId: day.id,
    dayName: day.name,
    group: day.group,
    startedAt: Date.now(),
    endedAt: null,
    status: 'active',
    entries: day.exercises.map((p) => entryFromPlan(p, history, day.id, routine?.updatedAt || 0, inc)),
  };
  const s: LiveState = { workout: w, current: 0, restUntil: null, restTotal: 0, waitingSince: null, pending: [], feelAsked: false };
  saveLive(s);
  return s;
}

export function syncLive(store: Store, s: LiveState) {
  void store.set('workouts', s.workout.id, s.workout);
}

export function nextSetIndex(e: EntryLog): number {
  const i = e.sets.findIndex((x) => !x.done);
  return i === -1 ? e.sets.length : i;
}

export function entryDone(e: EntryLog): boolean {
  return e.skipped === true || e.sets.every((x) => x.done);
}

/** Siguiente entrada sin terminar, empezando por la de después de la actual */
export function nextOpen(w: Workout, from: number, skip: number[] = []): number {
  const n = w.entries.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (!entryDone(w.entries[i]) && !skip.includes(i)) return i;
  }
  return -1;
}

/** Para «máquina ocupada»: siguiente ejercicio pendiente que no use la misma máquina ni el mismo grupo si se puede */
export function compatibleNext(w: Workout, from: number): number {
  const cur = ex(w.entries[from]?.exerciseId);
  const open = w.entries.map((e, i) => ({ e, i })).filter(({ e, i }) => i !== from && !entryDone(e));
  const diffGroup = open.find(({ e }) => ex(e.exerciseId)?.group !== cur?.group);
  return (diffGroup || open[0])?.i ?? -1;
}

export function finishWorkout(store: Store, s: LiveState, status: 'done' | 'incomplete' = 'done'): Workout {
  const w: Workout = { ...s.workout, status, endedAt: Date.now(), planned: s.workout.entries.reduce((a, e) => a + (e.skipped ? 0 : Math.max(e.target.sets, e.sets.length)), 0) };
  // series sin hacer fuera
  w.entries = w.entries.map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) })).filter((e) => e.sets.length || e.note);
  void store.set('workouts', w.id, w);
  saveLive(null);
  return w;
}
