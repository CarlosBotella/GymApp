import type { CenterId, Equipment, Exercise, GroupId, MuscleId } from '../lib/types';

export const CENTERS: { id: CenterId; name: string }[] = [
  { id: 'ruzafa', name: 'On Air Ruzafa' },
  { id: 'lesarts', name: 'On Air Les Arts' },
];

export const GROUPS: { id: GroupId; name: string; muscles: MuscleId[] }[] = [
  { id: 'pierna', name: 'Pierna', muscles: ['cuadriceps', 'femoral', 'gluteo', 'aductor', 'abductor', 'gemelo'] },
  { id: 'pecho', name: 'Pecho', muscles: ['pecho'] },
  { id: 'espalda', name: 'Espalda', muscles: ['dorsal', 'espalda_media', 'lumbar', 'trapecio'] },
  { id: 'hombro', name: 'Hombro', muscles: ['hombro_anterior', 'hombro_lateral', 'hombro_posterior'] },
  { id: 'brazos', name: 'Brazos', muscles: ['biceps', 'triceps', 'antebrazo'] },
  { id: 'core', name: 'Core', muscles: ['abdomen'] },
  { id: 'cardio', name: 'Cardio', muscles: ['cardio'] },
];

export const MUSCLES: Record<MuscleId, string> = {
  cuadriceps: 'Cuádriceps',
  femoral: 'Femoral',
  gluteo: 'Glúteo',
  aductor: 'Aductor',
  abductor: 'Abductor',
  gemelo: 'Gemelo',
  pecho: 'Pecho',
  dorsal: 'Dorsal',
  espalda_media: 'Espalda media',
  lumbar: 'Lumbar',
  trapecio: 'Trapecio',
  hombro_anterior: 'Hombro anterior',
  hombro_lateral: 'Hombro lateral',
  hombro_posterior: 'Hombro posterior',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  antebrazo: 'Antebrazo',
  abdomen: 'Abdomen',
  cardio: 'Cardio',
};

export function groupOfMuscle(m: MuscleId): GroupId {
  return GROUPS.find((g) => g.muscles.includes(m))!.id;
}

const BOTH: CenterId[] = ['ruzafa', 'lesarts'];

export const EQUIPMENT: Equipment[] = [
  // Hammer Strength plate-loaded (rojas)
  { id: 'hs-hack', name: 'Hack squat', brand: 'Hammer Strength', model: 'Plate-Loaded Linear Hack Press', kind: 'plate_loaded', centers: BOTH, baseWeight: 0 },
  { id: 'hs-legpress', name: 'Prensa de pierna', brand: 'Hammer Strength', model: 'Plate-Loaded Leg Press', kind: 'plate_loaded', centers: BOTH, baseWeight: 0 },
  { id: 'hs-beltsquat', name: 'Belt squat', brand: 'Hammer Strength', model: 'Plate-Loaded Belt Squat', kind: 'plate_loaded', centers: ['lesarts'], baseWeight: 0 },
  { id: 'hs-legext', name: 'Extensión de pierna isolateral', brand: 'Hammer Strength', model: 'Plate-Loaded Iso-Lateral Leg Extension', kind: 'plate_loaded', centers: ['lesarts'], baseWeight: 0 },
  { id: 'hs-kneelcurl', name: 'Curl femoral unilateral', brand: 'Hammer Strength', model: 'Iso-Lateral Kneeling Leg Curl', kind: 'plate_loaded', centers: BOTH, baseWeight: 0 },
  { id: 'hs-glutedrive', name: 'Glute drive (hip thrust)', brand: 'Hammer Strength', model: 'Plate-Loaded Glute Drive', kind: 'plate_loaded', centers: BOTH, baseWeight: 0 },
  { id: 'hs-seatedcalf', name: 'Gemelo sentado', brand: 'Hammer Strength', model: 'Plate-Loaded Seated Calf Raise', kind: 'plate_loaded', centers: BOTH, baseWeight: 0 },
  { id: 'hs-chest', name: 'Press de pecho convergente', brand: 'Hammer Strength', model: 'Iso-Lateral Horizontal Bench Press', kind: 'plate_loaded', centers: BOTH, baseWeight: 0 },
  { id: 'hs-decline', name: 'Press declinado convergente', brand: 'Hammer Strength', model: 'Iso-Lateral Decline Press', kind: 'plate_loaded', centers: BOTH, baseWeight: 0 },
  { id: 'hs-shoulder', name: 'Press de hombro convergente', brand: 'Hammer Strength', model: 'Iso-Lateral Shoulder Press', kind: 'plate_loaded', centers: BOTH, baseWeight: 0 },
  { id: 'hs-pulldown', name: 'Jalón isolateral', brand: 'Hammer Strength', model: 'Iso-Lateral Front Lat Pulldown', kind: 'plate_loaded', centers: BOTH, baseWeight: 0 },
  { id: 'hs-row', name: 'Remo de palanca', brand: 'Hammer Strength', model: 'Iso-Lateral Row', kind: 'plate_loaded', centers: BOTH, baseWeight: 0 },
  { id: 'hs-biceps', name: 'Curl de bíceps de discos', brand: 'Hammer Strength', model: 'Plate-Loaded Biceps Curl', kind: 'plate_loaded', centers: BOTH, baseWeight: 0 },

  // Máquinas de placas
  { id: 'g80-legcurl', name: 'Femoral tumbado', brand: 'gym80', model: 'Sygnum Lying Leg Curl', kind: 'selectorized', centers: ['ruzafa'] },
  { id: 'legcurl-plate', name: 'Femoral tumbado de discos', kind: 'plate_loaded', centers: ['lesarts'], baseWeight: 0 },
  { id: 'legext', name: 'Extensión de pierna', brand: 'gym80', kind: 'selectorized', centers: BOTH },
  { id: 'abductor', name: 'Abductores / aductores', kind: 'selectorized', centers: BOTH },
  { id: 'standcalf', name: 'Gemelo de pie', kind: 'selectorized', centers: BOTH },
  { id: 'pecdeck', name: 'Contractora (aperturas / posterior)', brand: 'gym80', kind: 'selectorized', centers: BOTH },

  // Multiusos
  { id: 'cables', name: 'Poleas', brand: 'gym80', model: 'Torre de poleas dual', kind: 'cable', centers: BOTH },
  { id: 'lat-cable', name: 'Polea alta / jalón', kind: 'cable', centers: BOTH },
  { id: 'smith', name: 'Máquina Smith', kind: 'smith', centers: BOTH, baseWeight: 0 },
  { id: 'dumbbells', name: 'Mancuernas', kind: 'free_weight', centers: BOTH },
  { id: 'barbell', name: 'Barra olímpica', brand: 'Eleiko', kind: 'free_weight', centers: BOTH, baseWeight: 20 },
  { id: 'bench', name: 'Banco ajustable', kind: 'bench', centers: BOTH },
  { id: 'bodyweight', name: 'Peso corporal', kind: 'bodyweight', centers: BOTH },

  // Cardio Technogym
  { id: 'tg-run', name: 'Cinta de correr', brand: 'Technogym', model: 'Run', kind: 'cardio', centers: BOTH },
  { id: 'tg-recline', name: 'Bici reclinada', brand: 'Technogym', model: 'Recline', kind: 'cardio', centers: BOTH },
  { id: 'tg-bike', name: 'Bici estática', brand: 'Technogym', model: 'Bike', kind: 'cardio', centers: BOTH },
  { id: 'tg-climb', name: 'Escaladora', brand: 'Technogym', model: 'Climb', kind: 'cardio', centers: BOTH },
];

type Ex = [id: string, name: string, primary: MuscleId, secondary: MuscleId[], equipmentId: string, extra?: Partial<Exercise>];

const EX: Ex[] = [
  // Pierna
  ['hack-squat', 'Hack squat', 'cuadriceps', ['gluteo'], 'hs-hack'],
  ['leg-press', 'Prensa de pierna (cuádriceps)', 'cuadriceps', ['gluteo'], 'hs-legpress'],
  ['leg-press-glute', 'Prensa de pierna (pies altos)', 'gluteo', ['femoral', 'cuadriceps'], 'hs-legpress'],
  ['belt-squat', 'Belt squat', 'cuadriceps', ['gluteo'], 'hs-beltsquat'],
  ['leg-ext', 'Extensión de pierna', 'cuadriceps', [], 'legext'],
  ['leg-ext-iso', 'Extensión de pierna isolateral', 'cuadriceps', [], 'hs-legext', { unilateral: true }],
  ['bulgarian-smith', 'Sentadilla búlgara en Smith', 'cuadriceps', ['gluteo'], 'smith', { unilateral: true }],
  ['squat-smith', 'Sentadilla en Smith', 'cuadriceps', ['gluteo'], 'smith'],
  ['back-squat', 'Sentadilla con barra', 'cuadriceps', ['gluteo', 'lumbar'], 'barbell'],
  ['lunge-db', 'Zancadas con mancuernas', 'cuadriceps', ['gluteo'], 'dumbbells', { unilateral: true }],
  ['lying-curl', 'Curl femoral tumbado', 'femoral', [], 'g80-legcurl'],
  ['lying-curl-plate', 'Curl femoral tumbado (discos)', 'femoral', [], 'legcurl-plate'],
  ['kneel-curl', 'Curl femoral unilateral', 'femoral', [], 'hs-kneelcurl', { unilateral: true }],
  ['rdl-db', 'Peso muerto rumano con mancuerna', 'femoral', ['gluteo', 'lumbar'], 'dumbbells'],
  ['rdl-bb', 'Peso muerto rumano con barra', 'femoral', ['gluteo', 'lumbar'], 'barbell'],
  ['hip-thrust', 'Hip thrust en máquina', 'gluteo', ['femoral'], 'hs-glutedrive'],
  ['hip-thrust-smith', 'Hip thrust en Smith', 'gluteo', ['femoral'], 'smith'],
  ['cable-kickback', 'Patada de glúteo en polea', 'gluteo', [], 'cables', { unilateral: true }],
  ['abductor', 'Abductores en máquina', 'abductor', ['gluteo'], 'abductor'],
  ['adductor', 'Aductores en máquina', 'aductor', [], 'abductor'],
  ['standing-calf', 'Elevación de talones en máquina', 'gemelo', [], 'standcalf'],
  ['seated-calf', 'Gemelo sentado', 'gemelo', [], 'hs-seatedcalf'],
  ['calf-press', 'Gemelo en prensa', 'gemelo', [], 'hs-legpress'],

  // Pecho
  ['incline-smith', 'Press de banca inclinado en Smith', 'pecho', ['hombro_anterior', 'triceps'], 'smith'],
  ['flat-smith', 'Press de banca en Smith', 'pecho', ['hombro_anterior', 'triceps'], 'smith'],
  ['chest-press-hs', 'Press de pecho en máquina convergente', 'pecho', ['hombro_anterior', 'triceps'], 'hs-chest'],
  ['decline-press-hs', 'Press de pecho declinado convergente', 'pecho', ['triceps'], 'hs-decline'],
  ['bench-press', 'Press de banca con barra', 'pecho', ['hombro_anterior', 'triceps'], 'barbell'],
  ['incline-db', 'Press inclinado con mancuernas', 'pecho', ['hombro_anterior', 'triceps'], 'dumbbells'],
  ['pec-deck', 'Aperturas en máquina', 'pecho', [], 'pecdeck'],
  ['cable-fly', 'Cruce de poleas', 'pecho', [], 'cables'],
  ['dips', 'Fondos', 'pecho', ['triceps'], 'bodyweight', { logType: 'reps' }],

  // Espalda
  ['pulldown-neutral-hs', 'Jalón al pecho agarre neutro isolateral', 'dorsal', ['biceps'], 'hs-pulldown'],
  ['pulldown-narrow', 'Jalón al pecho agarre estrecho prono', 'dorsal', ['biceps'], 'lat-cable'],
  ['pulldown-wide', 'Jalón al pecho agarre abierto', 'dorsal', ['biceps'], 'lat-cable'],
  ['row-hs-narrow', 'Remo agarre estrecho en máquina de palanca', 'espalda_media', ['dorsal', 'biceps'], 'hs-row'],
  ['seated-cable-row', 'Remo en polea baja', 'espalda_media', ['dorsal', 'biceps'], 'cables'],
  ['db-row', 'Remo con mancuerna', 'dorsal', ['espalda_media', 'biceps'], 'dumbbells', { unilateral: true }],
  ['pullover-cable', 'Pull over con barra en polea', 'dorsal', [], 'cables'],
  ['pullups', 'Dominadas', 'dorsal', ['biceps'], 'bodyweight', { logType: 'reps' }],
  ['shrug-db', 'Encogimientos con mancuerna', 'trapecio', [], 'dumbbells'],
  ['back-ext', 'Hiperextensiones', 'lumbar', ['gluteo', 'femoral'], 'bench', { logType: 'reps' }],

  // Hombro
  ['shoulder-press-hs', 'Press de hombro en máquina convergente', 'hombro_anterior', ['hombro_lateral', 'triceps'], 'hs-shoulder'],
  ['shoulder-press-db', 'Press militar con mancuernas', 'hombro_anterior', ['hombro_lateral', 'triceps'], 'dumbbells'],
  ['lateral-cable', 'Elevación lateral de hombro en polea', 'hombro_lateral', [], 'cables', { unilateral: true }],
  ['lateral-db', 'Elevaciones laterales con mancuerna', 'hombro_lateral', [], 'dumbbells'],
  ['rear-delt-machine', 'Hombro posterior en máquina (agarre prono)', 'hombro_posterior', ['espalda_media'], 'pecdeck'],
  ['face-pull', 'Face pull en polea', 'hombro_posterior', ['trapecio'], 'cables'],

  // Brazos
  ['biceps-hs', 'Curl de bíceps en máquina de discos', 'biceps', [], 'hs-biceps'],
  ['hammer-incline', 'Curl martillo en banco inclinado', 'biceps', ['antebrazo'], 'dumbbells'],
  ['curl-db', 'Curl de bíceps con mancuernas', 'biceps', [], 'dumbbells'],
  ['curl-cable', 'Curl de bíceps en polea', 'biceps', [], 'cables'],
  ['katana', 'Tríceps katana unilateral', 'triceps', [], 'cables', { unilateral: true }],
  ['pushdown-bar', 'Tríceps con barra en polea', 'triceps', [], 'cables'],
  ['pushdown-rope', 'Tríceps con cuerda en polea', 'triceps', [], 'cables'],
  ['jm-press-smith', 'JM press en Smith', 'triceps', ['pecho'], 'smith'],

  // Core
  ['cable-crunch', 'Crunch en polea', 'abdomen', [], 'cables'],
  ['plank', 'Plancha', 'abdomen', [], 'bodyweight', { logType: 'time' }],
  ['hanging-raise', 'Elevación de piernas colgado', 'abdomen', [], 'bodyweight', { logType: 'reps' }],

  // Cardio
  ['run', 'Cinta de correr', 'cardio', [], 'tg-run', { logType: 'cardio' }],
  ['recline', 'Bici reclinada', 'cardio', [], 'tg-recline', { logType: 'cardio' }],
  ['bike', 'Bici estática', 'cardio', [], 'tg-bike', { logType: 'cardio' }],
  ['climb', 'Escaladora', 'cardio', [], 'tg-climb', { logType: 'cardio' }],
];

export const EXERCISES: Exercise[] = EX.map(([id, name, primary, secondary, equipmentId, extra]) => ({
  id, name, primary, secondary, equipmentId, logType: 'weight_reps', ...extra,
}));

const exById = new Map(EXERCISES.map((e) => [e.id, e]));
const eqById = new Map(EQUIPMENT.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise {
  return exById.get(id) ?? { id, name: id, primary: 'abdomen', secondary: [], equipmentId: 'bodyweight', logType: 'weight_reps', custom: true };
}

export function getEquipment(id: string): Equipment | undefined {
  return eqById.get(id);
}

export function exerciseGroup(id: string): GroupId {
  return groupOfMuscle(getExercise(id).primary);
}

/** Ejercicios de un grupo (o de un músculo concreto) disponibles en un centro. */
export function filterExercises(opts: { groups?: GroupId[]; muscle?: MuscleId | null; center?: CenterId | null; query?: string }): Exercise[] {
  const q = opts.query?.trim().toLowerCase();
  const list = EXERCISES.filter((e) => {
    if (opts.groups?.length && !opts.groups.includes(groupOfMuscle(e.primary))) return false;
    if (opts.muscle && e.primary !== opts.muscle && !e.secondary.includes(opts.muscle)) return false;
    if (opts.center) {
      const eq = eqById.get(e.equipmentId);
      if (eq && !eq.centers.includes(opts.center)) return false;
    }
    if (q && !e.name.toLowerCase().includes(q) && !(eqById.get(e.equipmentId)?.name.toLowerCase().includes(q))) return false;
    return true;
  });
  // Con un músculo elegido, primero los que lo trabajan como principal.
  if (opts.muscle) list.sort((a, b) => Number(b.primary === opts.muscle) - Number(a.primary === opts.muscle));
  return list;
}

/** Alternativas para cuando la máquina está ocupada: mismo músculo principal. */
export function alternatives(exerciseId: string, center?: CenterId | null): Exercise[] {
  const ex = getExercise(exerciseId);
  return filterExercises({ muscle: ex.primary, center }).filter((e) => e.id !== exerciseId && e.primary === ex.primary);
}

export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
