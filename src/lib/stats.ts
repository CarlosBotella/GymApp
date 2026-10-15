import type { GroupId, LoggedSet, Workout } from './types';
import { exerciseGroup, getExercise } from '../data/catalog';
import { weekStart } from './util';

/** 1RM estimado (Epley). Solo con 1-12 reps, más allá no es fiable. */
export function e1rm(weight: number | null, reps: number | null): number | null {
  if (!weight || !reps || reps < 1) return null;
  if (reps === 1) return weight;
  if (reps > 12) return null;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function doneSets(sets: LoggedSet[]): LoggedSet[] {
  return sets.filter((s) => s.done);
}

function byDateDesc(a: Workout, b: Workout) {
  return b.startedAt.localeCompare(a.startedAt);
}

export function finished(workouts: Workout[]): Workout[] {
  return workouts.filter((w) => w.finishedAt).sort(byDateDesc);
}

/** Series de la última vez que se hizo el ejercicio. */
export function lastPerformance(workouts: Workout[], exerciseId: string, excludeId?: string): { date: string; sets: LoggedSet[] } | null {
  for (const w of finished(workouts)) {
    if (w.id === excludeId) continue;
    const entry = w.entries.find((e) => e.exerciseId === exerciseId && doneSets(e.sets).length > 0);
    if (entry) return { date: w.startedAt, sets: doneSets(entry.sets) };
  }
  return null;
}

export interface Session {
  workoutId: string;
  date: string;
  sets: LoggedSet[];
  topWeight: number | null;
  bestE1rm: number | null;
  volume: number;
  totalReps: number;
}

/** Historial de un ejercicio, del más antiguo al más reciente. */
export function exerciseHistory(workouts: Workout[], exerciseId: string): Session[] {
  const out: Session[] = [];
  for (const w of finished(workouts).reverse()) {
    const sets = w.entries.filter((e) => e.exerciseId === exerciseId).flatMap((e) => doneSets(e.sets));
    if (!sets.length) continue;
    let top: number | null = null;
    let best: number | null = null;
    let volume = 0;
    let totalReps = 0;
    for (const s of sets) {
      if (s.weight != null && (top == null || s.weight > top)) top = s.weight;
      const est = e1rm(s.weight, s.reps);
      if (est != null && (best == null || est > best)) best = est;
      volume += (s.weight ?? 0) * (s.reps ?? 0);
      totalReps += s.reps ?? 0;
    }
    out.push({ workoutId: w.id, date: w.startedAt, sets, topWeight: top, bestE1rm: best, volume, totalReps });
  }
  return out;
}

export interface PR {
  exerciseId: string;
  kind: 'peso' | '1RM';
  value: number;
  previous: number | null;
}

/** Récords batidos en un entreno comparado con todos los anteriores. */
export function prsInWorkout(workout: Workout, all: Workout[]): PR[] {
  const before = finished(all).filter((w) => w.id !== workout.id && w.startedAt < workout.startedAt);
  const prs: PR[] = [];
  const seen = new Set<string>();
  for (const entry of workout.entries) {
    if (seen.has(entry.exerciseId)) continue;
    seen.add(entry.exerciseId);
    if (getExercise(entry.exerciseId).logType !== 'weight_reps') continue;
    const sets = workout.entries.filter((e) => e.exerciseId === entry.exerciseId).flatMap((e) => doneSets(e.sets));
    if (!sets.length) continue;
    const hist = exerciseHistory(before, entry.exerciseId);
    if (!hist.length) continue; // primera vez: no es récord, es el punto de partida
    const prevTop = Math.max(...hist.map((h) => h.topWeight ?? 0));
    const prevE = Math.max(...hist.map((h) => h.bestE1rm ?? 0));
    const top = Math.max(...sets.map((s) => s.weight ?? 0));
    const best = Math.max(...sets.map((s) => e1rm(s.weight, s.reps) ?? 0));
    if (top > prevTop && top > 0) prs.push({ exerciseId: entry.exerciseId, kind: 'peso', value: top, previous: prevTop || null });
    else if (best > prevE && best > 0) prs.push({ exerciseId: entry.exerciseId, kind: '1RM', value: best, previous: prevE || null });
  }
  return prs;
}

export function workoutTotals(w: Workout) {
  let sets = 0;
  let volume = 0;
  for (const e of w.entries) {
    for (const s of doneSets(e.sets)) {
      sets++;
      volume += (s.weight ?? 0) * (s.reps ?? 0);
    }
  }
  const ms = w.finishedAt ? new Date(w.finishedAt).getTime() - new Date(w.startedAt).getTime() : Date.now() - new Date(w.startedAt).getTime();
  return { sets, volume: Math.round(volume), ms };
}

/** Series efectivas por grupo muscular en la semana de `ref`. */
export function weeklySetsByGroup(workouts: Workout[], ref = new Date()): Record<GroupId, number> {
  const start = weekStart(ref).getTime();
  const end = start + 7 * 86400000;
  const out = { pierna: 0, pecho: 0, espalda: 0, hombro: 0, brazos: 0, core: 0, cardio: 0 } as Record<GroupId, number>;
  for (const w of finished(workouts)) {
    const t = new Date(w.startedAt).getTime();
    if (t < start || t >= end) continue;
    for (const e of w.entries) out[exerciseGroup(e.exerciseId)] += doneSets(e.sets).length;
  }
  return out;
}

/** Días entrenados (yyyy-mm-dd) para el calendario de constancia. */
export function trainedDays(workouts: Workout[]): Set<string> {
  return new Set(finished(workouts).map((w) => dayKey(new Date(w.startedAt))));
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function streakWeeks(workouts: Workout[]): number {
  const days = finished(workouts).map((w) => weekStart(new Date(w.startedAt)).getTime());
  const weeks = new Set(days);
  let n = 0;
  let cur = weekStart(new Date());
  if (!weeks.has(cur.getTime())) cur = new Date(cur.getTime() - 7 * 86400000);
  while (weeks.has(cur.getTime())) {
    n++;
    cur = new Date(cur.getTime() - 7 * 86400000);
  }
  return n;
}

/** Peso sugerido: si la última vez completó todas las reps objetivo, +2,5 kg. */
export function suggestWeight(last: LoggedSet | undefined, targetReps: number | null): number | null {
  if (!last || last.weight == null) return null;
  if (targetReps != null && last.reps != null && last.reps >= targetReps + 2) return last.weight + 2.5;
  return last.weight;
}
