import type { GroupId, LoggedSet, Routine, RoutineDay, SetTarget, Workout, WorkoutEntry } from './types';
import { getExercise } from '../data/catalog';
import { lastPerformance, suggestWeight } from './stats';
import { targetNumber, uid } from './util';

/** Entreno en curso. Vive en localStorage para no perder nada si se cierra la app. */
export interface Draft {
  workout: Workout;
  groups: GroupId[];
  /** Fin del descanso (epoch ms) y duración total para la barra. */
  restUntil: number | null;
  restTotal: number;
}

const key = (userId: string) => `gymapp.draft.${userId}`;

export function loadDraft(userId: string): Draft | null {
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraft(userId: string, d: Draft | null) {
  if (d) localStorage.setItem(key(userId), JSON.stringify(d));
  else localStorage.removeItem(key(userId));
}

/** Entrenos que no se pudieron guardar (sin cobertura en modo demo o error). */
const PENDING = (userId: string) => `gymapp.pending.${userId}`;

export function pendingWorkouts(userId: string): Workout[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING(userId)) || '[]');
  } catch {
    return [];
  }
}

export function setPending(userId: string, list: Workout[]) {
  if (list.length) localStorage.setItem(PENDING(userId), JSON.stringify(list));
  else localStorage.removeItem(PENDING(userId));
}

/**
 * Rutina que ve el cliente. Manda la del entrenador: si hay una activa, es esa.
 * Si no, la propia activa más reciente.
 */
export function effectiveRoutine(routines: Routine[]): Routine | null {
  const active = routines.filter((r) => r.active).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return active.find((r) => r.authorRole === 'trainer') ?? active[0] ?? null;
}

export function hasTrainerRoutine(routines: Routine[]): boolean {
  return routines.some((r) => r.active && r.authorRole === 'trainer');
}

export function emptySet(): LoggedSet {
  return { weight: null, reps: null, seconds: null, km: null, done: false };
}

/** Prepara las series precargando lo que hizo la última vez. */
export function buildEntry(exerciseId: string, target: SetTarget[], restSec: number, history: Workout[]): WorkoutEntry {
  const last = lastPerformance(history, exerciseId);
  const sets: LoggedSet[] = (target.length ? target : [{ reps: '' }, { reps: '' }, { reps: '' }]).map((t, i) => {
    const prev = last?.sets[Math.min(i, last.sets.length - 1)];
    const tn = targetNumber(t.reps);
    const ex = getExercise(exerciseId);
    return {
      ...emptySet(),
      weight: ex.logType === 'weight_reps' ? suggestWeight(prev, tn) : null,
      reps: tn ?? prev?.reps ?? null,
      seconds: ex.logType === 'time' || ex.logType === 'cardio' ? prev?.seconds ?? (ex.logType === 'time' ? tn : null) : null,
      km: ex.logType === 'cardio' ? prev?.km ?? null : null,
    };
  });
  return { uid: uid(), exerciseId, target: target.length ? target : [], restSec, sets };
}

export function startFromDay(clientId: string, routine: Routine, day: RoutineDay, history: Workout[]): Draft {
  return {
    groups: day.groups,
    restUntil: null,
    restTotal: 0,
    workout: {
      id: uid(),
      clientId,
      routineId: routine.id,
      dayId: day.id,
      dayName: day.name,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      entries: day.exercises.map((re) => {
        const e = buildEntry(re.exerciseId, re.sets, re.restSec, history);
        if (re.note) e.note = re.note;
        return e;
      }),
      feeling: null,
      notes: '',
      trainerComment: null,
    },
  };
}

export function startFree(clientId: string, groups: GroupId[], name: string): Draft {
  return {
    groups,
    restUntil: null,
    restTotal: 0,
    workout: {
      id: uid(),
      clientId,
      routineId: null,
      dayId: null,
      dayName: name,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      entries: [],
      feeling: null,
      notes: '',
      trainerComment: null,
    },
  };
}
