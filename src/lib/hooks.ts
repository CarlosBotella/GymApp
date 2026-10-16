import { useMemo } from 'react';
import { useApp, useDoc, useQuery } from './app';
import { learnWeek, nextDay } from './stats';
import type { BodyReport, MachinePrefs, Profile, Routine, Suggestion, Workout } from './types';

/** Datos de un cliente: los ve el propio cliente o su entrenador */
export function useClientData(clientId: string, viewer: Profile) {
  const asTrainer = viewer.role === 'trainer';
  const workouts = useQuery<Workout>('workouts', asTrainer ? [['clientId', clientId], ['trainerId', viewer.id]] : [['clientId', clientId]]);
  const assigned = useQuery<Routine>('routines', asTrainer ? [['clientId', clientId], ['ownerId', viewer.id]] : [['clientId', clientId]]);
  const own = useQuery<Routine>('routines', asTrainer ? [['ownerId', clientId], ['trainerId', viewer.id]] : [['ownerId', clientId]]);
  const reports = useQuery<BodyReport>('bodyReports', asTrainer ? [['clientId', clientId], ['trainerId', viewer.id]] : [['clientId', clientId]]);
  const suggestions = useQuery<Suggestion>('suggestions', asTrainer ? [['clientId', clientId], ['trainerId', viewer.id]] : [['clientId', clientId]]);
  return useMemo(() => {
    const ready = workouts !== null && assigned !== null && own !== null && reports !== null && suggestions !== null;
    const ws = (workouts || []).slice().sort((a, b) => a.startedAt - b.startedAt);
    const fromTrainer = (assigned || []).filter((r) => r.ownerRole === 'trainer' && !r.template).sort((a, b) => b.updatedAt - a.updatedAt);
    const mine = (own || []).filter((r) => r.ownerId === clientId && r.ownerRole === 'client').sort((a, b) => b.updatedAt - a.updatedAt);
    const learned = learnWeek(ws);
    const main = fromTrainer[0] || mine[0] || null;
    return {
      ready,
      workouts: ws,
      fromTrainer,
      mine,
      main,
      learned,
      next: nextDay(main, ws, learned),
      reports: (reports || []).slice().sort((a, b) => a.date - b.date),
      suggestions: suggestions || [],
    };
  }, [workouts, assigned, own, reports, suggestions, clientId]);
}

export function useMachinePrefs(): [MachinePrefs, (p: MachinePrefs) => void] {
  const { store, profile } = useApp();
  const col = `users/${profile?.id}/private`;
  const doc = useDoc<MachinePrefs>(col, profile ? 'machines' : null);
  const prefs: MachinePrefs = { settings: doc?.settings || {}, notes: doc?.notes || {} };
  return [prefs, (p) => void store.set(col, 'machines', p)];
}

/** Alternativas que el cliente puede usar: las aprobadas por su entrenador (o las del catálogo) */
export function useApprovedAlts(): (exerciseId: string | null, defaults: string[]) => string[] {
  const { profile } = useApp();
  const trainer = useDoc<Profile>('users', profile?.role === 'client' ? profile.trainerId : null);
  return (id, defaults) => {
    if (!id) return [];
    const a = trainer?.approvedAlts?.[id];
    return a ? a : defaults;
  };
}
