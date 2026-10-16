export type Role = 'client' | 'trainer';

export type GroupId = 'pierna' | 'pecho' | 'espalda' | 'hombro' | 'brazos' | 'core';
export type DayGroup = 'pierna' | 'torso' | 'empuje' | 'tiron' | 'brazos' | 'hombro' | 'pecho' | 'espalda' | 'fullbody' | 'core';
export type Load = 'plates' | 'stack' | 'barbell' | 'dumbbell' | 'bodyweight';
export type Feel = 'easy' | 'ok' | 'hard';

export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  group: GroupId;
  muscles: string;
  equipment: string;
  load: Load;
  /** peso de trabajo típico de un intermedio, para calcular equivalencias entre alternativas */
  ref: number;
  alts: string[];
  steps: [string, string, string];
  look?: [string, string, string];
  kind: 'press45' | 'machine' | 'cable' | 'barbell' | 'dumbbell' | 'bodyweight' | 'bench';
}

export interface Settings {
  restSec: number;
  alert: 'both' | 'vibrate' | 'sound' | 'none';
  incMachine: number;
  incDumbbell: number;
  theme: 'auto' | 'light' | 'dark';
  wakeLock: boolean;
}

export interface Profile {
  id: string;
  name: string;
  email?: string;
  role: Role;
  trainerId?: string | null;
  trainerName?: string | null;
  linkedAt?: number | null;
  shareBody?: boolean;
  days?: number;
  createdAt: number;
  settings?: Partial<Settings>;
  /** solo entrenador: alternativas aprobadas por ejercicio (si no hay entrada, valen las del catálogo) */
  approvedAlts?: Record<string, string[]>;
  /** solo entrenador: avisos ya atendidos (clave del aviso → fecha) */
  dismissed?: Record<string, number>;
}

export interface PlanExercise {
  id: string;
  exerciseId: string | null;
  rawName?: string;
  sets: number;
  reps: number;
  weight: number | null;
  restSec?: number;
}

export interface RoutineDay {
  id: string;
  name: string;
  group: DayGroup;
  exercises: PlanExercise[];
}

export interface Routine {
  id: string;
  ownerId: string;
  ownerRole: Role;
  clientId: string | null;
  trainerId: string | null;
  name: string;
  days: RoutineDay[];
  template: boolean;
  week: number;
  createdAt: number;
  updatedAt: number;
  uses?: number;
  basedOn?: string | null;
  /** copia del plan antes de una semana de descarga, para volver a él */
  prevDays?: RoutineDay[] | null;
}

export interface SetLog {
  weight: number | null;
  reps: number;
  done: boolean;
  feel?: Feel | null;
  at?: number | null;
}

export interface EntryLog {
  id: string;
  planId: string | null;
  exerciseId: string | null;
  name: string;
  substituteOf?: string | null;
  target: { sets: number; reps: number; weight: number | null };
  sets: SetLog[];
  skipped?: boolean;
  note?: string;
}

export interface Workout {
  id: string;
  clientId: string;
  trainerId: string | null;
  routineId: string | null;
  dayId: string | null;
  dayName: string;
  group: DayGroup;
  startedAt: number;
  endedAt: number | null;
  status: 'active' | 'done' | 'incomplete';
  entries: EntryLog[];
  note?: string;
  busy?: { exerciseId: string; at: number }[];
  /** series previstas al empezar (para "12 / 20" aunque se guarde a medias) */
  planned?: number;
}

export interface Suggestion {
  id: string;
  routineId: string;
  dayId: string;
  planId: string;
  clientId: string;
  trainerId: string;
  fromExerciseId: string;
  toExerciseId: string;
  reason: string;
  status: 'pending' | 'accepted' | 'tryonce' | 'rejected';
  createdAt: number;
  answeredAt?: number | null;
}

export interface BodyValue {
  value: number;
  min?: number;
  max?: number;
}

export interface BodyReport {
  id: string;
  clientId: string;
  trainerId: string | null;
  date: number;
  dateStr: string;
  score: number | null;
  postureScore: number | null;
  height?: number | null;
  composition: Record<string, BodyValue>;
  posture: Record<string, { value: number; unit: string; note?: string }>;
  circumferences: Record<string, number>;
  segmental?: { fat: Record<string, number>; lean: Record<string, number> } | null;
  createdAt: number;
}

export interface Note {
  id: string;
  clientId: string;
  trainerId: string;
  clientName: string;
  kind: 'note' | 'alert';
  text: string;
  exerciseId?: string | null;
  workoutId?: string | null;
  createdAt: number;
  seen: boolean;
}

export interface Invite {
  id: string;
  trainerId: string;
  trainerName: string;
  clientName: string;
  days: number;
  createdAt: number;
  expiresAt: number;
  usedBy?: string | null;
}

export interface MachinePrefs {
  /** ajustes de máquina por ejercicio: asiento, tope, pies, carro (peso del carro o barra) */
  settings: Record<string, { asiento?: string; tope?: string; pies?: string; base?: number }>;
  notes: Record<string, string>;
}
