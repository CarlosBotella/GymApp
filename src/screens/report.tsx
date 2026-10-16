import { useEffect, useState } from 'react';
import { ex } from '../data/catalog';
import { useDoc, useMe } from '../lib/app';
import { bodyRows, exportCsv, exportXlsx, workoutRows } from '../lib/exporter';
import { useClientData } from '../lib/hooks';
import { href, useRoute } from '../lib/router';
import { bestSet, constancy, exerciseSeries, feelShare, finished, periodStart, records, topExercises, weeklyVolume, workoutVolume } from '../lib/stats';
import type { Profile } from '../lib/types';
import { dateLong, dateShort, month, n, signed } from '../lib/util';
import { POSTURE_LABELS } from '../lib/visbody';
import { Bars, LineChart } from '../ui/charts';
import { IcDownload } from '../ui/icons';
import { Loading, Seg, toast } from '../ui/kit';
import { weekLabels } from './client/progress';

type P = '4s' | '3m' | 'ano' | 'todo';

export function Report({ clientId }: { clientId: string }) {
  const me = useMe();
  const r = useRoute();
  const client = useDoc<Profile>('users', clientId);
  const d = useClientData(clientId, me);
  const [p, setP] = useState<P>((r.params.get('periodo') as P) || '3m');
  const printing = r.params.get('imprimir') === '1';
  useEffect(() => {
    if (printing && d.ready && client) setTimeout(() => window.print(), 600);
  }, [printing, d.ready, client]);
  if (!d.ready || client === undefined) return <Loading />;
  if (!client) return <Loading label="No tienes acceso a este informe" />;
  const trainer = me.role === 'trainer';
  const since = periodStart(p);
  const ws = finished(d.workouts).filter((w) => w.startedAt >= since);
  const c = constancy(d.workouts, since, client.days || d.main?.days.length || 3);
  const recs = records(d.workouts, since);
  const weeks = p === '4s' ? 4 : p === '3m' ? 13 : p === 'ano' ? 26 : 40;
  const vol = weeklyVolume(d.workouts, weeks);
  const volTotal = ws.reduce((a, w) => a + workoutVolume(w), 0);
  const firstVol = vol.find((v) => v.volume > 0)?.volume || 0;
  // la semana en curso aún no ha terminado: se compara con la última completa
  const lastVol = (vol.length > 1 ? vol[vol.length - 2].volume : vol[vol.length - 1]?.volume) || 0;
  const top = topExercises(ws, 6);
  const reports = d.reports;
  const last = reports[reports.length - 1];
  const feel = feelShare(ws);
  const lastRec = recs[recs.length - 1];
  const missedDow = (() => {
    const exp = c.expected - c.done;
    return exp > 0 ? `${exp} ${exp === 1 ? 'perdida' : 'perdidas'}` : 'ninguna perdida';
  })();
  const name = `gymapp-${client.name.toLowerCase().replace(/\s+/g, '-')}`;
  const sheets = () => [
    { name: 'Entrenamientos', rows: workoutRows(ws) },
    { name: 'Cuerpo', rows: bodyRows(reports) },
  ];
  const posture = last ? Object.entries(last.posture).slice(0, 5) : [];

  return (
    <div style={{ minHeight: '100vh' }}>
      <header className="no-print" style={{ borderBottom: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 40px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0 32px', minHeight: 64 }}>
          <nav aria-label="Secciones" style={{ display: 'flex', flexWrap: 'wrap', gap: 28, fontSize: 15 }}>
            {trainer ? (
              <>
                <a className="txt" href={href('/clientes')}>Clientes</a>
                <a className="txt mute" href={href('/biblioteca')}>Rutinas</a>
                <a className="txt mute" href={href('/ejercicios')}>Ejercicios</a>
              </>
            ) : (
              <>
                <a className="txt" href={href('/progreso')}>Progreso</a>
                <a className="txt mute" href={href('/hoy')}>Hoy</a>
              </>
            )}
          </nav>
          <a className="txt mute" style={{ fontSize: 14 }} href={href(trainer ? `/cliente/${clientId}` : '/progreso')}>
            Volver
          </a>
        </div>
      </header>
      <main className="wide">
        <span className="small mute">{trainer ? `Clientes / ${client.name}` : 'Tu informe'}</span>
        <h1 style={{ margin: '8px 0 0', fontSize: 'clamp(36px, 6vw, 56px)', lineHeight: 1, fontWeight: 500, letterSpacing: '-0.04em' }}>Informe de {client.name}</h1>
        <p className="mute" style={{ marginTop: 10 }}>
          {d.main ? `${d.main.name} · semana ${d.main.week}` : 'Sin rutina asignada'} · {dateShort(Math.max(since, ws[0]?.startedAt || since))} – {dateLong(Date.now())}
        </p>

        <div className="no-print" style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px 32px', padding: '8px 0', borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--line)' }}>
          <Seg value={p} onChange={setP} label="Periodo" options={[['4s', '4 semanas'], ['3m', '3 meses'], ['ano', 'Año'], ['todo', 'Todo']]} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button type="button" className="btn sm" style={{ height: 44 }} onClick={() => window.print()}>
              <IcDownload /> Informe PDF
            </button>
            <button type="button" className="btn2 sm" onClick={() => exportXlsx(name, sheets())}>Excel</button>
            <button type="button" className="btn2 sm" onClick={() => exportCsv(name, sheets())}>CSV</button>
            <button
              type="button"
              className="btn2 sm"
              style={{ borderColor: 'var(--line)' }}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(location.href.replace(/[?&]imprimir=1/, ''));
                  toast('Enlace copiado (solo lo abre quien tenga acceso)');
                } catch {
                  toast('No se pudo copiar');
                }
              }}
            >
              Copiar enlace
            </button>
          </div>
        </div>

        <div className="kpis" style={{ marginTop: 8 }}>
          <div>
            <span className="small mute">Sesiones</span>
            <span className="v">
              {c.done}
              <span className="mute" style={{ fontSize: 18 }}> / {c.expected}</span>
            </span>
            <span className="small mute">{missedDow}</span>
          </div>
          <div>
            <span className="small mute">Constancia</span>
            <span className="v">{c.pct} %</span>
            <span className="small mute">en el periodo</span>
          </div>
          <div>
            <span className="small mute">Volumen total</span>
            <span className="v">{n(volTotal / 1000, 0)} t</span>
            <span className="small mute">{firstVol && lastVol ? `${signed(((lastVol - firstVol) / firstVol) * 100, 0)} % 1.ª → última semana completa` : '—'}</span>
          </div>
          <div>
            <span className="small mute">Récords</span>
            <span className="v">{recs.length}</span>
            <span className="small mute">{lastRec ? `Último: ${ex(lastRec.exerciseId)?.name.toLowerCase()} ${n(lastRec.weight)} kg` : 'Ninguno aún'}</span>
          </div>
          <div>
            <span className="small mute">Peso · Visbody</span>
            <span className="v">
              {last?.composition.peso ? n(last.composition.peso.value) : '—'}
              <span className="mute" style={{ fontSize: 18 }}> kg</span>
            </span>
            <span className="small mute">{last ? dateLong(last.date) : 'Sin informes'}</span>
          </div>
          <div>
            <span className="small mute">Grasa · Visbody</span>
            <span className="v">{last?.composition.bfp ? `${n(last.composition.bfp.value)} %` : '—'}</span>
            <span className="small mute">{last?.composition.bfp?.min !== undefined ? `Rango ${n(last.composition.bfp.min)}–${n(last.composition.bfp.max)} %` : ''}</span>
          </div>
        </div>

        <div className="wide-grid">
          <section aria-labelledby="h-vol">
            <div className="sec" style={{ marginTop: 0 }}>
              <h2 id="h-vol" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Volumen por semana</h2>
              <span>toneladas levantadas</span>
            </div>
            <div style={{ marginTop: 16 }}>
              <Bars values={vol.map((v) => v.volume)} labels={weekLabels(vol.map((v) => v.start))} aria={`Volumen semanal de ${client.name}`} axis />
            </div>
          </section>

          <section aria-labelledby="h-f">
            <div className="sec" style={{ marginTop: 0 }}>
              <h2 id="h-f" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Fuerza</h2>
              <span>mejor serie del periodo</span>
            </div>
            <table className="t" style={{ marginTop: 4 }}>
              <thead>
                <tr>
                  <th scope="col">Ejercicio</th>
                  <th scope="col">{ws[0] ? dateShort(ws[0].startedAt) : 'Inicio'}</th>
                  <th scope="col">Ahora</th>
                  <th scope="col">Cambio</th>
                </tr>
              </thead>
              <tbody>
                {top.map((id) => {
                  const s = exerciseSeries(ws, id);
                  if (!s.length) return null;
                  const a = s[0].weight;
                  const b = s[s.length - 1].weight;
                  return (
                    <tr key={id}>
                      <th scope="row" style={{ fontWeight: 500 }}>{ex(id)?.name}</th>
                      <td className="mute">{n(a)} kg</td>
                      <td className="b">{n(b)} kg</td>
                      <td>{a ? `${signed(((b - a) / a) * 100, 0)} %` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {top.length === 0 && <p className="small mute" style={{ marginTop: 10 }}>Sin entrenos en este periodo.</p>}
          </section>

          <section aria-labelledby="h-c">
            <div className="sec" style={{ marginTop: 0 }}>
              <h2 id="h-c" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Cuerpo · Visbody</h2>
              <span>{reports.length ? `${reports.length} ${reports.length === 1 ? 'informe' : 'informes'} · último ${dateLong(last.date)}` : trainer && client.shareBody === false ? 'No los comparte contigo' : 'Sin informes'}</span>
            </div>
            {reports.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 20, marginTop: 16 }}>
                {(
                  [
                    ['peso', 'Peso · kg'],
                    ['smm', 'Músculo esquelético · kg'],
                    ['bfp', 'Grasa corporal · %'],
                  ] as const
                ).map(([k, t]) => {
                  const pts = reports.filter((x) => x.composition[k]).map((x) => ({ x: x.date, y: x.composition[k].value }));
                  return (
                    <figure key={k} style={{ margin: 0 }}>
                      <figcaption className="small mute">{t}</figcaption>
                      <LineChart points={pts} width={220} height={100} labels={pts.length ? [month(pts[0].x), pts.length > 2 ? month(pts[Math.floor(pts.length / 2)].x) : '', month(pts[pts.length - 1].x)] : undefined} aria={`${t}: ${pts.map((x) => n(x.y)).join(', ')}`} />
                    </figure>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="h-p">
            <div className="sec" style={{ marginTop: 0 }}>
              <h2 id="h-p" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Postura y sensaciones</h2>
              <span>{last?.postureScore !== null && last?.postureScore !== undefined ? `postura: ${last.postureScore} / 100` : ''}</span>
            </div>
            {posture.length > 0 ? (
              <dl style={{ margin: '4px 0 0' }}>
                {posture.map(([k, v]) => (
                  <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', columnGap: 16, padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 15 }}>
                    <dt className="m">{POSTURE_LABELS[k] || k}</dt>
                    <dd style={{ margin: 0 }}>
                      {n(v.value)} {v.unit}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="small mute" style={{ marginTop: 10 }}>Sin datos de postura.</p>
            )}
            {trainer && d.mine[0] && posture.length > 0 && (
              <a className="txt accent no-print" href={href(`/sugerir/${d.mine[0].id}`)} style={{ fontSize: 14 }}>
                Sugerir ejercicios según la postura
              </a>
            )}
            {feel.total > 0 && (
              <div style={{ marginTop: 20 }}>
                <span className="small mute">Cómo le fueron las series · {feel.total} valoradas</span>
                <div role="img" aria-label={`Fácil ${Math.round((feel.easy / feel.total) * 100)} %, Justo ${Math.round((feel.ok / feel.total) * 100)} %, Duro ${Math.round((feel.hard / feel.total) * 100)} %`} style={{ display: 'flex', gap: 2, height: 14, marginTop: 8 }}>
                  <div style={{ flex: `${feel.easy} 1 0`, background: 'var(--accent-soft)', borderRadius: '4px 0 0 4px' }} />
                  <div style={{ flex: `${feel.ok} 1 0`, background: 'var(--accent)', opacity: 0.65 }} />
                  <div style={{ flex: `${feel.hard} 1 0`, background: 'var(--accent)', borderRadius: '0 4px 4px 0' }} />
                </div>
                <div style={{ display: 'flex', gap: 2, marginTop: 6, fontSize: 13 }}>
                  <span style={{ flex: `${Math.max(feel.easy, 1)} 1 0` }}>Fácil {Math.round((feel.easy / feel.total) * 100)} %</span>
                  <span style={{ flex: `${Math.max(feel.ok, 1)} 1 0` }}>Justo {Math.round((feel.ok / feel.total) * 100)} %</span>
                  <span style={{ flex: `${Math.max(feel.hard, 1)} 1 0`, textAlign: 'right' }}>Duro {Math.round((feel.hard / feel.total) * 100)} %</span>
                </div>
              </div>
            )}
          </section>
        </div>

        {ws.length > 0 && (
          <section style={{ marginTop: 48 }} aria-labelledby="h-s">
            <div className="sec" style={{ marginTop: 0 }}>
              <h2 id="h-s" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Últimas sesiones</h2>
              <span>{ws.length}</span>
            </div>
            <table className="t">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Día</th>
                  <th scope="col">Series</th>
                  <th scope="col">Volumen</th>
                  <th scope="col">Mejor serie</th>
                </tr>
              </thead>
              <tbody>
                {ws
                  .slice(-8)
                  .reverse()
                  .map((w) => {
                    const best = w.entries.map((e) => ({ e, b: bestSet(e) })).filter((x) => x.b && x.b.weight).sort((a, b) => b.b!.weight - a.b!.weight)[0];
                    return (
                      <tr key={w.id}>
                        <td>{dateShort(w.startedAt)}</td>
                        <td>{w.dayName}</td>
                        <td>{w.entries.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0)}</td>
                        <td>{n(workoutVolume(w) / 1000)} t</td>
                        <td>{best ? `${best.e.name} ${n(best.b!.weight)} × ${best.b!.reps}` : '—'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </section>
        )}

        <p style={{ marginTop: 48, paddingTop: 14, borderTop: '1px solid var(--line)' }} className="small mute">
          {trainer ? `${client.name} ve este mismo informe desde su móvil u ordenador, sin las acciones de entrenador.` : 'Tu entrenador ve este mismo informe.'} Generado el {dateLong(Date.now())}.
        </p>
      </main>
    </div>
  );
}
