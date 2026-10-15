import type { GroupId, Routine, RoutineDay } from '../lib/types';
import { uid } from '../lib/util';

type DaySpec = [name: string, groups: GroupId[], exercises: [exerciseId: string, reps: string, restSec?: number][], description?: string];

/**
 * Rutina de la semana sacada de las capturas.
 * Las series que salían cortadas ("10-6-4-1…") están completadas a ojo: revísalas en el editor.
 */
const WEEK: DaySpec[] = [
  ['Pecho + hombro + tríceps', ['pecho', 'hombro', 'brazos'], [
    ['incline-smith', '10-6-4-1-8-8-8', 120],
    ['chest-press-hs', '10-10-8-8', 120],
    ['pec-deck', '12-12-10-10', 90],
    ['decline-press-hs', '15-12-12', 90],
    ['lateral-cable', '15-12-12-12', 60],
    ['jm-press-smith', '10-10-8', 90],
    ['pushdown-bar', '12-10-10', 60],
  ]],
  ['Espalda + bíceps', ['espalda', 'hombro', 'brazos'], [
    ['rear-delt-machine', '15-15-12-12', 60],
    ['pulldown-neutral-hs', '10-6-4-1-8-8', 120],
    ['pullover-cable', '12-12-10-10', 75],
    ['pulldown-narrow', '10-8-8-6', 90],
    ['biceps-hs', '12-10-10-10', 75],
    ['hammer-incline', '12-10-10-10', 75],
  ]],
  ['Pierna cuádriceps', ['pierna'], [
    ['leg-ext', '15-12-12', 75],
    ['hack-squat', '10-6-4-1-8-8-8', 150],
    ['leg-press', '12-10-10-10', 120],
    ['bulgarian-smith', '12-12-10', 90],
    ['kneel-curl', '12-10-10-10', 75],
    ['seated-calf', '15-15-12-12', 60],
  ]],
  ['Hombro lat + pecho DRAGON H', ['hombro', 'pecho', 'brazos'], [
    ['lateral-cable', '15-15-12', 60],
    ['shoulder-press-hs', '10-6-10-8-8-8', 120],
    ['lateral-db', '15-12-12', 60],
    ['pec-deck', '12-12-10', 75],
    ['katana', '12-10-10', 60],
  ], 'Sesión enfocada en el deltoide lateral como músculo prioritario, clave para ganar anchura de hombros.'],
  ['Espalda grosor + bíceps', ['espalda', 'hombro', 'brazos'], [
    ['rear-delt-machine', '15-15-12', 60],
    ['row-hs-narrow', '10-6-4-1-8-8-8', 120],
    ['pulldown-narrow', '10-8-8-6', 90],
    ['pullover-cable', '12-12-10-10', 75],
    ['biceps-hs', '12-10-10', 75],
    ['hammer-incline', '12-10-10', 75],
  ]],
  ['Pierna femoral + glúteo', ['pierna'], [
    ['lying-curl', '15-12-12', 75],
    ['rdl-db', '10-6-8-8-8-8', 120],
    ['hip-thrust', '10-10-8', 120],
    ['lying-curl', '12-10-10', 75],
    ['abductor', '15-15-15', 60],
    ['standing-calf', '15-15-12-12', 60],
  ]],
];

export function weekDays(): RoutineDay[] {
  return WEEK.map(([name, groups, exercises, description]) => ({
    id: uid(),
    name,
    description,
    groups,
    exercises: exercises.map(([exerciseId, reps, restSec]) => ({
      uid: uid(),
      exerciseId,
      sets: reps.split('-').map((r) => ({ reps: r })),
      restSec: restSec ?? 90,
    })),
  }));
}

export function seedRoutine(clientId: string, trainerId: string): Routine {
  const now = new Date().toISOString();
  return {
    id: uid(),
    clientId,
    authorId: trainerId,
    authorRole: 'trainer',
    name: 'Semana de octubre',
    description: 'Rutina de 6 días. Las series de aproximación (10-6-4-1) van antes de las efectivas.',
    days: weekDays(),
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}
