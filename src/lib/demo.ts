import type { BodyReport, EntryLog, Feel, Note, Profile, Routine, RoutineDay, Suggestion, Workout } from './types';
import { DAY, WEEK, startOfWeek, uid } from './util';
import { localLogin, resetLocal } from './db-local';
import { ex } from '../data/catalog';

// Modo demo: un entrenador y dos clientes con 10 semanas de historial inventado.
const T = 'demo-trainer';
const C = 'demo-carlos';
const L = 'demo-lucia';

function day(name: string, group: RoutineDay['group'], list: [string, number, number, number | null][]): RoutineDay {
  return { id: uid(8), name, group, exercises: list.map(([exerciseId, sets, reps, weight]) => ({ id: uid(8), exerciseId, sets, reps, weight })) };
}

export function seedDemo(as: 'client' | 'trainer') {
  const now = Date.now();
  const users: Record<string, Profile> = {
    [T]: { id: T, name: 'Álex', email: 'entrenador@demo', role: 'trainer', createdAt: now - 20 * WEEK, approvedAlts: {} },
    [C]: { id: C, name: 'Carlos', email: 'carlos@demo', role: 'client', trainerId: T, trainerName: 'Álex', linkedAt: now - 10 * WEEK, shareBody: true, days: 3, createdAt: now - 10 * WEEK },
    [L]: { id: L, name: 'Lucía', email: 'lucia@demo', role: 'client', trainerId: T, trainerName: 'Álex', linkedAt: now - 3 * DAY, shareBody: true, days: 4, createdAt: now - 3 * DAY },
  };

  const legA = day('Pierna · Día A', 'pierna', [['prensa', 4, 10, 120], ['sentadilla-bulgara', 3, 10, 16], ['remo-polea-baja', 3, 12, 57.5], ['curl-femoral-tumbado', 3, 12, 40], ['gemelo-pie', 4, 15, 60]]);
  const torsoB = day('Torso · Día B', 'torso', [['press-banca', 4, 8, 75], ['remo-barra', 4, 8, 60], ['press-militar-mancuernas', 3, 10, 16], ['jalon-pecho', 3, 10, 55], ['face-pull', 3, 15, 22.5], ['triceps-polea', 3, 12, 30]]);
  const assigned: Routine = {
    id: 'demo-r-assigned', ownerId: T, ownerRole: 'trainer', clientId: C, trainerId: T, name: 'Pierna / Torso',
    days: [legA, torsoB], template: false, week: 4, createdAt: now - 10 * WEEK, updatedAt: now - 4 * WEEK,
  };
  const tplLeg = JSON.parse(JSON.stringify([legA, torsoB])) as RoutineDay[];
  const templates: Routine[] = [
    { id: 'demo-tpl-1', ownerId: T, ownerRole: 'trainer', clientId: null, trainerId: T, name: 'Pierna / Torso', days: tplLeg, template: true, week: 1, createdAt: now - 20 * WEEK, updatedAt: now - 10 * WEEK, uses: 4 },
    {
      id: 'demo-tpl-2', ownerId: T, ownerRole: 'trainer', clientId: null, trainerId: T, name: 'Full body', template: true, week: 1, createdAt: now - 18 * WEEK, updatedAt: now - 9 * WEEK, uses: 2,
      days: [
        day('Día A', 'fullbody', [['sentadilla', 3, 8, null], ['press-banca', 3, 8, null], ['remo-polea-baja', 3, 10, null], ['plancha', 3, 40, null]]),
        day('Día B', 'fullbody', [['prensa', 3, 10, null], ['press-militar-mancuernas', 3, 10, null], ['jalon-pecho', 3, 10, null], ['hip-thrust', 3, 10, null]]),
      ],
    },
  ];
  const arms = day('Sábado · Brazos', 'brazos', [['press-militar-mancuernas', 3, 10, 14], ['elevaciones-laterales', 4, 12, 8], ['curl-concentrado', 3, 12, 12], ['fondos-banco', 3, 15, null], ['curl-martillo', 3, 10, 14]]);
  const own: Routine = { id: 'demo-r-own', ownerId: C, ownerRole: 'client', clientId: C, trainerId: T, name: 'Sábado · Brazos', days: [arms], template: false, week: 1, createdAt: now - 6 * WEEK, updatedAt: now - 2 * DAY };

  // Progresión por ejercicio a lo largo de 10 semanas (semana 0 = hace 10 semanas)
  const prog: Record<string, (k: number) => number> = {
    prensa: (k) => Math.min(120, 95 + Math.floor(k * 2.6 / 2.5) * 2.5),
    'press-banca': (k) => Math.min(75, 62.5 + Math.floor(k * 1.6 / 2.5) * 2.5),
    'remo-polea-baja': (k) => 45 + Math.floor(k / 3) * 2.5 + (k >= 9 ? 2.5 : 0),
    'remo-barra': (k) => 50 + Math.floor(k / 2) * 2.5,
    'jalon-pecho': (k) => 45 + Math.floor(k / 2) * 2.5,
    'curl-femoral-tumbado': (k) => 32.5 + Math.floor(k / 3) * 2.5,
    'gemelo-pie': (k) => 50 + Math.floor(k / 2) * 2.5,
    'face-pull': (k) => 17.5 + Math.floor(k / 4) * 2.5,
    'triceps-polea': (k) => 22.5 + Math.floor(k / 3) * 2.5,
    'sentadilla-bulgara': (k) => 12 + Math.floor(k / 3) * 2,
    'press-militar-mancuernas': (k) => 12 + Math.floor(k / 4) * 2,
    'elevaciones-laterales': () => 8,
    'curl-concentrado': (k) => 10 + Math.floor(k / 5) * 2,
    'curl-martillo': (k) => 12 + Math.floor(k / 5) * 2,
  };
  const feelFor = (k: number, i: number): Feel => (i === 0 ? 'easy' : i % 3 === 0 && k % 2 ? 'hard' : 'ok');

  const workouts: Workout[] = [];
  const thisWeek = startOfWeek(now);
  for (let k = 0; k < 10; k++) {
    const weekStart = thisWeek - (10 - k) * WEEK;
    const sessions: [number, RoutineDay, Routine][] = [
      [0, legA, assigned],
      [2, torsoB, assigned],
      [4, legA, assigned],
    ];
    if (k >= 4) sessions.push([5, arms, own]);
    sessions.forEach(([dowIdx, d, r], si) => {
      if (k === 6 && si === 1) return; // una sesión perdida
      const start = weekStart + dowIdx * DAY + 19 * 3600000 + si * 60000;
      const entries: EntryLog[] = d.exercises.map((p, pi) => {
        const f = prog[p.exerciseId || ''];
        const w = p.weight === null ? null : f ? f(k) : p.weight;
        const busy = k === 5 && d === legA && pi === 0;
        const exerciseId = busy ? 'sentadilla-bulgara' : p.exerciseId;
        return {
          id: uid(8),
          planId: busy ? null : p.id,
          exerciseId,
          name: ex(exerciseId)?.name || '',
          substituteOf: busy ? p.exerciseId : null,
          target: { sets: p.sets, reps: p.reps, weight: w },
          sets: Array.from({ length: p.sets }, (_, i) => ({
            weight: busy ? 16 : w,
            reps: p.exerciseId === 'curl-femoral-tumbado' && i === p.sets - 1 && k % 3 === 2 ? p.reps - 2 : p.reps,
            done: true,
            feel: p.exerciseId === 'curl-femoral-tumbado' && i === p.sets - 1 ? 'hard' : feelFor(k, i),
            at: start + (pi * 4 + i) * 180000,
          })),
        };
      });
      workouts.push({
        id: uid(), clientId: C, trainerId: T, routineId: r.id, dayId: d.id, dayName: d.name, group: d.group,
        startedAt: start, endedAt: start + 54 * 60000, status: 'done', entries,
        busy: k === 5 && d === legA ? [{ exerciseId: 'prensa', at: start }] : [],
      });
    });
  }
  // Esta semana: lunes hecho (si ya ha pasado)
  if (now - thisWeek > DAY) {
    const start = thisWeek + 19 * 3600000;
    workouts.push({
      id: uid(), clientId: C, trainerId: T, routineId: assigned.id, dayId: legA.id, dayName: legA.name, group: 'pierna', startedAt: start, endedAt: start + 3200000, status: 'done',
      entries: legA.exercises.map((p) => ({ id: uid(8), planId: p.id, exerciseId: p.exerciseId, name: ex(p.exerciseId)?.name || '', target: { sets: p.sets, reps: p.reps, weight: p.weight }, sets: Array.from({ length: p.sets }, (_, i) => ({ weight: p.weight, reps: p.reps, done: true, feel: i === 0 ? 'easy' : 'ok', at: start + i * 200000 })) })),
    });
  }

  const report = (date: number, peso: number, smm: number, bfp: number, score: number): BodyReport => ({
    id: `${C}_${date}`, clientId: C, trainerId: T, date, dateStr: new Date(date).toISOString().slice(0, 16).replace('T', ' '), score, postureScore: 58 + Math.round(score / 20),
    composition: {
      peso: { value: peso, min: 57, max: 77 }, smm: { value: smm, min: 28, max: 35 }, bfp: { value: bfp, min: 10, max: 20 },
      grasaKg: { value: Math.round(peso * bfp) / 100, min: 8, max: 16 }, visceral: { value: 3, min: 1, max: 10 }, imc: { value: Math.round((peso / 1.75 / 1.75) * 10) / 10, min: 18.5, max: 24 },
      tmb: { value: 1500 + Math.round(smm * 3), min: 1420, max: 1740 },
    },
    posture: {
      cabezaAdelantada: { value: 5.5, unit: 'cm', note: 'Cabeza adelantada' },
      hombroIzq: { value: 8, unit: 'cm', note: 'Hombro redondeado izquierdo' },
      hombroDer: { value: 4.8, unit: 'cm', note: 'Hombro redondeado derecho' },
      pelvis: { value: 9.8, unit: 'cm', note: 'Pelvis adelantada' },
    },
    circumferences: { cinturaMedia: 82 - (16 - bfp), brazoIzq: 27 + (smm - 29) / 2, musloIzq: 64 },
    createdAt: date,
  });
  const reports = [report(now - 30 * WEEK, 64.0, 29.0, 16.0, 72), report(now - 17 * WEEK, 65.2, 29.7, 15.2, 74), report(now - 4 * WEEK, 66.1, 30.4, 14.6, 76)];

  const sug: Suggestion = {
    id: 'demo-sug', routineId: own.id, dayId: arms.id, planId: arms.exercises[2].id, clientId: C, trainerId: T,
    fromExerciseId: 'curl-concentrado', toExerciseId: 'curl-polea', reason: 'Mantiene la tensión en todo el recorrido.', status: 'pending', createdAt: now - DAY,
  };
  const notes: Note[] = [
    { id: 'demo-n1', clientId: C, trainerId: T, clientName: 'Carlos', kind: 'note', text: 'Atascado en 75, la última no sale.', exerciseId: 'press-banca', createdAt: now - 7 * DAY, seen: true },
    { id: 'demo-n2', clientId: C, trainerId: T, clientName: 'Carlos', kind: 'note', text: 'Me molestó un poco la rodilla izquierda.', exerciseId: 'prensa', createdAt: now - 2 * DAY, seen: false },
  ];

  const tables = {
    users,
    routines: Object.fromEntries([assigned, own, ...templates].map((r) => [r.id, r])),
    workouts: Object.fromEntries(workouts.map((w) => [w.id, w])),
    bodyReports: Object.fromEntries(reports.map((r) => [r.id, r])),
    suggestions: { [sug.id]: sug },
    notes: Object.fromEntries(notes.map((x) => [x.id, x])),
    invites: {},
  };
  resetLocal(tables as unknown as Record<string, Record<string, Record<string, unknown>>>);
  const u = as === 'trainer' ? users[T] : users[C];
  localLogin({ uid: u.id, email: u.email || null, name: u.name });
}
