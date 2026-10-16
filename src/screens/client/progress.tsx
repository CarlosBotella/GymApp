import { useState } from 'react';
import { ex } from '../../data/catalog';
import { addNote } from '../../lib/api';
import { useApp, useMe } from '../../lib/app';
import { useClientData } from '../../lib/hooks';
import { href } from '../../lib/router';
import { constancy, exerciseSeries, finished, periodStart, records, topExercises, trend, workoutVolume } from '../../lib/stats';
import type { BodyReport, Routine, Workout } from '../../lib/types';
import { COMPOSITION_UNITS } from '../../lib/visbody';
import { WEEK, dateLong, dateShort, month, n, signed, startOfWeek } from '../../lib/util';
import { IcArrowDown, IcArrowFlat, IcArrowUp, IcChev, IcDownload, IcUpload } from '../../ui/icons';
import { DayCalendar, TrendChart, WeekBars, num, type DaySession, type WeekBar } from '../../ui/charts';
import { ClientNav, Loading, Sec, Seg, TopBar, toast } from '../../ui/kit';

type Period = '4s' | '3m' | 'ano' | 'todo';

export function bodyDelta(rs: BodyReport[], key: string): { last: number | null; delta: number | null; since: number | null } {
  const withKey = rs.filter((r) => r.composition[key]);
  const last = withKey[withKey.length - 1];
  const prev = withKey[withKey.length - 2];
  return { last: last ? last.composition[key].value : null, delta: last && prev ? last.composition[key].value - prev.composition[key].value : null, since: prev ? prev.date : null };
}

/** Volumen y sesiones por semana (lunes a domingo), de más antigua a la actual */
export function weekStats(ws: Workout[], weeks: number): WeekBar[] {
  const now = startOfWeek(Date.now());
  const out: WeekBar[] = Array.from({ length: weeks }, (_, i) => ({ start: now - (weeks - 1 - i) * WEEK, volume: 0, sessions: 0 }));
  for (const w of finished(ws)) {
    const b = out.find((o) => o.start === startOfWeek(w.startedAt));
    if (b) {
      b.volume += workoutVolume(w);
      b.sessions++;
    }
  }
  return out;
}

export function daySessions(ws: Workout[], fromTrainer: Routine[]): DaySession[] {
  const plan = new Set(fromTrainer.map((r) => r.id));
  return finished(ws).map((w) => ({
    at: w.startedAt,
    name: w.dayName,
    kind: w.routineId && plan.has(w.routineId) ? 'plan' : 'extra',
    mins: w.endedAt ? Math.round((w.endedAt - w.startedAt) / 60000) : 0,
  }));
}

/** Puntos de fuerza: mejor serie de cada sesión, con sus repeticiones */
export function strengthPoints(ws: Workout[], id: string) {
  const dumb = ex(id)?.load === 'dumbbell';
  return exerciseSeries(ws, id).map((s) => ({ x: s.at, y: s.weight, detail: `× ${s.reps}${dumb ? ' · por mancuerna' : ''}` }));
}

export const BODY_METRICS: [string, string][] = [
  ['bfp', 'Grasa %'],
  ['peso', 'Peso'],
  ['smm', 'Músculo'],
  ['grasaKg', 'Grasa kg'],
  ['visceral', 'Visceral'],
  ['score', 'Puntuación'],
];

export function bodyPoints(reports: BodyReport[], key: string) {
  if (key === 'score') return reports.filter((r) => r.score !== null).map((r) => ({ x: r.date, y: r.score as number }));
  return reports.filter((r) => r.composition[key]).map((r) => ({ x: r.date, y: r.composition[key].value }));
}

function Chips<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map(([v, t]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {t}
        </button>
      ))}
    </div>
  );
}

function Glance({ icon, title, sub, action }: { icon: React.ReactNode; title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto', columnGap: 8, alignItems: 'start', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ paddingTop: 2 }}>{icon}</span>
      <span className="stack" style={{ gap: 2 }}>
        <span className="m">{title}</span>
        <span className="small mute">{sub}</span>
      </span>
      {action || <span />}
    </div>
  );
}

function Stat3({ items }: { items: [string, string][] }) {
  return (
    <div className="grid3" style={{ marginTop: 4 }}>
      {items.map(([v, t]) => (
        <div key={t} className="stack" style={{ gap: 3 }}>
          <span className="stat-s" style={{ fontSize: 22 }}>{v}</span>
          <span className="xs mute">{t}</span>
        </div>
      ))}
    </div>
  );
}

function Legend({ items }: { items: [string, 'line' | 'dash' | 'box' | 'bar' | 'accent' | 'ink'][] }) {
  return (
    <div className="legend">
      {items.map(([t, k]) => (
        <span key={t}>
          {k === 'line' && <i style={{ height: 2, background: 'var(--accent)' }} />}
          {k === 'dash' && <i style={{ height: 0, borderTop: '1.5px dashed var(--mute)' }} />}
          {k === 'box' && <i style={{ height: 8, background: 'var(--band)' }} />}
          {k === 'bar' && <i style={{ height: 8, width: 10, background: 'var(--bar)' }} />}
          {k === 'accent' && <i style={{ height: 8, width: 10, background: 'var(--accent)' }} />}
          {k === 'ink' && <i style={{ height: 8, width: 10, background: 'var(--ink)' }} />}
          {t}
        </span>
      ))}
    </div>
  );
}

export function Progress() {
  const { store } = useApp();
  const me = useMe();
  const d = useClientData(me.id, me);
  const [p, setP] = useState<Period>('3m');
  const [exId, setExId] = useState<string | null>(null);
  const [metric, setMetric] = useState('bfp');
  if (!d.ready) return <Loading />;
  const since = periodStart(p);
  const ws = finished(d.workouts);
  const inPeriod = ws.filter((w) => w.startedAt >= since);
  const c = constancy(d.workouts, since, me.days || d.main?.days.length || 3);
  const recs = records(d.workouts, since).sort((a, b) => b.at - a.at);
  const weeksN = p === '4s' ? 4 : p === '3m' ? 13 : p === 'ano' ? 52 : Math.min(104, Math.max(8, Math.ceil((Date.now() - (ws[0]?.startedAt || Date.now())) / WEEK) + 1));
  const vol = weekStats(d.workouts, weeksN);
  const lastFull = vol.filter((v) => v.start < startOfWeek(Date.now())).pop();
  const tops = topExercises(inPeriod, 8);
  const cur = exId && tops.includes(exId) ? exId : tops[0] || null;
  const curPts = cur ? strengthPoints(inPeriod, cur) : [];
  const curTrend = cur ? trend(exerciseSeries(inPeriod, cur)) : null;
  const ups = curPts.reduce((a, pt, i) => a + (i && pt.y > curPts[i - 1].y ? 1 : 0), 0);
  const allTrends = tops.map((id) => trend(exerciseSeries(inPeriod, id))).filter(Boolean);
  const upCount = allTrends.filter((t) => t!.kind === 'up').length;
  const flat = tops.map((id) => ({ id, t: trend(exerciseSeries(inPeriod, id)) })).filter((x) => x.t?.kind === 'flat');

  const reports = d.reports;
  const metrics = BODY_METRICS.filter(([k]) => bodyPoints(reports, k).length);
  const mKey = metrics.some(([k]) => k === metric) ? metric : metrics[0]?.[0] || 'bfp';
  const mPts = bodyPoints(reports, mKey);
  const lastR = reports[reports.length - 1];
  const firstR = reports[0];
  const band = mKey !== 'score' && lastR?.composition[mKey]?.min !== undefined && lastR.composition[mKey].max !== undefined ? ([lastR.composition[mKey].min!, lastR.composition[mKey].max!] as [number, number]) : null;
  const mUnit = mKey === 'score' ? 'pts' : COMPOSITION_UNITS[mKey] || '';
  const bf = firstR && lastR && firstR !== lastR && firstR.composition.bfp && lastR.composition.bfp ? [firstR.composition.bfp.value, lastR.composition.bfp.value] : null;
  const smmTot = firstR && lastR && firstR !== lastR && firstR.composition.smm && lastR.composition.smm ? lastR.composition.smm.value - firstR.composition.smm.value : null;
  const startRange = inPeriod[0]?.startedAt || since;
  const calWeeks = p === '4s' ? 4 : p === '3m' ? 13 : 26;

  return (
    <div className="screen with-nav">
      <TopBar
        left={<span className="small mute">{inPeriod.length ? `${dateShort(startRange)} – ${dateShort(Date.now())}` : 'Sin entrenos en este periodo'}</span>}
        right={
          <a className="txt m" href={href('/exportar')}>
            <IcDownload /> Exportar
          </a>
        }
      />
      <div className="pad">
        <h1 className="h1" style={{ marginTop: 2 }}>Progreso</h1>
        <div style={{ marginTop: 6 }}>
          <Seg value={p} onChange={setP} label="Periodo" options={[['4s', '4 sem'], ['3m', '3 meses'], ['ano', 'Año'], ['todo', 'Todo']]} />
        </div>
      </div>
      <div className="main" style={{ paddingBottom: 28 }}>
        {/* ——— De un vistazo */}
        <Sec title="De un vistazo" style={{ marginTop: 6 }} />
        {curTrend || bf || c.done ? null : <p className="small mute" style={{ padding: '12px 0' }}>Entrena unas semanas y aquí verás si vas subiendo de forma lineal.</p>}
        {allTrends.length > 0 && (
          <Glance
            icon={upCount >= allTrends.length / 2 ? <IcArrowUp /> : <IcArrowFlat />}
            title={upCount === allTrends.length ? 'Fuerza: subida casi lineal' : upCount >= allTrends.length / 2 ? 'Fuerza: sube en casi todo' : 'Fuerza: bastante plana'}
            sub={`${upCount} de ${allTrends.length} ejercicios suben${curTrend && curTrend.kind === 'up' && cur ? `; ${ex(cur)?.name} ${signed(curTrend.perWeek)} kg por semana` : ''}`}
          />
        )}
        {flat.slice(0, 1).map((f) => (
          <Glance
            key={f.id}
            icon={<IcArrowFlat />}
            title={`${ex(f.id)?.name}: estancado`}
            sub={`${n(f.t!.last)} kg desde el ${dateShort(f.t!.since!)}`}
            action={
              me.trainerId ? (
                <button
                  type="button"
                  className="txt accent"
                  style={{ fontSize: 13, minHeight: 36 }}
                  onClick={async () => {
                    await addNote(store, me, `Estancado en ${ex(f.id)?.name} (${n(f.t!.last)} kg desde el ${dateShort(f.t!.since!)}).`, 'alert', { exerciseId: f.id });
                    toast('Aviso enviado a tu entrenador');
                  }}
                >
                  Avisar
                </button>
              ) : undefined
            }
          />
        ))}
        {bf && (
          <Glance
            icon={bf[1] < bf[0] ? <IcArrowDown /> : bf[1] > bf[0] ? <IcArrowUp /> : <IcArrowFlat />}
            title={bf[1] < bf[0] ? 'Grasa bajando' : bf[1] > bf[0] ? 'Grasa subiendo' : 'Grasa estable'}
            sub={`${n(bf[0])} → ${n(bf[1])} % desde ${month(firstR.date)} ${new Date(firstR.date).getFullYear()}${smmTot !== null ? `, ${smmTot >= 0 ? 'con' : 'con'} ${signed(smmTot)} kg de músculo` : ''}`}
          />
        )}
        {c.done > 0 && (
          <Glance icon={c.pct >= 80 ? <IcArrowUp /> : <IcArrowFlat />} title={c.pct >= 90 ? 'Constancia alta' : c.pct >= 70 ? 'Constancia buena' : 'Constancia irregular'} sub={`${c.done} de ${c.expected} sesiones (${c.pct} %)`} />
        )}

        {/* ——— Fuerza */}
        <div className="sec" style={{ marginTop: 28, alignItems: 'center', paddingBottom: 0, minHeight: 36 }}>
          <span className="kicker">Fuerza · mejor serie</span>
          {tops.length > 0 && (
            <a className="txt accent" href={href('/evolucion')} style={{ fontSize: 13, minHeight: 36 }}>
              Ver todos
            </a>
          )}
        </div>
        {!cur ? (
          <p className="small mute" style={{ padding: '12px 0' }}>Aún no hay entrenos en este periodo.</p>
        ) : (
          <div className="stack" style={{ gap: 10, marginTop: 10 }}>
            <Chips value={cur} onChange={setExId} label="Ejercicio" options={tops.map((id) => [id, ex(id)?.name || id] as [string, string])} />
            <TrendChart points={curPts} unit="kg" ritmo aria={`${ex(cur)?.name}: mejor serie por sesión, de ${n(curPts[0]?.y)} a ${n(curPts[curPts.length - 1]?.y)} kg`} />
            {curPts.length >= 3 && <Legend items={[['Tú', 'line'], ['Ritmo lineal', 'dash'], ['Margen lineal', 'box']]} />}
            {curPts.length > 1 && (
              <Stat3
                items={[
                  [`${signed(curPts[curPts.length - 1].y - curPts[0].y)} kg`, `en ${Math.max(1, Math.round((curPts[curPts.length - 1].x - curPts[0].x) / WEEK))} semanas`],
                  [curTrend ? signed(curTrend.perWeek) : '—', 'kg por semana'],
                  [String(ups), ups === 1 ? 'subida de peso' : 'subidas de peso'],
                ]}
              />
            )}
          </div>
        )}

        {/* ——— Volumen y constancia */}
        <div className="sec" style={{ marginTop: 30 }}>
          <span className="kicker">Volumen y constancia</span>
          <span>toneladas por semana</span>
        </div>
        <div className="stack" style={{ gap: 12, marginTop: 12 }}>
          <Stat3
            items={[
              [String(c.done), `sesiones de ${c.expected}`],
              [`${c.pct} %`, 'constancia'],
              [lastFull ? `${num(lastFull.volume / 1000, 1)} t` : '—', 'última semana'],
            ]}
          />
          <WeekBars weeks={vol} aria={`Volumen por semana de las últimas ${weeksN} semanas`} />
          <Legend items={[['Semana', 'bar'], ['Tocada', 'accent']]} />
          <span className="m" style={{ fontSize: 15, marginTop: 8 }}>Días entrenados</span>
          <DayCalendar sessions={daySessions(d.workouts, d.fromTrainer)} weeks={calWeeks} aria={`Días entrenados en las últimas ${calWeeks} semanas`} />
          <Legend items={[['Rutina del entrenador', 'accent'], ['Por tu cuenta', 'ink'], ['Descanso', 'box']]} />
        </div>

        {/* ——— Récords */}
        <div className="sec" style={{ marginTop: 30 }}>
          <span className="kicker">Récords</span>
          <span>{recs.length} en el periodo</span>
        </div>
        {recs.length === 0 && <p className="small mute" style={{ padding: '12px 0' }}>Sin récords en este periodo.</p>}
        {recs.slice(0, 3).map((r) => (
          <a key={r.at + r.exerciseId} className="row" href={href(`/ejercicio/${r.exerciseId}`)}>
            <span className="col">
              <span className="t">{ex(r.exerciseId)?.name}</span>
              <span className="s">{dateShort(r.at)}</span>
            </span>
            <span className="b" style={{ fontSize: 15 }}>
              {n(r.weight)} kg × {r.reps}
            </span>
          </a>
        ))}

        {/* ——— Cuerpo */}
        <div className="sec" style={{ marginTop: 30 }}>
          <span className="kicker">Cuerpo · Visbody</span>
          <span>{lastR ? `último: ${dateLong(lastR.date)}` : 'sin informes'}</span>
        </div>
        {!lastR ? (
          <p className="small mute" style={{ padding: '12px 0' }}>Sube el PDF de tu Visbody para ver aquí tu composición corporal. Vale también con informes antiguos: cada uno va a su fecha.</p>
        ) : (
          <div className="stack" style={{ gap: 10, marginTop: 10 }}>
            <Chips value={mKey} onChange={setMetric} label="Dato del cuerpo" options={metrics} />
            <TrendChart points={mPts} unit={mUnit} band={band} aria={`${metrics.find(([k]) => k === mKey)?.[1]}: ${mPts.map((x) => n(x.y)).join(', ')}`} />
            <Stat3
              items={[
                [lastR.composition.peso ? `${n(lastR.composition.peso.value)} kg` : '—', 'peso'],
                [lastR.composition.smm ? `${n(lastR.composition.smm.value)} kg` : '—', 'músculo'],
                [lastR.score !== null ? String(lastR.score) : '—', 'puntuación'],
              ]}
            />
          </div>
        )}

        {/* ——— Informes */}
        <div className="sec" style={{ marginTop: 30, alignItems: 'center', paddingBottom: 0, minHeight: 36 }}>
          <span className="kicker">Tus informes</span>
          {reports.length > 0 && (
            <a className="txt accent" href={href('/cuerpo')} style={{ fontSize: 13, minHeight: 36 }}>
              Ver {reports.length === 1 ? 'el informe' : `los ${reports.length}`}
            </a>
          )}
        </div>
        {[...reports]
          .reverse()
          .slice(0, 3)
          .map((r) => (
            <ReportRow key={r.id} r={r} />
          ))}
        <a className="btn2" href={href('/visbody')} style={{ marginTop: 14 }}>
          <IcUpload /> Subir informe Visbody
        </a>
      </div>
      <ClientNav active="progreso" />
    </div>
  );
}

export function reportSummary(r: BodyReport): string {
  const c = r.composition;
  return [c.peso && `${n(c.peso.value)} kg`, c.bfp && `${n(c.bfp.value)} % grasa`, c.smm && `${n(c.smm.value)} kg músculo`].filter(Boolean).join(' · ');
}

export function ReportRow({ r, sub, base = '/cuerpo' }: { r: BodyReport; sub?: string; base?: string }) {
  return (
    <a className="row" href={href(`${base}/${r.id}`)} style={{ gridTemplateColumns: 'minmax(0,1fr) auto 18px', minHeight: sub ? 80 : 62 }}>
      <span className="col">
        <span className="t" style={{ fontSize: sub ? 18 : 16 }}>{dateLong(r.date)}</span>
        <span className="s" style={{ color: sub ? 'var(--ink)' : undefined }}>{reportSummary(r) || 'Sin datos de composición'}</span>
        {sub && <span className="xs mute">{sub}</span>}
      </span>
      <span style={{ fontSize: sub ? 24 : 14, fontWeight: sub ? 500 : 600, letterSpacing: sub ? '-0.02em' : 0 }}>{r.score !== null ? (sub ? r.score : `${r.score} pts`) : ''}</span>
      <IcChev className="chev" />
    </a>
  );
}

export function Evolution() {
  const me = useMe();
  const d = useClientData(me.id, me);
  const [p, setP] = useState<Period>('todo');
  if (!d.ready) return <Loading />;
  const since = periodStart(p);
  const ws = finished(d.workouts).filter((w) => w.startedAt >= since);
  const ids = topExercises(ws, 40);
  const reports = d.reports.filter((r) => r.date >= since || p === 'todo');
  const lastR = reports[reports.length - 1];
  return (
    <div className="screen with-nav">
      <TopBar back="/progreso" backLabel="Progreso" />
      <div className="pad">
        <h1 className="h1" style={{ marginTop: 2 }}>Evolución</h1>
        <div style={{ marginTop: 6 }}>
          <Seg value={p} onChange={setP} label="Periodo" options={[['3m', '3 meses'], ['ano', 'Año'], ['todo', 'Todo']]} />
        </div>
      </div>
      <div className="main" style={{ paddingBottom: 28 }}>
        <div className="sec" style={{ marginTop: 12 }}>
          <span className="kicker">Fuerza · {ids.length} ejercicios</span>
          <Legend items={[['Tú', 'line'], ['Ritmo lineal', 'dash']]} />
        </div>
        {ids.length === 0 && <p className="small mute" style={{ padding: '12px 0' }}>Aún no hay entrenos en este periodo.</p>}
        {ids.map((id) => {
          const pts = strengthPoints(ws, id);
          const t = trend(exerciseSeries(ws, id));
          return (
            <figure key={id} style={{ margin: 0, padding: '14px 0 12px', borderBottom: '1px solid var(--line)' }}>
              <figcaption className="row-actions" style={{ alignItems: 'baseline' }}>
                <a className="m" href={href(`/ejercicio/${id}`)} style={{ textDecoration: 'none' }}>
                  {ex(id)?.name}
                </a>
                <span className="small mute">{pts.length ? `${n(pts[0].y)} → ${n(pts[pts.length - 1].y)} kg` : ''}</span>
              </figcaption>
              <TrendChart points={pts} unit="kg" ritmo height={160} aria={`${ex(id)?.name}: de ${n(pts[0]?.y)} a ${n(pts[pts.length - 1]?.y)} kg`} />
              <p className="small mute" style={{ marginTop: 2 }}>
                {!t ? 'Pocas sesiones todavía.' : t.kind === 'flat' ? `Plano desde el ${dateShort(t.since!)}.` : t.kind === 'down' ? 'Ha bajado respecto al inicio.' : `Lineal: unos ${signed(t.perWeek)} kg por semana.`}
              </p>
            </figure>
          );
        })}

        <Sec title="Cuerpo · Visbody" right={`${reports.length} ${reports.length === 1 ? 'informe' : 'informes'}`} style={{ marginTop: 26 }} />
        {reports.length === 0 && (
          <p className="small mute" style={{ padding: '12px 0' }}>
            Sin informes. <a href={href('/visbody')}>Sube uno</a>.
          </p>
        )}
        {reports.length > 0 &&
          BODY_METRICS.map(([k, t]) => {
            const pts = bodyPoints(reports, k);
            if (!pts.length) return null;
            const v = k !== 'score' ? lastR?.composition[k] : undefined;
            const band = v && v.min !== undefined && v.max !== undefined ? ([v.min, v.max] as [number, number]) : null;
            return (
              <figure key={k} style={{ margin: 0, padding: '14px 0 12px', borderBottom: '1px solid var(--line)' }}>
                <figcaption className="row-actions" style={{ alignItems: 'baseline' }}>
                  <span className="m">{t}</span>
                  <span className="small mute">{pts.length > 1 ? `${n(pts[0].y)} → ${n(pts[pts.length - 1].y)}` : n(pts[0].y)}</span>
                </figcaption>
                <TrendChart points={pts} unit={k === 'score' ? 'pts' : COMPOSITION_UNITS[k] || ''} band={band} height={160} aria={`${t}: ${pts.map((x) => n(x.y)).join(', ')}`} />
              </figure>
            );
          })}
      </div>
      <ClientNav active="progreso" />
    </div>
  );
}
