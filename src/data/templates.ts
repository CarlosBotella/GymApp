import type { DayGroup, PlanExercise, Routine, RoutineDay } from '../lib/types';
import { uid } from '../lib/util';

type Line = [string, number, number, number | null];

function day(name: string, group: DayGroup, lines: Line[]): RoutineDay {
  return {
    id: uid(8),
    name,
    group,
    exercises: lines.map(([exerciseId, sets, reps, weight]): PlanExercise => ({ id: uid(8), exerciseId, sets, reps, weight })),
  };
}

export interface Base {
  key: string;
  name: string;
  daysLabel: string;
  build: () => RoutineDay[];
}

// Bases para el primer día del entrenador: se copian a su biblioteca y pasan a ser suyas.
export const BASES: Base[] = [
  {
    key: 'fullbody',
    name: 'Full body',
    daysLabel: '3 días',
    build: () => [
      day('Día A', 'fullbody', [['sentadilla', 3, 8, null], ['press-banca', 3, 8, null], ['remo-polea-baja', 3, 10, null], ['curl-femoral-tumbado', 3, 12, null], ['plancha', 3, 40, null]]),
      day('Día B', 'fullbody', [['prensa', 3, 10, null], ['press-militar-mancuernas', 3, 10, null], ['jalon-pecho', 3, 10, null], ['hip-thrust', 3, 10, null], ['crunch-polea', 3, 12, null]]),
      day('Día C', 'fullbody', [['peso-muerto-rumano', 3, 8, null], ['press-inclinado-mancuernas', 3, 10, null], ['remo-mancuerna', 3, 10, null], ['zancadas', 3, 10, null], ['elevaciones-laterales', 3, 12, null]]),
    ],
  },
  {
    key: 'torso-pierna',
    name: 'Pierna / Torso',
    daysLabel: '3 o 4 días',
    build: () => [
      day('Pierna · Día A', 'pierna', [['prensa', 4, 10, null], ['sentadilla-bulgara', 3, 10, null], ['curl-femoral-tumbado', 3, 12, null], ['extension-cuadriceps', 3, 12, null], ['gemelo-pie', 4, 15, null]]),
      day('Torso · Día B', 'torso', [['press-banca', 4, 8, null], ['remo-barra', 4, 8, null], ['press-militar-mancuernas', 3, 10, null], ['jalon-pecho', 3, 10, null], ['face-pull', 3, 15, null], ['triceps-polea', 3, 12, null]]),
    ],
  },
  {
    key: 'ppl',
    name: 'Empuje / Tirón / Pierna',
    daysLabel: '3 o 6 días',
    build: () => [
      day('Empuje', 'empuje', [['press-banca', 4, 8, null], ['press-inclinado-mancuernas', 3, 10, null], ['press-militar-mancuernas', 3, 10, null], ['elevaciones-laterales', 3, 12, null], ['triceps-polea', 3, 12, null]]),
      day('Tirón', 'tiron', [['jalon-pecho', 4, 10, null], ['remo-polea-baja', 3, 10, null], ['remo-mancuerna', 3, 10, null], ['face-pull', 3, 15, null], ['curl-mancuernas', 3, 12, null]]),
      day('Pierna', 'pierna', [['sentadilla', 4, 8, null], ['prensa', 3, 10, null], ['curl-femoral-tumbado', 3, 12, null], ['hip-thrust', 3, 10, null], ['gemelo-pie', 4, 15, null]]),
    ],
  },
];

export function routineFromBase(b: Base, ownerId: string): Routine {
  const now = Date.now();
  return {
    id: uid(),
    ownerId,
    ownerRole: 'trainer',
    clientId: null,
    trainerId: ownerId,
    name: b.name,
    days: b.build(),
    template: true,
    week: 1,
    createdAt: now,
    updatedAt: now,
    uses: 0,
  };
}
