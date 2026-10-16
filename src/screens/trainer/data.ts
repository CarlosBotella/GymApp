import { ex } from '../../data/catalog';
import { useApp, useMe, useQuery } from '../../lib/app';
import { finished } from '../../lib/stats';
import type { Note, Profile, Routine, Suggestion, Workout } from '../../lib/types';
import { DAY, DOW_NAME, WEEK, dow, startOfWeek } from '../../lib/util';

export function useTrainerData() {
  const me = useMe();
  const clients = useQuery<Profile>('users', [['trainerId', me.id]]);
  const workouts = useQuery<Workout>('workouts', [['trainerId', me.id]]);
  const routines = useQuery<Routine>('routines', [['trainerId', me.id]]);
  const suggestions = useQuery<Suggestion>('suggestions', [['trainerId', me.id]]);
  const notes = useQuery<Note>('notes', [['trainerId', me.id]]);
  const ready = clients !== null && workouts !== null && routines !== null && suggestions !== null && notes !== null;
  return {
    ready,
    clients: (clients || []).sort((a, b) => a.name.localeCompare(b.name)),
    workouts: (workouts || []).sort((a, b) => a.startedAt - b.startedAt),
    routines: routines || [],
    templates: (routines || []).filter((r) => r.template && r.ownerId === me.id).sort((a, b) => (b.uses || 0) - (a.uses || 0) || b.updatedAt - a.updatedAt),
    suggestions: suggestions || [],
    notes: (notes || []).sort((a, b) => b.createdAt - a.createdAt),
  };
}

export type TrainerData = ReturnType<typeof useTrainerData>;

export interface Alert {
  key: string;
  client: Profile;
  title: string;
  sub: string;
  action: string;
  kind: 'week' | 'routine' | 'busy' | 'swap' | 'note' | 'noroutine';
  routineId?: string;
  exerciseId?: string;
  altId?: string;
  noteId?: string;
  accent?: boolean;
}

export function assignedFor(td: TrainerData, clientId: string, trainerId: string): Routine | undefined {
  return td.routines.filter((r) => r.clientId === clientId && r.ownerId === trainerId && !r.template).sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

export function alertsFor(td: TrainerData, me: Profile): Alert[] {
  const out: Alert[] = [];
  const dismissed = me.dismissed || {};
  const now = Date.now();
  for (const c of td.clients) {
    const ws = finished(td.workouts.filter((w) => w.clientId === c.id));
    const assigned = assignedFor(td, c.id, me.id);
    if (!assigned) {
      out.push({ key: `noroutine:${c.id}`, client: c, title: 'Sin rutina', sub: 'Asígnale una de tu biblioteca', action: 'Asignar', kind: 'noroutine', accent: true });
    } else {
      const done = ws.filter((w) => w.routineId === assigned.id && w.startedAt > assigned.updatedAt && w.status === 'done');
      const daysDone = new Set(done.map((w) => w.dayId));
      if (assigned.days.length && assigned.days.every((d) => daysDone.has(d.id))) {
        const easy = done.flatMap((w) => w.entries).filter((e) => e.sets.length && !e.sets.some((s) => s.feel === 'hard')).length;
        const total = done.flatMap((w) => w.entries).length;
        out.push({ key: `week:${assigned.id}:${assigned.updatedAt}`, client: c, title: `Semana ${assigned.week} terminada`, sub: `${easy} de ${total} ejercicios fueron bien`, action: 'Subir peso', kind: 'week', routineId: assigned.id, accent: true });
      }
      // Máquina ocupada repetida el mismo día de la semana
      const busy: Record<string, { n: number; dow: number }> = {};
      for (const w of ws.filter((x) => x.startedAt > now - 5 * WEEK)) {
        for (const b of w.busy || []) {
          const k = `${b.exerciseId}:${dow(w.startedAt)}`;
          busy[k] = { n: (busy[k]?.n || 0) + 1, dow: dow(w.startedAt) };
        }
      }
      for (const [k, v] of Object.entries(busy)) {
        if (v.n < 2) continue;
        const exId = k.split(':')[0];
        const inPlan = assigned.days.some((d) => d.exercises.some((p) => p.exerciseId === exId));
        if (!inPlan) continue;
        out.push({ key: `busy:${c.id}:${k}`, client: c, title: `${ex(exId)?.name.split(' ')[0] || 'Máquina'} ocupada ${v.n} ${DOW_NAME[v.dow]}`, sub: 'Moverla al final esos días', action: 'Mover', kind: 'busy', routineId: assigned.id, exerciseId: exId });
      }
      // Alternativa usada a menudo
      const swaps: Record<string, number> = {};
      for (const w of ws.filter((x) => x.startedAt > now - 4 * WEEK)) for (const e of w.entries) if (e.substituteOf && e.exerciseId) swaps[`${e.substituteOf}>${e.exerciseId}`] = (swaps[`${e.substituteOf}>${e.exerciseId}`] || 0) + 1;
      for (const [k, v] of Object.entries(swaps)) {
        if (v < 2) continue;
        const [from, to] = k.split('>');
        out.push({ key: `swap:${c.id}:${k}`, client: c, title: `Usó ${ex(to)?.name.toLowerCase()} ${v} veces`, sub: `En lugar de ${ex(from)?.name.toLowerCase()}. ¿Dejarla en la rutina?`, action: 'Cambiar', kind: 'swap', routineId: assigned.id, exerciseId: from, altId: to });
      }
    }
    // Rutinas que crea el cliente
    for (const r of td.routines.filter((x) => x.ownerId === c.id && x.ownerRole === 'client')) {
      if (now - r.updatedAt > 21 * DAY) continue;
      out.push({ key: `routine:${r.id}:${r.updatedAt}`, client: c, title: `${r.createdAt === r.updatedAt || now - r.createdAt < 7 * DAY ? 'Creó' : 'Cambió'} «${r.name}»`, sub: 'Revísala y sugiere cambios', action: 'Revisar', kind: 'routine', routineId: r.id });
    }
  }
  for (const nt of td.notes.filter((x) => !x.seen).slice(0, 5)) {
    const c = td.clients.find((x) => x.id === nt.clientId);
    if (!c) continue;
    out.push({ key: `note:${nt.id}`, client: c, title: nt.kind === 'alert' ? 'Aviso de progreso' : `Nota${nt.exerciseId ? ` · ${ex(nt.exerciseId)?.name}` : ''}`, sub: `«${nt.text}»`, action: 'Visto', kind: 'note', noteId: nt.id });
  }
  return out.filter((a) => !dismissed[a.key]);
}

export function sessionsThisWeek(td: TrainerData, clientId: string): number {
  const s = startOfWeek(Date.now());
  return td.workouts.filter((w) => w.clientId === clientId && w.startedAt >= s && w.status !== 'active').length;
}

export function useDismiss() {
  const { store } = useApp();
  const me = useMe();
  return (key: string) => store.update('users', me.id, { dismissed: { ...(me.dismissed || {}), [key]: Date.now() } });
}
