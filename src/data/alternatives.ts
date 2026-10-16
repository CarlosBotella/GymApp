import raw from './free-exercises.json';
import type { Exercise } from '../lib/types';

const source = new Map(raw.map((row) => [row.id, row]));
const normalized = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const LEGACY_MUSCLES: Record<string, string[]> = {
  'prensa-horizontal': ['quadriceps', 'glutes'], 'sentadilla-hack': ['quadriceps'],
  'sentadilla-bulgara': ['quadriceps', 'glutes'], 'jalon-maquina': ['lats'],
  'remo-maquina': ['middle back', 'lats'], pajaros: ['shoulders'],
  'deltoide-posterior-maquina': ['shoulders'], 'curl-predicador': ['biceps'],
  'triceps-cabeza': ['triceps'],
};

interface Profile {
  exercise: Exercise;
  name: string;
  primary: string[];
  secondary: string[];
  family: string;
  bucket: string;
  equipment: string;
  force: string | null;
  mechanic: string | null;
  level: number;
}

// Movement families are heuristics, not coaching validation. Unknown movements
// remain "related" and are never described as equivalent substitutions.
function family(name: string, primary: string[], category: string, equipment: string): string {
  const has = (pattern: RegExp) => pattern.test(name);
  if (category === 'stretching') return equipment === 'foam roll' || has(/\bsmr\b/) ? 'release' : 'stretch';
  if (category === 'cardio') {
    if (has(/bicycl|bike/)) return 'cycling';
    if (has(/run|jog|walk.*treadmill|trail/)) return 'running-walking';
    if (has(/stair|step mill/)) return 'stairs';
    if (has(/rowing/)) return 'rowing-cardio';
    return 'conditioning';
  }
  if (primary.includes('neck')) return has(/isometric/) ? 'neck-isometric' : 'neck-resistance';
  if (has(/\bclean\b|\bsnatch\b|\bjerk\b/) && !has(/deadlift|shrug|\bpull\b|squat/)) {
    if (has(/clean.*jerk|clean.*press/)) return 'clean-and-overhead';
    return has(/snatch/) ? 'snatch' : has(/jerk/) ? 'jerk' : 'clean';
  }
  if (primary.includes('forearms')) {
    if (has(/carry|farmers walk|rickshaw carry/)) return 'loaded-carry';
    if (has(/pronation|supination|rotation/)) return 'forearm-rotation';
    if (has(/palms down|reverse/)) return 'wrist-extension';
    if (has(/wrist.*curl|finger curls/)) return 'wrist-flexion';
    return 'grip';
  }
  if (primary.includes('abdominals')) {
    if (has(/pallof/) && !has(/rotation/)) return 'core-antirotation';
    if (has(/rollout|ab roller|fallout|rueda/)) return 'core-rollout';
    if (has(/plank|side bridge|plancha/)) return 'core-static';
    if (has(/side bend|heel touch/)) return 'core-side-flexion';
    if (has(/rotation|twist|wood chop|windmill|landmine|judo|cable lift/)) return 'core-rotation';
    if (has(/leg raise|reverse crunch|hip raise|hip lift|knee hip|pike|leg pull|leg tucks|leg raise|elevacion de piernas/)) return 'core-hip-flexion';
    if (has(/crunch|sit up|jackknife|cocoon|elbow to knee/)) return 'core-flexion';
  }
  if (has(/calf|gemelo/)) return 'calf-raise';
  if (has(/abductor|abduccion|hip abduction/)) return 'hip-abduction';
  if (has(/adductor|aduccion|hip adduction/)) return 'hip-adduction';
  if (has(/leg curl|femoral|glute ham raise/)) return 'knee-flexion';
  if (has(/leg extension|extension de cuadriceps/)) return 'knee-extension';
  if (has(/hip thrust|glute bridge|butt lift|hip bridge|hip lift/)) return 'hip-bridge';
  if (has(/kickback|hip extension|leg lift/) && primary.includes('glutes')) return 'hip-extension';
  if (has(/deadlift|peso muerto|good morning|stiff leg|pull through/)) return 'hip-hinge';
  if (has(/hyperextension|hiperextensiones|back extension/)) return 'back-extension';
  if (has(/squat|sentadilla|leg press|prensa|lunge|zancada|step up/)) return 'knee-dominant';
  if (has(/carry|farmers walk|yoke walk|conans wheel/)) return 'loaded-carry';
  if (has(/atlas|stone|keg load|sandbag load|tire flip|power stairs/)) return 'strongman-loading';
  if (has(/sled|drag|prowler/)) return 'sled';
  if (has(/pullover|straight arm.*pulldown/)) return 'shoulder-extension';
  if (has(/face pull|rear delt.*row/)) return 'rear-shoulder-pull';
  if (primary.includes('biceps') && has(/curl/)) return 'elbow-flexion';
  if (primary.includes('triceps')) {
    if (has(/dip|fondos|bench press|close grip.*press/)) return 'triceps-compound';
    if (has(/extension|pushdown|press|kickback|skull/)) return 'elbow-extension';
  }
  if (has(/shrug|encogimiento/)) return 'shrug';
  if (has(/upright.*row|row.*upright|remo al menton/)) return 'upright-row';
  if (has(/row|remo/)) return 'horizontal-pull';
  if (has(/pull up|pullup|chin up|chinup|pulldown|jalon|dominada/)) return 'vertical-pull';
  if (primary.includes('shoulders')) {
    if (has(/rear|reverse|pajaro|posterior/)) return 'rear-shoulder-raise';
    if (has(/front.*raise|raise.*front/)) return 'front-raise';
    if (has(/lateral|side.*raise/)) return 'lateral-raise';
    if (has(/press|military/)) return 'overhead-press';
  }
  if (primary.includes('chest')) {
    if (has(/fly|flye|butterfly|crossover|apertura|contractor|cruce/)) return 'chest-fly';
    if (has(/press|push up|pushup|dip|fondos|flexion/)) return 'horizontal-press';
  }
  return 'unclassified';
}

function profile(exercise: Exercise): Profile {
  const row = exercise.sourceId ? source.get(exercise.sourceId) : undefined;
  const name = normalized(`${exercise.originalName || exercise.name} ${exercise.id}`);
  const primary = exercise.primaryMuscles?.length ? exercise.primaryMuscles : LEGACY_MUSCLES[exercise.id] || [];
  const category = exercise.category || 'strength';
  const equipment = exercise.equipmentKey || exercise.load;
  return {
    exercise, name, primary, secondary: exercise.secondaryMuscles || [],
    family: family(name, primary, category, equipment),
    bucket: ['strength', 'powerlifting'].includes(category) ? 'strength' : category,
    equipment, force: row?.force || null, mechanic: row?.mechanic || null,
    level: exercise.level === 'expert' ? 2 : exercise.level === 'intermediate' ? 1 : 0,
  };
}

export function attachAlternatives(exercises: Exercise[]): Exercise[] {
  const profiles = exercises.map(profile);
  return profiles.map((from) => {
    const candidates = profiles.filter((to) => to.exercise.id !== from.exercise.id
      && to.bucket === from.bucket && to.exercise.measure === from.exercise.measure);
    const ranked = candidates.map((to) => {
      const shared = from.primary.filter((muscle) => to.primary.includes(muscle)).length;
      const sameFamily = from.family !== 'unclassified' && from.family === to.family;
      const sameForce = !from.force || !to.force || from.force === to.force;
      const close = sameFamily && (sameForce || ['chest-fly', 'hip-abduction', 'hip-adduction'].includes(from.family)) && (shared > 0 || from.bucket === 'cardio');
      const related = shared > 0 || (to.exercise.group === from.exercise.group && from.bucket === 'cardio');
      const score = (close ? 100 : 0) + shared * 20
        + (from.primary[0] === to.primary[0] ? 10 : 0)
        + (from.equipment === to.equipment ? 8 : 0)
        + (!to.exercise.imported ? 12 : 0)
        + (from.exercise.alts.includes(to.exercise.id) && close ? 12 : 0)
        + (from.mechanic === to.mechanic ? 4 : 0)
        + from.secondary.filter((m) => to.secondary.includes(m)).length * 2
        - Math.max(0, to.level - from.level) * 8;
      return { to, close, related, score };
    }).filter((candidate) => candidate.close || candidate.related)
      .sort((a, b) => b.score - a.score || a.to.exercise.id.localeCompare(b.to.exercise.id));
    // Sparse categories can offer a related option, clearly labeled, without
    // calling it a same-movement substitute. The workout editor resets the target
    // if a related suggestion uses a different measurement unit.
    if (!ranked.length) {
      for (const to of candidates.filter((p) => p.exercise.group === from.exercise.group)) {
        ranked.push({ to, close: false, related: true, score: 0 });
      }
    }
    if (!ranked.length) {
      const broader = profiles.filter((to) => to.exercise.id !== from.exercise.id
        && from.primary.some((muscle) => to.primary.includes(muscle)));
      broader.sort((a, b) => Number(b.exercise.measure === from.exercise.measure) - Number(a.exercise.measure === from.exercise.measure)
        || a.level - b.level || a.exercise.id.localeCompare(b.exercise.id));
      for (const to of broader) ranked.push({ to, close: false, related: true, score: 0 });
    }
    const selected: typeof ranked = [];
    const take = (list: typeof ranked) => {
      for (const item of list) {
        if (selected.length >= 8) break;
        if (selected.includes(item)) continue;
        const materialCount = selected.filter((p) => p.to.equipment === item.to.equipment).length;
        if (materialCount < 2) selected.push(item);
      }
      for (const item of list) {
        if (selected.length >= 8) break;
        if (!selected.includes(item)) selected.push(item);
      }
    };
    take(ranked.filter((item) => item.close));
    if (selected.length < 4) take(ranked.filter((item) => !item.close));
    return {
      ...from.exercise,
      alts: selected.map((item) => item.to.exercise.id),
      alternativeNotes: Object.fromEntries(selected.map((item) => [item.to.exercise.id,
        item.close ? 'Movimiento similar; ajustar la carga' : 'Ejercicio relacionado: revisar su encaje en la rutina'])),
    };
  });
}
