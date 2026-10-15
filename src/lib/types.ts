export type Role = 'trainer' | 'client';
export type CenterId = 'ruzafa' | 'lesarts';

export type MuscleId =
  | 'cuadriceps' | 'femoral' | 'gluteo' | 'aductor' | 'abductor' | 'gemelo'
  | 'pecho'
  | 'dorsal' | 'espalda_media' | 'lumbar'
  | 'hombro_anterior' | 'hombro_lateral' | 'hombro_posterior' | 'trapecio'
  | 'biceps' | 'triceps' | 'antebrazo'
  | 'abdomen'
  | 'cardio';

export type GroupId = 'pierna' | 'pecho' | 'espalda' | 'hombro' | 'brazos' | 'core' | 'cardio';

export type EquipmentKind =
  | 'plate_loaded'   // palanca con discos (Hammer Strength)
  | 'selectorized'   // máquina de placas con pin
  | 'cable'          // poleas
  | 'smith'
  | 'free_weight'    // mancuernas, barra
  | 'bench'
  | 'bodyweight'
  | 'cardio';

/** Cómo se registra cada serie. */
export type LogType = 'weight_reps' | 'reps' | 'time' | 'cardio';

export interface Equipment {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  kind: EquipmentKind;
  centers: CenterId[];
  /** Peso propio de la palanca / trineo (kg), para la calculadora de discos. */
  baseWeight?: number;
}

export interface Exercise {
  id: string;
  name: string;
  primary: MuscleId;
  secondary: MuscleId[];
  equipmentId: string;
  logType: LogType;
  unilateral?: boolean;
  /** Ejercicio creado por un usuario (no viene del catálogo). */
  custom?: boolean;
}

export interface Profile {
  id: string;
  name: string;
  role: Role;
  trainerId: string | null;
  center: CenterId;
  /** Código que el entrenador comparte para que sus clientes se vinculen. */
  code: string | null;
  /** Ajustes de máquina por ejercicio: "asiento 4, respaldo 2". */
  exerciseNotes: Record<string, string>;
  email?: string;
}

/** Objetivo de una serie: "12", "8-10", "30s", "AMRAP". */
export interface SetTarget {
  reps: string;
}

export interface RoutineExercise {
  uid: string;
  exerciseId: string;
  sets: SetTarget[];
  restSec: number;
  note?: string;
  /** Se hace en superserie con el siguiente ejercicio. */
  supersetNext?: boolean;
}

export interface RoutineDay {
  id: string;
  name: string;
  description?: string;
  groups: GroupId[];
  exercises: RoutineExercise[];
}

export interface Routine {
  id: string;
  clientId: string;
  authorId: string;
  authorRole: Role;
  name: string;
  description?: string;
  days: RoutineDay[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoggedSet {
  weight: number | null;
  reps: number | null;
  seconds: number | null;
  km: number | null;
  done: boolean;
}

export interface WorkoutEntry {
  uid: string;
  exerciseId: string;
  /** Si se sustituyó, el ejercicio que había en la rutina. */
  replacedId?: string;
  target: SetTarget[];
  restSec: number;
  sets: LoggedSet[];
  note?: string;
}

export interface Workout {
  id: string;
  clientId: string;
  routineId: string | null;
  dayId: string | null;
  dayName: string;
  startedAt: string;
  finishedAt: string | null;
  entries: WorkoutEntry[];
  /** Sensaciones 1-5. */
  feeling: number | null;
  notes: string;
  trainerComment: string | null;
}
