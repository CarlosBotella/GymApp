import { useState } from 'react';
import { getExercise } from '../data/catalog';
import { finished, workoutTotals } from '../lib/stats';
import { fmtDate, fmtDuration, fmtKg } from '../lib/util';
import type { LoggedSet, Workout } from '../lib/types';
import { ExerciseThumb } from './ui';

function setLine(s: LoggedSet, logType: string) {
  if (logType === 'weight_reps') return `${fmtKg(s.weight)} kg × ${s.reps ?? '–'}`;
  if (logType === 'reps') return `${s.reps ?? '–'} reps`;
  if (logType === 'time') return `${s.seconds ?? '–'} s`;
  return `${s.seconds != null ? Math.round(s.seconds / 60) : '–'} min${s.km ? ` · ${fmtKg(s.km)} km` : ''}`;
}

export function WorkoutSets({ workout }: { workout: Workout }) {
  return (
    <div className="list">
      {workout.entries.map((e) => {
        const ex = getExercise(e.exerciseId);
        return (
          <div key={e.uid} className="item" style={{ alignItems: 'flex-start' }}>
            <ExerciseThumb exerciseId={e.exerciseId} />
            <div className="grow">
              <div className="name">{ex.name}</div>
              <div className="meta">{e.sets.map((s) => setLine(s, ex.logType)).join(' · ')}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const FEEL = ['', 'Fatal', 'Flojo', 'Normal', 'Bien', 'Brutal'];

/** Historial de entrenos. El entrenador puede dejar un comentario en cada uno. */
export function WorkoutHistory({ workouts, onComment, onDelete }: {
  workouts: Workout[];
  onComment?(w: Workout, text: string): Promise<void>;
  onDelete?(w: Workout): Promise<void>;
}) {
  const list = finished(workouts);
  if (!list.length) return <p className="muted">Todavía no hay entrenos registrados.</p>;
  return (
    <div className="list">
      {list.map((w) => <HistoryItem key={w.id} w={w} onComment={onComment} onDelete={onDelete} />)}
    </div>
  );
}

function HistoryItem({ w, onComment, onDelete }: { w: Workout; onComment?(w: Workout, t: string): Promise<void>; onDelete?(w: Workout): Promise<void> }) {
  const t = workoutTotals(w);
  const [text, setText] = useState(w.trainerComment ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <details className="wk" style={{ borderBottom: '1px solid var(--line)' }}>
      <summary className="item" style={{ borderBottom: 0 }}>
        <div className="thumb" style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 20, color: 'var(--ink)' }}>
          {new Date(w.startedAt).getDate()}
        </div>
        <div className="grow">
          <div className="name">{w.dayName}</div>
          <div className="meta">
            {fmtDate(w.startedAt)} · {fmtDuration(t.ms)} · {t.sets} series
            {w.feeling ? ` · ${FEEL[w.feeling]}` : ''}
          </div>
          {(w.trainerComment || w.notes) && (
            <div className="row" style={{ gap: 6, marginTop: 4 }}>
              {w.notes && <span className="badge">Nota del cliente</span>}
              {w.trainerComment && <span className="badge plate">Comentario del entrenador</span>}
            </div>
          )}
        </div>
      </summary>
      <div className="wk-sets">
        {w.entries.map((e) => {
          const ex = getExercise(e.exerciseId);
          return (
            <div key={e.uid}>
              <span>{ex.name}</span>
              <span className="muted">{e.sets.map((s) => setLine(s, ex.logType).replace(' kg × ', '×')).join(' · ')}</span>
            </div>
          );
        })}
        {w.notes && <p style={{ margin: '10px 0 0' }}><b>Cliente:</b> {w.notes}</p>}
        {!onComment && w.trainerComment && <p style={{ margin: '10px 0 0', color: 'var(--plate)' }}><b>Entrenador:</b> {w.trainerComment}</p>}
        {onComment && (
          <div className="stack" style={{ marginTop: 10, paddingRight: 2 }}>
            <textarea className="input" placeholder="Comentario para el cliente" value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn small" disabled={busy || text === (w.trainerComment ?? '')} onClick={async () => {
              setBusy(true);
              try { await onComment(w, text.trim()); } finally { setBusy(false); }
            }}>Guardar comentario</button>
          </div>
        )}
        {onDelete && (
          <button className="btn small danger" style={{ marginTop: 8 }} onClick={() => confirm('¿Borrar este entreno?') && onDelete(w)}>Borrar entreno</button>
        )}
      </div>
    </details>
  );
}
