import type { Profile, Routine, Workout } from '../types';
import type { ProfilePatch, Repo } from './types';
import { seedRoutine } from '../../data/seed';
import { getExercise } from '../../data/catalog';
import { clone, shortCode, targetNumber, uid } from '../util';

/**
 * Modo demo: todo se guarda en localStorage de este dispositivo.
 * Trae un entrenador y dos clientes de ejemplo para probar los dos roles.
 */
interface Store {
  version: 1;
  sessionId: string | null;
  users: (Profile & { password?: string })[];
  routines: Routine[];
  workouts: Workout[];
}

const KEY = 'gymapp.demo';
export const DEMO_TRAINER = 'demo-trainer';
export const DEMO_CLIENT = 'demo-client';

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* datos corruptos: se regeneran */ }
  const s = seed();
  save(s);
  return s;
}

function save(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function resetDemo() {
  localStorage.removeItem(KEY);
}

const BASE_KG: Record<string, number> = {
  'incline-smith': 60, 'chest-press-hs': 80, 'pec-deck': 55, 'decline-press-hs': 90, 'lateral-cable': 7.5,
  'jm-press-smith': 40, 'pushdown-bar': 35, 'rear-delt-machine': 45, 'pulldown-neutral-hs': 70, 'pullover-cable': 30,
  'pulldown-narrow': 65, 'biceps-hs': 30, 'hammer-incline': 14, 'leg-ext': 60, 'hack-squat': 100, 'leg-press': 180,
  'bulgarian-smith': 40, 'kneel-curl': 20, 'seated-calf': 50, 'shoulder-press-hs': 60, 'lateral-db': 10, 'katana': 10,
  'row-hs-narrow': 80, 'lying-curl': 45, 'rdl-db': 30, 'hip-thrust': 120, 'abductor': 70, 'standing-calf': 90,
};

function seed(): Store {
  const now = new Date();
  const trainer: Profile = { id: DEMO_TRAINER, name: 'Ángel', role: 'trainer', trainerId: null, center: 'ruzafa', code: 'ONAIR1', exerciseNotes: {}, email: 'angel@demo' };
  const carlos: Profile = { id: DEMO_CLIENT, name: 'Carlos', role: 'client', trainerId: DEMO_TRAINER, center: 'ruzafa', code: null, exerciseNotes: { 'hack-squat': 'Respaldo en 3, pies en el centro de la plataforma' }, email: 'carlos@demo' };
  const lucia: Profile = { id: 'demo-client-2', name: 'Lucía', role: 'client', trainerId: DEMO_TRAINER, center: 'lesarts', code: null, exerciseNotes: {}, email: 'lucia@demo' };

  const routine = seedRoutine(carlos.id, trainer.id);
  routine.createdAt = new Date(now.getTime() - 22 * 86400000).toISOString();

  // Tres semanas de historial con progresión suave para que las gráficas tengan algo que enseñar.
  const workouts: Workout[] = [];
  for (let back = 20; back >= 1; back--) {
    const date = new Date(now);
    date.setDate(date.getDate() - back);
    const wd = (date.getDay() + 6) % 7; // 0 = lunes
    if (wd === 6) continue;
    if (back % 7 === 3) continue; // algún día saltado, como en la vida real
    const day = routine.days[wd % routine.days.length];
    const week = Math.floor((20 - back) / 7);
    date.setHours(18, 30, 0, 0);
    const start = date.toISOString();
    const end = new Date(date.getTime() + 70 * 60000).toISOString();
    workouts.push({
      id: uid(),
      clientId: carlos.id,
      routineId: routine.id,
      dayId: day.id,
      dayName: day.name,
      startedAt: start,
      finishedAt: end,
      feeling: 3 + (back % 3 === 0 ? 1 : 0),
      notes: '',
      trainerComment: back === 2 ? 'Buen trabajo en el hack, la semana que viene subimos 5 kg.' : null,
      entries: day.exercises.map((re) => {
        const base = BASE_KG[re.exerciseId] ?? 20;
        const isWarmupPattern = re.sets.length >= 6;
        return {
          uid: uid(),
          exerciseId: re.exerciseId,
          target: re.sets,
          restSec: re.restSec,
          sets: re.sets.map((t, i) => {
            const reps = targetNumber(t.reps) ?? 10;
            const factor = isWarmupPattern && i < 4 ? [0.5, 0.7, 0.85, 1.05][i] : 1;
            const kg = Math.round(((base + week * (base > 50 ? 5 : 2.5)) * factor) / 2.5) * 2.5;
            return { weight: getExercise(re.exerciseId).logType === 'weight_reps' ? kg : null, reps, seconds: null, km: null, done: true };
          }),
        };
      }),
    });
  }

  return { version: 1, sessionId: null, users: [trainer, carlos, lucia], routines: [routine], workouts };
}

type Listener = (me: Profile | null) => void;

export function createDemoRepo(): Repo {
  const listeners = new Set<Listener>();
  const me = () => {
    const s = load();
    return s.users.find((u) => u.id === s.sessionId) ?? null;
  };
  const emit = () => {
    const p = me();
    listeners.forEach((l) => l(p ? strip(p) : null));
  };
  const strip = (p: Profile & { password?: string }): Profile => {
    const { password: _pw, ...rest } = p;
    return clone(rest);
  };
  const mutate = <T>(fn: (s: Store) => T): T => {
    const s = load();
    const out = fn(s);
    save(s);
    return out;
  };
  const requireMe = () => {
    const p = me();
    if (!p) throw new Error('No has iniciado sesión.');
    return p;
  };

  const repo: Repo & { loginAs(id: string): void } = {
    mode: 'demo',
    onAuth(cb) {
      listeners.add(cb);
      queueMicrotask(() => {
        const p = me();
        cb(p ? strip(p) : null);
      });
      return () => listeners.delete(cb);
    },
    loginAs(id: string) {
      mutate((s) => { s.sessionId = id; });
      emit();
    },
    async signIn(email, password) {
      mutate((s) => {
        const u = s.users.find((x) => x.email?.toLowerCase() === email.toLowerCase().trim());
        if (!u || (u.password && u.password !== password)) throw new Error('Email o contraseña incorrectos.');
        s.sessionId = u.id;
      });
      emit();
    },
    async signUp({ email, password, name, role, center }) {
      mutate((s) => {
        if (s.users.some((u) => u.email?.toLowerCase() === email.toLowerCase())) throw new Error('Ya hay una cuenta con ese email.');
        const u: Profile & { password: string } = { id: uid(), name, role, center, trainerId: null, code: role === 'trainer' ? shortCode() : null, exerciseNotes: {}, email, password };
        s.users.push(u);
        s.sessionId = u.id;
      });
      emit();
    },
    async resetPassword() {
      throw new Error('En modo demo no hay correos. Usa uno de los usuarios de ejemplo.');
    },
    async signOut() {
      mutate((s) => { s.sessionId = null; });
      emit();
    },
    async updateMe(patch: ProfilePatch) {
      const id = requireMe().id;
      const p = mutate((s) => {
        const u = s.users.find((x) => x.id === id)!;
        Object.assign(u, patch);
        return strip(u);
      });
      emit();
      return p;
    },
    async joinTrainer(code) {
      const id = requireMe().id;
      const p = mutate((s) => {
        const t = s.users.find((u) => u.role === 'trainer' && u.code === code.trim().toUpperCase());
        if (!t) throw new Error('No hay ningún entrenador con ese código.');
        const u = s.users.find((x) => x.id === id)!;
        u.trainerId = t.id;
        return strip(u);
      });
      emit();
      return p;
    },
    async leaveTrainer() {
      const id = requireMe().id;
      const p = mutate((s) => {
        const u = s.users.find((x) => x.id === id)!;
        u.trainerId = null;
        return strip(u);
      });
      emit();
      return p;
    },
    async getProfile(id) {
      const u = load().users.find((x) => x.id === id);
      return u ? strip(u) : null;
    },
    async listClients() {
      const id = requireMe().id;
      return load().users.filter((u) => u.trainerId === id).map(strip);
    },
    async listRoutines(clientId) {
      return clone(load().routines.filter((r) => r.clientId === clientId));
    },
    async saveRoutine(r) {
      mutate((s) => {
        const i = s.routines.findIndex((x) => x.id === r.id);
        if (i >= 0) s.routines[i] = clone(r);
        else s.routines.push(clone(r));
      });
    },
    async deleteRoutine(r) {
      mutate((s) => { s.routines = s.routines.filter((x) => x.id !== r.id); });
    },
    async listWorkouts(clientId) {
      return clone(load().workouts.filter((w) => w.clientId === clientId));
    },
    async saveWorkout(w) {
      mutate((s) => {
        const i = s.workouts.findIndex((x) => x.id === w.id);
        if (i >= 0) s.workouts[i] = clone(w);
        else s.workouts.push(clone(w));
      });
    },
    async deleteWorkout(w) {
      mutate((s) => { s.workouts = s.workouts.filter((x) => x.id !== w.id); });
    },
    async commentWorkout(w, comment) {
      mutate((s) => {
        const x = s.workouts.find((y) => y.id === w.id);
        if (x) x.trainerComment = comment || null;
      });
    },
  };
  return repo;
}
