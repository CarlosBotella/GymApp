import { ex, increment } from '../data/catalog';
import type { DayGroup, EntryLog, PlanExercise, Routine, RoutineDay, Workout } from './types';
import { DAY, WEEK, dow, startOfWeek } from './util';

export function doneSets(e: EntryLog) {
  return e.sets.filter((s) => s.done);
}

export function entryVolume(e: EntryLog): number {
  const x = ex(e.exerciseId);
  if (x?.measure === 'seconds') return 0;
  const factor = x?.load === 'dumbbell' && !['sentadilla-goblet'].includes(x.id) ? 2 : 1;
  return doneSets(e).reduce((a, s) => a + (s.weight || 0) * s.reps * factor, 0);
}

export function workoutVolume(w: Workout): number {
  return w.entries.reduce((a, e) => a + entryVolume(e), 0);
}

export function doneSetCount(w: Workout): number {
  return w.entries.reduce((a, e) => a + doneSets(e).length, 0);
}

export function plannedSetCount(w: Workout): number {
  if (w.planned) return w.planned;
  return w.entries.reduce((a, e) => a + (e.skipped ? 0 : Math.max(e.target.sets, e.sets.length)), 0);
}

export function bestSet(e: EntryLog): { weight: number; reps: number } | null {
  if (ex(e.exerciseId)?.measure === 'seconds') return null;
  let best: { weight: number; reps: number } | null = null;
  for (const s of doneSets(e)) {
    const w = s.weight || 0;
    if (!best || w > best.weight || (w === best.weight && s.reps > best.reps)) best = { weight: w, reps: s.reps };
  }
  return best;
}

export function e1rm(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export function finished(ws: Workout[]): Workout[] {
  return ws.filter((w) => w.status !== 'active').sort((a, b) => a.startedAt - b.startedAt);
}

/** Serie temporal de la mejor serie por ejercicio (se cuentan también las alternativas usadas en su lugar) */
export function exerciseSeries(ws: Workout[], exerciseId: string): { at: number; weight: number; reps: number }[] {
  const out: { at: number; weight: number; reps: number }[] = [];
  for (const w of finished(ws)) {
    for (const e of w.entries) {
      if (e.exerciseId !== exerciseId) continue;
      const b = bestSet(e);
      if (b) out.push({ at: w.startedAt, ...b });
    }
  }
  return out;
}

export function topExercises(ws: Workout[], limit = 5): string[] {
  const c: Record<string, number> = {};
  for (const w of finished(ws)) for (const e of w.entries) if (e.exerciseId && doneSets(e).length && ex(e.exerciseId)?.load !== 'bodyweight' && ex(e.exerciseId)?.measure !== 'seconds') c[e.exerciseId] = (c[e.exerciseId] || 0) + 1;
  return Object.entries(c)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

export interface LinearFit {
  slope: number; // kg por día
  intercept: number;
  r2: number;
}

export function linearFit(pts: { x: number; y: number }[]): LinearFit | null {
  if (pts.length < 2) return null;
  const nn = pts.length;
  const mx = pts.reduce((a, p) => a + p.x, 0) / nn;
  const my = pts.reduce((a, p) => a + p.y, 0) / nn;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of pts) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
  }
  if (!sxx) return { slope: 0, intercept: my, r2: 1 };
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: syy ? (sxy * sxy) / (sxx * syy) : 1 };
}

export type Trend = { kind: 'up' | 'flat' | 'down'; since?: number; perWeek: number; first: number; last: number };

/** Estado de un ejercicio: sube, estancado (≥3 sesiones al mismo peso durante ≥3 semanas) o baja */
export function trend(series: { at: number; weight: number }[]): Trend | null {
  if (series.length < 3) return null;
  const first = series[0].weight;
  const last = series[series.length - 1].weight;
  const fit = linearFit(series.map((s) => ({ x: s.at / DAY, y: s.weight })));
  const perWeek = (fit?.slope || 0) * 7;
  let i = series.length - 1;
  while (i > 0 && series[i - 1].weight === last) i--;
  const runStart = series[i];
  const runLen = series.length - i;
  if (runLen >= 3 && Date.now() - runStart.at >= 3 * WEEK) return { kind: 'flat', since: runStart.at, perWeek, first, last };
  if (last < first) return { kind: 'down', perWeek, first, last };
  return { kind: 'up', perWeek, first, last };
}

export interface LearnedWeek {
  weeks: number;
  days: { group: DayGroup | null; count: number }[];
  ready: boolean;
}

/** Aprende qué grupo entrena cada día de la semana a partir de las últimas 8 semanas */
export function learnWeek(ws: Workout[]): LearnedWeek {
  const fin = finished(ws).filter((w) => w.startedAt > Date.now() - 8 * WEEK);
  const weeks = new Set(fin.map((w) => startOfWeek(w.startedAt))).size;
  const per: Record<number, Record<string, number>> = {};
  for (const w of fin) {
    const d = dow(w.startedAt);
    per[d] ||= {};
    per[d][w.group] = (per[d][w.group] || 0) + 1;
  }
  const days = Array.from({ length: 7 }, (_, d) => {
    const c = per[d] || {};
    const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    if (!top || top[1] < 2) return { group: null, count: 0 };
    return { group: top[0] as DayGroup, count: top[1] };
  });
  return { weeks, days, ready: weeks >= 3 && days.some((d) => d.group) };
}

/** Día de la rutina que toca hoy */
export function nextDay(r: Routine | null | undefined, ws: Workout[], learned: LearnedWeek): RoutineDay | null {
  if (!r || !r.days.length) return null;
  const weekStart = startOfWeek(Date.now());
  const doneThisWeek = new Set(finished(ws).filter((w) => w.routineId === r.id && w.startedAt >= weekStart).map((w) => w.dayId));
  const today = learned.days[dow(Date.now())];
  if (learned.ready && today.group) {
    const m = r.days.find((d) => d.group === today.group && !doneThisWeek.has(d.id));
    if (m) return m;
  }
  const last = finished(ws).filter((w) => w.routineId === r.id).pop();
  if (!last) return r.days[0];
  const idx = r.days.findIndex((d) => d.id === last.dayId);
  return r.days[(idx + 1) % r.days.length];
}

export function lastEntryFor(ws: Workout[], plan: PlanExercise, dayId?: string | null): EntryLog | null {
  const fin = finished(ws);
  for (let i = fin.length - 1; i >= 0; i--) {
    const w = fin[i];
    if (dayId && w.dayId !== dayId) continue;
    const e = w.entries.find((x) => x.planId === plan.id && !x.skipped) || w.entries.find((x) => x.exerciseId === plan.exerciseId && !x.skipped && !x.substituteOf);
    if (e && doneSets(e).length) return e;
  }
  return null;
}

export interface Progression {
  plan: PlanExercise;
  from: { weight: number | null; reps: number };
  to: { weight: number | null; reps: number };
  change: 'up-weight' | 'up-reps' | 'keep';
  reason: string;
}

/** Regla de progresión: sube si hizo todas las reps sin marcar «Duro» */
export function progress(plan: PlanExercise, last: EntryLog | null, inc: { machine: number; dumbbell: number }): Progression {
  const x = ex(plan.exerciseId);
  const from = { weight: plan.weight, reps: plan.reps };
  if (!last) return { plan, from, to: from, change: 'keep', reason: 'Sin datos de la última vez' };
  if (x?.imported) return { plan, from, to: from, change: 'keep', reason: 'Carga y objetivo ajustados manualmente' };
  const done = doneSets(last);
  const allReps = done.length >= plan.sets && done.slice(0, plan.sets).every((s) => s.reps >= plan.reps);
  const hard = done.some((s) => s.feel === 'hard');
  const easy = done.length > 0 && done.every((s) => s.feel === 'easy');
  if (hard) return { plan, from, to: from, change: 'keep', reason: 'Marcó «Duro»' };
  if (!allReps) return { plan, from, to: from, change: 'keep', reason: 'No completó todas las reps' };
  const step = increment(x, inc);
  if (!x || x.load === 'bodyweight' || x.load === 'dumbbell' || plan.weight === null) {
    return { plan, from, to: { weight: plan.weight, reps: plan.reps + 1 }, change: 'up-reps', reason: easy ? 'Todas las reps, «Fácil»' : 'Todas las reps' };
  }
  return { plan, from, to: { weight: (plan.weight || 0) + step, reps: plan.reps }, change: 'up-weight', reason: easy ? 'Todas las reps, «Fácil»' : 'Todas las reps, «Justo»' };
}

export function feelShare(ws: Workout[]): { easy: number; ok: number; hard: number; total: number } {
  let easy = 0;
  let ok = 0;
  let hard = 0;
  for (const w of finished(ws)) for (const e of w.entries) for (const s of doneSets(e)) {
    if (s.feel === 'easy') easy++;
    else if (s.feel === 'hard') hard++;
    else if (s.feel === 'ok') ok++;
  }
  return { easy, ok, hard, total: easy + ok + hard };
}

export function weeklyVolume(ws: Workout[], weeks: number): { start: number; volume: number }[] {
  const now = startOfWeek(Date.now());
  const out = Array.from({ length: weeks }, (_, i) => ({ start: now - (weeks - 1 - i) * WEEK, volume: 0 }));
  for (const w of finished(ws)) {
    const s = startOfWeek(w.startedAt);
    const b = out.find((o) => o.start === s);
    if (b) b.volume += workoutVolume(w);
  }
  return out;
}

/** Récords: sesiones en las que un ejercicio superó su mejor peso anterior */
export function records(ws: Workout[], since: number): { at: number; exerciseId: string; weight: number; reps: number }[] {
  const best: Record<string, number> = {};
  const out: { at: number; exerciseId: string; weight: number; reps: number }[] = [];
  for (const w of finished(ws)) {
    for (const e of w.entries) {
      if (!e.exerciseId) continue;
      const b = bestSet(e);
      if (!b || !b.weight) continue;
      const prev = best[e.exerciseId];
      if (prev !== undefined && b.weight > prev && w.startedAt >= since) out.push({ at: w.startedAt, exerciseId: e.exerciseId, ...b });
      if (prev === undefined || b.weight > prev) best[e.exerciseId] = b.weight;
    }
  }
  return out;
}

export function periodStart(p: string): number {
  const now = Date.now();
  if (p === '4s') return now - 4 * WEEK;
  if (p === '6m') return now - 26 * WEEK;
  if (p === 'ano') return now - 52 * WEEK;
  if (p === 'todo') return 0;
  return now - 13 * WEEK;
}

export function constancy(ws: Workout[], since: number, perWeek: number): { done: number; expected: number; pct: number } {
  const fin = finished(ws).filter((w) => w.startedAt >= since && w.status === 'done');
  const first = finished(ws)[0]?.startedAt || Date.now();
  const from = Math.max(since, startOfWeek(first));
  const weeks = Math.max(1, Math.round((Date.now() - from) / WEEK));
  const expected = Math.max(fin.length, weeks * Math.max(1, perWeek));
  return { done: fin.length, expected, pct: expected ? Math.round((fin.length / expected) * 100) : 0 };
}
