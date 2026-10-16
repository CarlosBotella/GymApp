import raw from './free-exercises.json';
import { ORIGINAL_LINKS, SPANISH_NAMES } from './exercise-names';
import type { Exercise, GroupId, Load } from '../lib/types';

interface SourceExercise {
  id: string;
  name: string;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
  level: 'beginner' | 'intermediate' | 'expert';
  category: string;
  force: string | null;
}

export const MUSCLE_NAMES: Record<string, string> = {
  abdominals: 'Abdominales', abductors: 'Abductores', adductors: 'Aductores',
  biceps: 'Bíceps', calves: 'Gemelos', chest: 'Pecho', forearms: 'Antebrazos',
  glutes: 'Glúteos', hamstrings: 'Isquiotibiales', lats: 'Dorsales',
  'lower back': 'Lumbar', 'middle back': 'Espalda media', neck: 'Cuello',
  quadriceps: 'Cuádriceps', shoulders: 'Hombros', traps: 'Trapecios', triceps: 'Tríceps',
};

export const EQUIPMENT_NAMES: Record<string, string> = {
  barbell: 'Barra', dumbbell: 'Mancuernas', cable: 'Poleas', machine: 'Máquina',
  'body only': 'Peso corporal', kettlebells: 'Kettlebell', bands: 'Bandas elásticas',
  'medicine ball': 'Balón medicinal', 'exercise ball': 'Fitball',
  'foam roll': 'Rodillo de espuma', 'e-z curl bar': 'Barra Z', other: 'Otro material',
  unspecified: 'Material sin especificar',
};

export const LEVEL_NAMES: Record<string, string> = {
  beginner: 'Principiante', intermediate: 'Intermedio', expert: 'Avanzado',
};

export const CATEGORY_NAMES: Record<string, string> = {
  strength: 'Fuerza', stretching: 'Movilidad y estiramientos', plyometrics: 'Pliometría',
  powerlifting: 'Powerlifting', 'olympic weightlifting': 'Halterofilia',
  strongman: 'Strongman', cardio: 'Cardio',
};

const GROUPS: Record<string, GroupId> = {
  abdominals: 'core', abductors: 'pierna', adductors: 'pierna', calves: 'pierna',
  glutes: 'pierna', hamstrings: 'pierna', quadriceps: 'pierna', chest: 'pecho',
  biceps: 'brazos', triceps: 'brazos', forearms: 'brazos', shoulders: 'hombro',
  traps: 'hombro', neck: 'espalda', lats: 'espalda', 'lower back': 'espalda', 'middle back': 'espalda',
};

const sourceRows = raw as SourceExercise[];
const bySource = new Map(sourceRows.map((row) => [row.id, row]));

function metadata(row: SourceExercise): Partial<Exercise> {
  return {
    sourceId: row.id,
    sourceUrl: `https://github.com/yuhonas/free-exercise-db/blob/main/exercises/${encodeURIComponent(row.id)}.json`,
    originalName: row.name,
    instructionsEn: [...row.instructions],
    images: row.images.map((image) => image.replace(/\.jpg$/i, '.webp')),
    primaryMuscles: row.primaryMuscles,
    secondaryMuscles: row.secondaryMuscles,
    level: row.level,
    category: row.category,
    equipmentKey: row.equipment || 'unspecified',
  };
}

export function buildFreeCatalog(originals: Exercise[]): Exercise[] {
  const used = new Set<string>();
  const existing = originals.map((exercise) => {
    const row = bySource.get(ORIGINAL_LINKS[exercise.id]);
    if (!row) return { ...exercise, category: 'strength', measure: exercise.id === 'plancha' ? 'seconds' as const : 'reps' as const };
    used.add(row.id);
    return {
      ...exercise, ...metadata(row),
      aliases: [...new Set([...exercise.aliases, row.name])],
      measure: exercise.id === 'plancha' ? 'seconds' as const : 'reps' as const,
    };
  });
  const added = sourceRows.filter((row) => !used.has(row.id)).map((row): Exercise => {
    const equipmentKey = row.equipment || 'unspecified';
    // New movements use total external kg. This avoids inventing a per-hand convention
    // or a load equivalence from source data that contains neither.
    const load: Load = row.equipment === 'body only' ? 'bodyweight' : 'other';
    const kind: Exercise['kind'] = row.equipment === 'cable' ? 'cable'
      : row.equipment === 'machine' ? 'machine'
      : ['barbell', 'e-z curl bar'].includes(equipmentKey) ? 'barbell'
      : row.equipment === 'dumbbell' ? 'dumbbell' : 'bodyweight';
    return {
      id: `free:${row.id}`, name: SPANISH_NAMES[row.id] || row.name,
      aliases: [...new Set([SPANISH_NAMES[row.id] || row.name, row.name])],
      group: GROUPS[row.primaryMuscles[0]] || 'core',
      muscles: row.primaryMuscles.map((m) => MUSCLE_NAMES[m] || m).join(', '),
      equipment: EQUIPMENT_NAMES[equipmentKey] || equipmentKey,
      load, ref: 0, alts: [], steps: [...row.instructions], kind,
      ...metadata(row), imported: true,
      measure: row.force === 'static' || row.category === 'cardio' ? 'seconds' : 'reps',
    };
  });
  return [...existing, ...added];
}

export function equipmentKey(exercise: Exercise): string {
  return exercise.equipmentKey || ({ dumbbell: 'dumbbell', barbell: 'barbell',
    bodyweight: 'body only', stack: 'machine', plates: 'machine', other: 'other' }[exercise.load]);
}

export interface CatalogFilters { equipment: string; level: string; category: string }
export const EMPTY_FILTERS: CatalogFilters = { equipment: '', level: '', category: '' };

export function matchesFilters(exercise: Exercise, filters: CatalogFilters): boolean {
  return (!filters.equipment || equipmentKey(exercise) === filters.equipment)
    && (!filters.level || exercise.level === filters.level)
    && (!filters.category || (exercise.category || 'strength') === filters.category);
}
