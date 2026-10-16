import { useState } from 'react';
import { ex, increment } from '../../data/catalog';
import { useApp, useMe } from '../../lib/app';
import { go } from '../../lib/router';
import { lastEntryFor, progress, type Progression } from '../../lib/stats';
import type { RoutineDay } from '../../lib/types';
import { clone, n, roundTo } from '../../lib/util';
import { Loading, Sec, TopBar, toast } from '../../ui/kit';
import { useTrainerData } from './data';
import { RoleNav } from '../../ui/rolenav';

type Mode = 'up' | 'same' | 'cycle' | 'deload';

export function NextWeek({ routineId }: { routineId: string }) {
  const { store, settings } = useApp();
  useMe();
  const td = useTrainerData();
  const [mode, setMode] = useState<Mode>('up');
  const [all, setAll] = useState(false);
  if (!td.ready) return <Loading />;
  const r = td.routines.find((x) => x.id === routineId);
  if (!r) return <Loading label="No encuentro la rutina" />;
  const client = td.clients.find((c) => c.id === r.clientId);
  const ws = td.workouts.filter((w) => w.clientId === r.clientId);
  const inc = { machine: settings.incMachine, dumbbell: settings.incDumbbell };
  const baseDays: RoutineDay[] = r.prevDays || r.days;

  const rows: (Progression & { day: string })[] = [];
  for (const d of baseDays) {
    for (const p of d.exercises) {
      const last = lastEntryFor(ws, p, d.id);
      const lastW = last?.sets.find((s) => s.done)?.weight ?? p.weight;
      const plan = { ...p, weight: lastW };
      let pr: Progression;
      if (mode === 'up') pr = progress(plan, last, inc);
      else if (mode === 'same') pr = { plan: p, from: { weight: lastW, reps: p.reps }, to: { weight: lastW, reps: p.reps }, change: 'keep', reason: 'Mismo plan' };
      else if (mode === 'cycle') {
        const step = increment(ex(p.exerciseId), inc) || 0;
        const to = lastW === null ? null : roundTo(lastW * 1.025, step || 1);
        pr = { plan: p, from: { weight: lastW, reps: p.reps }, to: { weight: to, reps: p.reps }, change: to !== lastW ? 'up-weight' : 'keep', reason: 'Nuevo ciclo, +2,5 %' };
      } else {
        const step = increment(ex(p.exerciseId), inc) || 1;
        const to = lastW === null ? null : roundTo(lastW * 0.9, step);
        pr = { plan: p, from: { weight: lastW, reps: p.reps }, to: { weight: to, reps: p.reps }, change: 'keep', reason: `${Math.max(1, Math.round(p.sets * 0.6))} series en vez de ${p.sets}` };
      }
      rows.push({ ...pr, day: d.name });
    }
  }
  const up = rows.filter((x) => x.change !== 'keep').length;
  const keep = rows.length - up;
  const shown = all ? rows : rows.slice(0, 6);

  const apply = async () => {
    const days = clone(baseDays).map((d) => ({
      ...d,
      exercises: d.exercises.map((p) => {
        const row = rows.find((x) => x.plan.id === p.id)!;
        return { ...p, weight: row.to.weight, reps: row.to.reps, sets: mode === 'deload' ? Math.max(1, Math.round(p.sets * 0.6)) : p.sets };
      }),
    }));
    await store.update('routines', r.id, {
      days,
      week: mode === 'cycle' ? 1 : r.week + 1,
      updatedAt: Date.now(),
      prevDays: mode === 'deload' ? baseDays : null,
    });
    toast(`Semana ${mode === 'cycle' ? 1 : r.week + 1} lista para ${client?.name}`);
    go(`/cliente/${r.clientId}`, true);
  };

  const opt = (m: Mode, t: string, s: string) => (
    <button type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} style={{ background: 'none', border: 0, borderTop: mode === m ? '2px solid var(--accent)' : '1px solid var(--line)', padding: mode === m ? '10px 0 12px' : '11px 0 12px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 16, fontWeight: mode === m ? 600 : 500, color: mode === m ? 'var(--accent-text)' : undefined }}>{t}</span>
      <span className="xs mute">{s}</span>
    </button>
  );

  return (
    <div className="screen with-nav">
      <TopBar back={`/cliente/${r.clientId}`} backLabel={client?.name || 'Cliente'} />
      <div className="pad">
        <h1 className="h1" style={{ marginTop: 2, fontSize: 34 }}>Semana {mode === 'cycle' ? 1 : r.week + 1}</h1>
        <p className="small mute" style={{ marginTop: 4, fontSize: 14 }}>
          A partir de la semana {r.week} · {r.days.length} {r.days.length === 1 ? 'día' : 'días'}
          {r.prevDays ? ' · ahora en descarga' : ''}
        </p>
      </div>
      <div className="main" style={{ paddingTop: 18 }}>
        <div role="radiogroup" aria-label="Cómo crear la semana" className="grid2">
          {opt('up', 'Subir peso', 'Donde fue bien')}
          {opt('same', 'Repetir igual', 'Mismo plan')}
          {opt('cycle', 'Nuevo ciclo', 'Desde la semana 1, +2,5 %')}
          {opt('deload', 'Descarga', '−40 % de series')}
        </div>
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <p style={{ fontSize: 14 }}>
            {mode === 'up'
              ? 'Sube si hizo todas las reps sin marcar «Duro». Lo demás se mantiene.'
              : mode === 'same'
                ? 'La misma rutina con los pesos que movió la última vez.'
                : mode === 'cycle'
                  ? 'Vuelve a empezar el ciclo con un 2,5 % más de carga.'
                  : 'Una semana más suave: menos series y un 10 % menos de peso. Al aplicar otra opción vuelve al plan anterior.'}
          </p>
          <p className="small mute" style={{ marginTop: 4 }}>
            +{n(settings.incMachine)} kg en máquina y barra · +1 rep en mancuernas
          </p>
        </div>
        <Sec title="Cambios" right={`${up} ${mode === 'deload' ? 'cambian' : 'suben'} · ${keep} se mantienen`} />
        {shown.map((x) => {
          const ee = ex(x.plan.exerciseId);
          return (
            <div key={x.plan.id} className="row" style={{ minHeight: 48 }}>
              <span className="col">
                <span className="m" style={{ fontSize: 15 }}>{ee?.name || x.plan.rawName}</span>
                <span className="xs mute">
                  {x.day.split(' · ')[1] || x.day} · {x.reason}
                </span>
              </span>
              {x.change === 'keep' ? (
                <span className="mute" style={{ fontSize: 15 }}>{x.to.weight !== null ? `${n(x.to.weight)} kg${mode === 'deload' ? '' : ', igual'}` : 'igual'}</span>
              ) : x.change === 'up-reps' ? (
                <span style={{ fontSize: 15 }}>
                  <span className="mute">{x.from.reps} → </span>
                  <span className="b">{x.to.reps} reps</span>
                </span>
              ) : (
                <span style={{ fontSize: 15 }}>
                  <span className="mute">{n(x.from.weight)} → </span>
                  <span className="b">{n(x.to.weight)} kg</span>
                </span>
              )}
            </div>
          );
        })}
        {!all && rows.length > 6 && (
          <button type="button" className="txt mute" onClick={() => setAll(true)}>
            Ver {rows.length - 6} más
          </button>
        )}
      </div>
      <div className="bottom">
        <button type="button" className="btn" onClick={apply}>
          Aplicar a la semana {mode === 'cycle' ? 1 : r.week + 1}
        </button>
        <a className="txt" style={{ alignSelf: 'center' }} href={`#/escribir?rutina=${r.id}&para=${r.clientId}`}>
          Revisar día a día
        </a>
      </div>
      <RoleNav trainer="clientes" />
    </div>
  );
}
