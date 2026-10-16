import { EXERCISES, ex, inferDayGroup } from '../data/catalog';
import type { Exercise, PlanExercise, RoutineDay } from './types';
import { norm, uid } from './util';

// «Escritura rápida»: convierte texto como el de unas notas en una rutina.
//   Pierna:
//   prensa 4x10 120
//   bulgara 3x10 2x16
//   curl fem 3x12 40
//   gemelos 4x15            ← sin peso: se usa el de la última vez
//   remo igual              ← mismo esquema que el anterior

export interface Match {
  exercise: Exercise;
  score: number;
}

export interface ParsedLine {
  raw: string;
  kind: 'day' | 'exercise' | 'unknown' | 'blank';
  dayName?: string;
  name?: string;
  matches?: Match[];
  ambiguous?: boolean;
  sets?: number;
  reps?: number;
  weight?: number | null;
}

const DAY_RE = /^(#+\s*|d[ií]a\b|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|pierna\s*:|torso\s*:|empuje\s*:|tir[oó]n\s*:)/i;

function scoreAlias(q: string, alias: string): number {
  const a = norm(alias);
  if (!q || !a) return 0;
  if (q === a) return 1;
  if (a.startsWith(q) || q.startsWith(a)) return 0.85 + 0.1 * (Math.min(q.length, a.length) / Math.max(q.length, a.length));
  const qt = q.split(' ');
  const at = a.split(' ');
  let hit = 0;
  for (const t of qt) if (at.some((x) => x.startsWith(t) || (t.length > 3 && x.startsWith(t.slice(0, 4))))) hit++;
  return (hit / Math.max(qt.length, at.length)) * 0.8;
}

export function findExercise(name: string, extraAliases: Record<string, string> = {}): Match[] {
  const q = norm(name);
  if (!q) return [];
  if (extraAliases[q]) {
    const x = ex(extraAliases[q]);
    if (x) return [{ exercise: x, score: 1 }];
  }
  const out: Match[] = [];
  for (const x of EXERCISES) {
    const s = Math.max(scoreAlias(q, x.name), ...x.aliases.map((a) => scoreAlias(q, a)));
    if (s >= 0.45) out.push({ exercise: x, score: s });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 4);
}

export function parseLine(raw: string, extraAliases: Record<string, string> = {}): ParsedLine {
  const line = raw.trim();
  if (!line) return { raw, kind: 'blank' };
  if (DAY_RE.test(line) || /:\s*$/.test(line)) {
    return { raw, kind: 'day', dayName: line.replace(/^#+\s*/, '').replace(/:\s*$/, '').trim() };
  }
  const scheme = /(?:^|\s)(\d+)\s*[x×*]\s*(\d+)/.exec(line);
  const exactName = EXERCISES.some((x) => [x.name, ...x.aliases].some((a) => norm(a) === norm(line.replace(/\bigual\b/i, '').trim())));
  const firstNum = scheme ? scheme.index : exactName ? -1 : line.search(/\d/);
  const namePart = (firstNum === -1 ? line : line.slice(0, firstNum)).replace(/\bigual\b/i, '').trim();
  const rest = firstNum === -1 ? '' : line.slice(firstNum);
  let sets: number | undefined;
  let reps: number | undefined;
  let weight: number | null | undefined;
  const sr = rest.match(/(\d+)\s*[x×*]\s*(\d+)/);
  let after = rest;
  if (sr) {
    sets = +sr[1];
    reps = +sr[2];
    after = rest.slice((sr.index || 0) + sr[0].length);
  }
  // peso: «120», «57,5», «2x16» (mancuerna por mano), «16kg»
  const pair = after.match(/(\d+)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/);
  const single = after.match(/(\d+(?:[.,]\d+)?)\s*(kg)?/i);
  if (pair) weight = parseFloat(pair[2].replace(',', '.'));
  else if (single) weight = parseFloat(single[1].replace(',', '.'));
  const same = /\bigual\b/i.test(line);
  const matches = findExercise(namePart, extraAliases);
  const ambiguous = matches.length > 1 && matches[0].score < 1 && matches[0].score - matches[1].score < 0.08;
  return {
    raw,
    kind: matches.length ? 'exercise' : 'unknown',
    name: namePart,
    matches,
    ambiguous,
    sets,
    reps,
    weight: weight === undefined ? (same ? undefined : null) : weight,
    ...(same ? { same: true } : {}),
  } as ParsedLine;
}

export interface Draft {
  days: RoutineDay[];
  lines: (ParsedLine & { dayIndex: number; planId?: string })[];
}

/** choices: elección del usuario cuando hay ambigüedad (índice de línea → exerciseId) */
export function buildDraft(
  text: string,
  choices: Record<number, string>,
  lastWeight: (exerciseId: string) => number | null,
  extraAliases: Record<string, string> = {},
  prevDays: RoutineDay[] = [],
): Draft {
  const lines = text.split('\n').map((l) => parseLine(l, extraAliases));
  const days: RoutineDay[] = [];
  const outLines: Draft['lines'] = [];
  let cur: RoutineDay | null = null;
  let prev: PlanExercise | null = null;
  const reuse = (i: number) => prevDays.flatMap((d) => d.exercises)[i];
  let exIndex = 0;
  lines.forEach((l, i) => {
    if (l.kind === 'blank') {
      outLines.push({ ...l, dayIndex: days.length - 1 });
      return;
    }
    if (l.kind === 'day') {
      cur = { id: prevDays[days.length]?.id || uid(8), name: l.dayName || `Día ${days.length + 1}`, group: 'fullbody', exercises: [] };
      days.push(cur);
      outLines.push({ ...l, dayIndex: days.length - 1 });
      return;
    }
    if (!cur) {
      cur = { id: prevDays[0]?.id || uid(8), name: 'Día A', group: 'fullbody', exercises: [] };
      days.push(cur);
    }
    const chosen = choices[i];
    const exerciseId = chosen || (l.matches && l.matches[0] ? l.matches[0].exercise.id : null);
    const same = (l as ParsedLine & { same?: boolean }).same && prev;
    const sets = l.sets ?? (same ? prev!.sets : 3);
    const reps = l.reps ?? (same ? prev!.reps : ex(exerciseId)?.measure === 'seconds' ? 30 : 10);
    let weight: number | null = l.weight === undefined ? (same ? prev!.weight : null) : l.weight;
    if (weight === null && exerciseId) weight = lastWeight(exerciseId);
    const keepId = reuse(exIndex)?.id;
    const plan: PlanExercise = { id: keepId || uid(8), exerciseId, rawName: exerciseId ? undefined : l.name, sets, reps, weight };
    exIndex++;
    cur.exercises.push(plan);
    prev = plan;
    outLines.push({ ...l, dayIndex: days.length - 1, planId: plan.id });
  });
  for (const d of days) d.group = inferDayGroup(d.exercises.map((x) => x.exerciseId));
  return { days: days.filter((d) => d.exercises.length), lines: outLines };
}

/** Texto de notas a partir de una rutina (para editarla) */
export function toNotes(days: RoutineDay[]): string {
  const out: string[] = [];
  for (const d of days) {
    if (days.length > 1 || d.name) out.push(d.name + ':');
    for (const p of d.exercises) {
      const x = ex(p.exerciseId);
      const name = x ? x.aliases[0] || x.name : p.rawName || '?';
      const w = p.weight === null ? '' : x?.load === 'dumbbell' ? ` 2x${String(p.weight).replace('.', ',')}` : ` ${String(p.weight).replace('.', ',')}`;
      out.push(`${name} ${p.sets}x${p.reps}${w}`);
    }
  }
  return out.join('\n');
}
