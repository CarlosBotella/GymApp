import { useState } from 'react';
import { ex } from '../../data/catalog';
import { useMe } from '../../lib/app';
import { useClientData } from '../../lib/hooks';
import { addNote } from '../../lib/api';
import { useApp } from '../../lib/app';
import { href } from '../../lib/router';
import { constancy, exerciseSeries, finished, periodStart, records, topExercises, trend, weeklyVolume } from '../../lib/stats';
import type { BodyReport } from '../../lib/types';
import { dateLong, dateShort, month, n, signed } from '../../lib/util';
import { IcArrowDown, IcArrowFlat, IcArrowUp, IcChart, IcDownload, IcUpload } from '../../ui/icons';
import { Bars, LineChart } from '../../ui/charts';
import { ClientNav, Loading, Sec, Seg, TopBar, toast } from '../../ui/kit';

type Period = '4s' | '3m' | 'ano' | 'todo';

export function weekLabels(starts: number[]): (string | null)[] {
  let prev = -1;
  return starts.map((s, i) => {
    const m = new Date(s).getMonth();
    const out = m !== prev && (i === 0 || i === starts.length - 1 || i % 2 === 0) ? month(s) : null;
    if (out) prev = m;
    return out;
  });
}

export function bodyDelta(rs: BodyReport[], key: string): { last: number | null; delta: number | null; since: number | null } {
  const withKey = rs.filter((r) => r.composition[key]);
  const last = withKey[withKey.length - 1];
  const prev = withKey[withKey.length - 2];
  return { last: last ? last.composition[key].value : null, delta: last && prev ? last.composition[key].value - prev.composition[key].value : null, since: prev ? prev.date : null };
}

export function Progress() {
  const me = useMe();
  const d = useClientData(me.id, me);
  const [p, setP] = useState<Period>('3m');
  if (!d.ready) return <Loading />;
  const since = periodStart(p);
  const ws = finished(d.workouts);
  const inPeriod = ws.filter((w) => w.startedAt >= since);
  const c = constancy(d.workouts, since, me.days || d.main?.days.length || 3);
  const recs = records(d.workouts, since);
  const weeks = p === '4s' ? 4 : p === '3m' ? 12 : p === 'ano' ? 26 : Math.min(52, Math.max(8, Math.ceil((Date.now() - (ws[0]?.startedAt || Date.now())) / (7 * 86400000)) + 1));
  const vol = weeklyVolume(d.workouts, weeks);
  const top = topExercises(inPeriod, 2);
  const last = d.reports[d.reports.length - 1];
  const peso = bodyDelta(d.reports, 'peso');
  const smm = bodyDelta(d.reports, 'smm');
  const bfp = bodyDelta(d.reports, 'bfp');
  const deltaTxt = (v: { delta: number | null; since: number | null }, unit: string) => (v.delta !== null && v.since ? `${signed(v.delta)}${unit} desde ${month(v.since)}` : 'Primer informe');
  const startRange = inPeriod[0]?.startedAt || since;
  return (
    <div className="screen with-nav">
      <TopBar
        right={
          <a className="txt m" href={href('/exportar')}>
            <IcDownload /> Exportar
          </a>
        }
      />
      <div className="pad">
        <span className="small mute">{inPeriod.length ? `${dateShort(startRange)} – ${dateShort(Date.now())}` : 'Sin entrenos en este periodo'}</span>
        <h1 className="h1" style={{ marginTop: 2 }}>Progreso</h1>
        <div style={{ marginTop: 6 }}>
          <Seg value={p} onChange={setP} label="Periodo" options={[['4s', '4 sem'], ['3m', '3 meses'], ['ano', 'Año'], ['todo', 'Todo']]} />
        </div>
      </div>
      <div className="main">
        <div className="sec" style={{ marginTop: 8, alignItems: 'center', paddingBottom: 0 }}>
          <span className="kicker">Entrenamiento</span>
          <a className="txt accent" href={href('/evolucion')} style={{ fontSize: 13, minHeight: 40 }}>
            <IcChart width={16} height={16} /> Ver evolución
          </a>
        </div>
        <div className="grid3" style={{ marginTop: 12 }}>
          <div className="stack">
            <span className="stat">{c.done}</span>
            <span className="xs mute">sesiones de {c.expected}</span>
          </div>
          <div className="stack">
            <span className="stat">{c.pct} %</span>
            <span className="xs mute">constancia</span>
          </div>
          <div className="stack">
            <span className="stat">{recs.length}</span>
            <span className="xs mute">récords</span>
          </div>
        </div>
        <div className="row-actions" style={{ marginTop: 16 }}>
          <span className="small mute">Volumen por semana</span>
          <span className="small b">
            {n(vol[vol.length - 1].volume / 1000)} t <span className="mute" style={{ fontWeight: 400 }}>esta semana</span>
          </span>
        </div>
        <div style={{ marginTop: 6 }}>
          <Bars values={vol.map((v) => v.volume)} labels={weekLabels(vol.map((v) => v.start))} aria={`Volumen semanal de las últimas ${weeks} semanas`} />
        </div>
        {top.map((id, i) => {
          const s = exerciseSeries(inPeriod, id);
          if (s.length < 1) return null;
          return (
            <div key={id} className="row" style={{ minHeight: 44, borderTop: i === 0 ? '1px solid var(--line)' : 0, marginTop: i === 0 ? 10 : 0 }}>
              <span className="m" style={{ fontSize: 15 }}>{ex(id)?.name}</span>
              <span style={{ fontSize: 15 }}>
                <span className="mute">{n(s[0].weight)} → </span>
                <span className="b">{n(s[s.length - 1].weight)} kg</span>
              </span>
            </div>
          );
        })}

        <Sec title="Cuerpo · Visbody" right={last ? dateLong(last.date) : 'Sin informes'} style={{ marginTop: 22 }} />
        {last ? (
          <div className="grid2">
            {[
              ['Peso', peso.last !== null ? `${n(peso.last)} kg` : '—', deltaTxt(peso, '')],
              ['Músculo esquelético', smm.last !== null ? `${n(smm.last)} kg` : '—', deltaTxt(smm, '')],
              ['Grasa corporal', bfp.last !== null ? `${n(bfp.last)} %` : '—', deltaTxt(bfp, '')],
              ['Puntuación', last.score !== null ? `${last.score}` : '—', last.postureScore !== null ? `Postura: ${last.postureScore}` : ''],
            ].map(([t, v, s2], i) => (
              <div key={t} className="stack" style={{ gap: 2, padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--line)' : 0 }}>
                <span className="xs mute">{t}</span>
                <span className="stat-s">
                  {v}
                  {t === 'Puntuación' && last.score !== null && <span className="small mute"> / 100</span>}
                </span>
                <span className="xs mute">{s2}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="small mute" style={{ padding: '12px 0' }}>Sube el PDF de tu Visbody para ver aquí tu composición corporal. Vale también con informes antiguos.</p>
        )}
      </div>
      <div className="bottom">
        <a className="btn2" href={href('/visbody')}>
          <IcUpload /> Subir informe Visbody
        </a>
      </div>
      <ClientNav active="progreso" />
    </div>
  );
}

export function Evolution() {
  const { store } = useApp();
  const me = useMe();
  const d = useClientData(me.id, me);
  const [p, setP] = useState<Period>('todo');
  const [all, setAll] = useState(false);
  if (!d.ready) return <Loading />;
  const since = periodStart(p);
  const ws = finished(d.workouts).filter((w) => w.startedAt >= since);
  const ids = topExercises(ws, all ? 20 : 3);
  const reports = d.reports.filter((r) => r.date >= since || p === 'todo');
  const trends = ids.map((id) => ({ id, s: exerciseSeries(ws, id) })).map((x) => ({ ...x, t: trend(x.s) }));
  const ups = trends.filter((x) => x.t?.kind === 'up');
  const flats = trends.filter((x) => x.t?.kind === 'flat');
  const bf = bodyDelta(reports, 'bfp');
  const pw = bodyDelta(reports, 'peso');
  const firstR = reports[0];
  const lastR = reports[reports.length - 1];
  const totalDelta = (k: string) => (firstR && lastR && firstR !== lastR && firstR.composition[k] && lastR.composition[k] ? lastR.composition[k].value - firstR.composition[k].value : null);
  const verdicts: { icon: React.ReactNode; t: string; s: string; action?: React.ReactNode }[] = [];
  if (ups.length) verdicts.push({ icon: <IcArrowUp />, t: ups.length >= trends.length - flats.length ? 'Fuerza: subida casi lineal' : 'Fuerza: sube en parte', s: `${ups.slice(0, 2).map((x) => ex(x.id)?.name).join(' y ')} ${ups.length > 1 ? 'suben' : 'sube'} de forma constante` });
  for (const f of flats.slice(0, 2))
    verdicts.push({
      icon: <IcArrowFlat />,
      t: `${ex(f.id)?.name} estancado`,
      s: `${n(f.t!.last)} kg desde el ${dateShort(f.t!.since!)}`,
      action: me.trainerId ? (
        <button
          type="button"
          className="txt accent"
          style={{ fontSize: 13 }}
          onClick={async () => {
            await addNote(store, me, `Estancado en ${ex(f.id)?.name} (${n(f.t!.last)} kg desde el ${dateShort(f.t!.since!)}).`, 'alert', { exerciseId: f.id });
            toast('Aviso enviado a tu entrenador');
          }}
        >
          Avisar al entrenador
        </button>
      ) : undefined,
    });
  const bfTot = totalDelta('bfp');
  if (bfTot !== null) verdicts.push({ icon: bfTot < 0 ? <IcArrowDown /> : bfTot > 0 ? <IcArrowUp /> : <IcArrowFlat />, t: bfTot < 0 ? 'Grasa bajando' : bfTot > 0 ? 'Grasa subiendo' : 'Grasa estable', s: `${n(firstR.composition.bfp.value)} → ${n(lastR.composition.bfp.value)} % desde ${month(firstR.date)}` });
  const pwTot = totalDelta('peso');
  const smmTot = totalDelta('smm');
  if (pwTot !== null) verdicts.push({ icon: pwTot > 0 ? <IcArrowUp /> : pwTot < 0 ? <IcArrowDown /> : <IcArrowFlat />, t: pwTot > 0 ? 'Peso sube despacio' : pwTot < 0 ? 'Peso baja' : 'Peso estable', s: `${signed(pwTot)} kg${smmTot !== null ? `, de ellos ${signed(smmTot)} kg de músculo` : ''}` });
  void bf;
  void pw;

  const bodyCharts: [string, string, string][] = [
    ['peso', 'Peso', 'kg'],
    ['bfp', 'Grasa corporal', '%'],
    ['smm', 'Músculo esquelético', 'kg'],
    ['grasaKg', 'Grasa en kg', 'kg'],
  ];

  return (
    <div className="screen with-nav">
      <TopBar back="/progreso" backLabel="Progreso" />
      <div className="pad">
        <h1 className="h1" style={{ marginTop: 2 }}>Evolución</h1>
        <div style={{ marginTop: 6 }}>
          <Seg value={p} onChange={setP} label="Periodo" options={[['3m', '3 meses'], ['ano', 'Año'], ['todo', 'Todo']]} />
        </div>
      </div>
      <div className="main">
        <Sec title="De un vistazo" style={{ marginTop: 10 }} />
        {verdicts.length === 0 && <p className="small mute" style={{ padding: '12px 0' }}>Necesito al menos tres sesiones de un ejercicio para decirte cómo va.</p>}
        {verdicts.map((v, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto', columnGap: 10, alignItems: 'center', minHeight: 60, borderBottom: '1px solid var(--line)' }}>
            {v.icon}
            <span className="stack" style={{ gap: 2 }}>
              <span className="m">{v.t}</span>
              <span className="small mute">{v.s}</span>
            </span>
            {v.action || <span />}
          </div>
        ))}

        <div className="sec" style={{ marginTop: 28 }}>
          <span className="kicker">Fuerza · mejor serie</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="18" height="6" aria-hidden="true">
                <path d="M1 3H17" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              tú
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="18" height="6" aria-hidden="true">
                <path d="M1 3H17" stroke="var(--mute)" strokeWidth="1.2" strokeDasharray="3 3" />
              </svg>
              ritmo lineal
            </span>
          </span>
        </div>
        {trends.length === 0 && <p className="small mute" style={{ padding: '12px 0' }}>Aún no hay entrenos en este periodo.</p>}
        {trends.map(({ id, s, t }) => {
          const x = ex(id)!;
          const mid = s[Math.floor(s.length / 2)];
          return (
            <figure key={id} style={{ margin: 0, padding: '14px 0 12px', borderBottom: '1px solid var(--line)' }}>
              <figcaption className="row-actions" style={{ alignItems: 'baseline' }}>
                <span className="m">{x.name}</span>
                <span className="small mute">
                  {s.length ? `${n(s[0].weight)} → ${n(s[s.length - 1].weight)} kg` : ''}
                </span>
              </figcaption>
              <div style={{ marginTop: 6 }}>
                <LineChart
                  points={s.map((v) => ({ x: v.at, y: v.weight }))}
                  linear
                  stallFrom={t?.kind === 'flat' ? t.since : undefined}
                  labels={s.length ? [month(s[0].at), month(mid.at), month(s[s.length - 1].at)] : undefined}
                  aria={`${x.name}: de ${n(s[0]?.weight)} a ${n(s[s.length - 1]?.weight)} kg`}
                />
              </div>
              <p className="small mute" style={{ marginTop: 4 }}>
                {!t
                  ? 'Pocas sesiones todavía.'
                  : t.kind === 'flat'
                    ? `Plano desde el ${dateShort(t.since!)}.`
                    : t.kind === 'down'
                      ? 'Ha bajado respecto al inicio.'
                      : `Lineal: unos ${signed(t.perWeek)} kg por semana.`}
              </p>
            </figure>
          );
        })}
        {!all && topExercises(ws, 20).length > 3 && (
          <button type="button" className="txt" onClick={() => setAll(true)}>
            Ver los {topExercises(ws, 20).length} ejercicios
          </button>
        )}

        <Sec title="Cuerpo · Visbody" right={`${reports.length} ${reports.length === 1 ? 'informe' : 'informes'}`} style={{ marginTop: 18 }} />
        {reports.length === 0 ? (
          <p className="small mute" style={{ padding: '12px 0' }}>
            Sin informes. <a href={href('/visbody')}>Sube uno</a>.
          </p>
        ) : (
          <div className="grid2">
            {bodyCharts.map(([k, t, u], i) => {
              const pts = reports.filter((r) => r.composition[k]).map((r) => ({ x: r.date, y: r.composition[k].value }));
              const tot = totalDelta(k);
              return (
                <figure key={k} style={{ margin: 0, padding: '12px 0 10px', borderBottom: i < 2 ? '1px solid var(--line)' : 0 }}>
                  <figcaption className="m small" style={{ fontSize: 14 }}>{t}</figcaption>
                  {pts.length ? (
                    <LineChart
                      points={pts}
                      width={160}
                      height={90}
                      labels={[month(pts[0].x), pts.length > 2 ? month(pts[Math.floor(pts.length / 2)].x) : '', month(pts[pts.length - 1].x)]}
                      aria={`${t}: ${pts.map((x2) => n(x2.y)).join(', ')}`}
                    />
                  ) : (
                    <p className="xs mute">Sin dato</p>
                  )}
                  <span className="xs mute">
                    {u}
                    {tot !== null ? ` · ${signed(tot)} desde ${month(firstR.date)}` : ''}
                  </span>
                </figure>
              );
            })}
          </div>
        )}
        <p className="xs mute" style={{ marginTop: 10 }}>Cada punto es una sesión o un informe.</p>
      </div>
      <ClientNav active="progreso" />
    </div>
  );
}
