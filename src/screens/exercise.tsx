import { useEffect, useRef, useState } from 'react';
import { GROUP_NAMES, equivalent, ex, increment } from '../data/catalog';
import { useApp, useMe } from '../lib/app';
import { getFile, putFile, shrinkImage } from '../lib/files';
import { useApprovedAlts, useMachinePrefs } from '../lib/hooks';
import { href } from '../lib/router';
import { loadLive } from '../lib/workout';
import { dateShort, n } from '../lib/util';
import { IcCamera, IcVideo } from '../ui/icons';
import { Sec, Stepper, TopBar, toast } from '../ui/kit';
import { Drawing } from '../ui/drawings';
import { plateSplit } from './client/workout';
import { RoleNav } from '../ui/rolenav';

function backTarget(meId: string) {
  return loadLive(meId) ? '/entreno' : '/rutinas';
}

export function ExerciseSheet({ id }: { id: string }) {
  const { settings } = useApp();
  const me = useMe();
  const x = ex(id);
  const [prefs, setPrefs] = useMachinePrefs();
  const approved = useApprovedAlts();
  const live = loadLive(me.id);
  const entry = live?.workout.entries.find((e) => e.exerciseId === id);
  const curW = entry?.sets.find((s) => !s.done)?.weight ?? entry?.target.weight ?? x?.ref ?? 0;
  const [target, setTarget] = useState<number>(curW || 0);
  const [editing, setEditing] = useState(false);
  const ms = prefs.settings[id] || {};
  const [form, setForm] = useState(ms);
  useEffect(() => setForm(prefs.settings[id] || {}), [prefs.settings, id]);
  if (!x)
    return (
      <div className="screen with-nav">
        <TopBar back={backTarget(me.id)} />
        <div className="main">
          <p className="lead" style={{ marginTop: 20 }}>Este ejercicio no está en el catálogo.</p>
        </div>
        <RoleNav client="hoy" trainer="ejercicios" />
      </div>
    );
  const inc = { machine: settings.incMachine, dumbbell: settings.incDumbbell };
  const base = ms.base ?? (x.load === 'barbell' ? 20 : 0);
  const split = (x.load === 'plates' || x.load === 'barbell') && target ? plateSplit(target, base) : null;
  const alts = (me.role === 'client' ? approved(x.id, x.alts) : x.alts).map((a) => ex(a)).filter(Boolean);
  const video = `https://www.youtube.com/results?search_query=${encodeURIComponent(x.name + ' técnica')}`;
  const save = () => {
    setPrefs({ ...prefs, settings: { ...prefs.settings, [id]: form } });
    setEditing(false);
    toast('Ajustes guardados');
  };
  const back = backTarget(me.id);
  return (
    <div className="screen with-nav">
      <TopBar back={back} backLabel={back === '/entreno' ? 'Sesión' : 'Rutinas'} />
      <div className="pad">
        <h1 className="h-ex" style={{ marginTop: 2 }}>{x.name}</h1>
        <p className="small mute" style={{ marginTop: 4 }}>
          {x.muscles} · {x.equipment.toLowerCase()} · {GROUP_NAMES[x.group]}
        </p>
      </div>
      <div className="main" style={{ paddingTop: 14 }}>
        <a href={video} target="_blank" rel="noopener noreferrer" style={{ width: '100%', aspectRatio: '16 / 9', border: '1px solid var(--line)', background: 'var(--band)', color: 'var(--mute)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: '60%', color: 'var(--ink)' }}>
            <Drawing kind={x.kind} height={90} />
          </div>
          <span className="xs" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IcVideo width={16} height={16} /> Ver vídeos de la técnica (YouTube)
          </span>
        </a>
        <Sec title="Cómo se hace" />
        <ol style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
          {x.steps.map((t, i) => (
            <li key={i} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', padding: '6px 0', fontSize: 15 }}>
              <span className="b accent-t">{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>

        <Sec
          title="Tus ajustes"
          right={
            <button type="button" className="txt accent" style={{ fontSize: 13, minHeight: 32 }} onClick={() => (editing ? save() : setEditing(true))}>
              {editing ? 'Guardar' : 'Editar'}
            </button>
          }
        />
        {editing ? (
          <div className="grid2">
            {(
              [
                ['asiento', 'Asiento'],
                ['tope', 'Tope'],
                ['pies', 'Pies'],
              ] as const
            ).map(([k, t]) => (
              <div key={k} className="field" style={{ marginTop: 8 }}>
                <label htmlFor={`f-${k}`}>{t}</label>
                <input id={`f-${k}`} className="input" style={{ fontSize: 17, height: 40 }} value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
            {(x.load === 'plates' || x.load === 'barbell') && (
              <div className="field" style={{ marginTop: 8 }}>
                <label htmlFor="f-base">{x.load === 'barbell' ? 'Barra (kg)' : 'Carro vacío (kg)'}</label>
                <input id="f-base" className="input" inputMode="decimal" style={{ fontSize: 17, height: 40 }} value={form.base ?? ''} onChange={(e) => setForm({ ...form, base: e.target.value === '' ? undefined : parseFloat(e.target.value.replace(',', '.')) })} />
              </div>
            )}
          </div>
        ) : (
          <div className="grid3" style={{ marginTop: 10 }}>
            {[
              ['Asiento', ms.asiento],
              ['Tope', ms.tope],
              ['Pies', ms.pies],
            ].map(([t, v]) => (
              <div key={t} className="stack" style={{ gap: 2 }}>
                <span className="xs mute">{t}</span>
                <span style={{ fontSize: 20, fontWeight: 500 }}>{v || '—'}</span>
              </div>
            ))}
          </div>
        )}

        {(x.load === 'plates' || x.load === 'barbell') && (
          <>
            <Sec title="Discos" right={`${x.load === 'barbell' ? 'Barra' : 'Carro'} ${n(base)} kg`} />
            <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', columnGap: 20, alignItems: 'center', marginTop: 10 }}>
              <Stepper value={target} onChange={setTarget} step={increment(x, inc) || 2.5} label="peso total" big />
              {split ? (
                <svg width="100%" height="64" viewBox="0 0 150 64" role="img" aria-label={`Por lado: ${split.map((s) => n(s, 2)).join(', ')} kg`}>
                  <path d="M0 26H150" stroke="var(--mute)" strokeWidth="3" />
                  <rect x="4" y="16" width="6" height="20" fill="var(--mute)" />
                  {(() => {
                    let xx = 14;
                    return split.slice(0, 7).map((p, i) => {
                      const h = 14 + p * 1.6;
                      const w = Math.max(5, p / 2 + 4);
                      const el = (
                        <g key={i}>
                          <rect x={xx} y={26 - h / 2} width={w} height={h} fill="var(--ink)" />
                          <text x={xx + w / 2} y={62} textAnchor="middle" fontSize="10" fill="var(--ink)">
                            {n(p, 2)}
                          </text>
                        </g>
                      );
                      xx += w + 4;
                      return el;
                    });
                  })()}
                  <text x="150" y="12" textAnchor="end" fontSize="11" fill="var(--mute)">
                    por lado
                  </text>
                </svg>
              ) : (
                <span className="small mute">{target < base ? 'Menos que el carro vacío' : 'No sale exacto con discos normales'}</span>
              )}
            </div>
          </>
        )}

        {alts.length > 0 && (
          <>
            <Sec title={me.role === 'client' && me.trainerId ? 'Alternativas aprobadas' : 'Alternativas'} right={me.role === 'client' && me.trainerId ? 'por tu entrenador' : undefined} />
            {alts.map((a) => {
              const eq = equivalent(x, a!, curW || x.ref, inc);
              return (
                <a key={a!.id} className="row" href={href(`/ejercicio/${a!.id}`)} style={{ minHeight: 50 }}>
                  <span className="col">
                    <span className="m" style={{ fontSize: 15 }}>{a!.name}</span>
                    <span className="xs mute">{a!.equipment}</span>
                  </span>
                  <span className="small">{a!.load === 'bodyweight' ? 'Peso corporal' : `${a!.load === 'dumbbell' ? '2 × ' : ''}${n(eq)} kg`}</span>
                </a>
              );
            })}
          </>
        )}
      </div>
      <div className="bottom" style={{ flexDirection: 'row', gap: 12 }}>
        <a className="btn2" style={{ width: 'auto', height: 60, flex: 'none' }} href={href(`/maquina/${x.id}`)}>
          Qué máquina es
        </a>
        <a className="btn" href={href(back)}>
          {back === '/entreno' ? 'Volver a la serie' : 'Volver'}
        </a>
      </div>
      <RoleNav client="hoy" trainer="ejercicios" />
    </div>
  );
}

export function MachineScreen({ id }: { id: string }) {
  const me = useMe();
  const x = ex(id);
  const [prefs, setPrefs] = useMachinePrefs();
  const [photo, setPhoto] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let url: string | null = null;
    void getFile(`photo/${id}`).then((b) => {
      if (b) {
        url = URL.createObjectURL(b);
        setPhoto(url);
      }
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  useEffect(() => setNote(prefs.notes[id] || ''), [prefs.notes, id]);
  if (!x) return null;
  const back = backTarget(me.id);
  const savedNote = prefs.notes[id];
  const noteAt = prefs.notes[`${id}__at`];
  return (
    <div className="screen with-nav">
      <TopBar back={back} backLabel={back === '/entreno' ? 'Sesión' : 'Rutinas'} />
      <div className="main">
        <span className="kicker accent" style={{ marginTop: 4 }}>Busca esta máquina</span>
        <h1 className="h1" style={{ marginTop: 6, fontSize: 30, lineHeight: 1.1 }}>{x.equipment}</h1>
        <p className="small mute" style={{ marginTop: 6, fontSize: 14 }}>
          Para: {x.name}. También se llama: {x.aliases.slice(0, 3).join(', ')}
        </p>
        <div style={{ marginTop: 10 }}>
          <Drawing kind={x.kind} height={150} marks={Boolean(x.look)} label={`Dibujo genérico: ${x.equipment}`} />
        </div>
        {x.look && (
          <>
            <hr className="rule" style={{ margin: '10px 0' }} />
            <span className="kicker">Cómo reconocerla</span>
            {x.look.map((t, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr)', alignItems: 'center', minHeight: 36, borderBottom: i < 2 ? '1px solid var(--line)' : 0, fontSize: 15 }}>
                <span className="small b accent-t">{i + 1}</span>
                {t}
              </div>
            ))}
          </>
        )}
        <div className="row-actions" style={{ marginTop: 18, color: 'var(--mute)' }}>
          <span className="kicker">En tu centro</span>
          <span className="xs">Solo lo ves tú</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '112px minmax(0,1fr)', columnGap: 16, marginTop: 10 }}>
          <button type="button" className="box-photo" aria-label={photo ? 'Cambiar la foto de la máquina' : 'Hacer una foto de la máquina'} onClick={() => fileRef.current?.click()}>
            {photo ? (
              <img src={photo} alt="Tu foto de la máquina" />
            ) : (
              <>
                <IcCamera />
                <span className="xs" style={{ textAlign: 'center', lineHeight: 1.3 }}>Hacer foto</span>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const b = await shrinkImage(f);
              await putFile(`photo/${id}`, b);
              setPhoto(URL.createObjectURL(b));
            }}
          />
          <div className="stack" style={{ gap: 4, minWidth: 0 }}>
            {editing ? (
              <>
                <label className="sr" htmlFor="mnote">Dónde está</label>
                <textarea id="mnote" className="notes" style={{ fontFamily: 'inherit', minHeight: 70, fontSize: 15 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Junto a la cristalera, la segunda desde la puerta" autoFocus />
                <button
                  type="button"
                  className="txt accent"
                  onClick={() => {
                    setPrefs({ ...prefs, notes: { ...prefs.notes, [id]: note.trim(), [`${id}__at`]: String(Date.now()) } });
                    setEditing(false);
                  }}
                >
                  Guardar nota
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3 }}>{savedNote || 'Añade dónde está para encontrarla a la primera'}</span>
                {savedNote && noteAt && <span className="small mute">Tu nota · {dateShort(+noteAt)}</span>}
                <button type="button" className="txt accent" style={{ fontSize: 14, minHeight: 32 }} onClick={() => setEditing(true)}>
                  {savedNote ? 'Editar nota' : 'Añadir nota'}
                </button>
              </>
            )}
          </div>
        </div>
        <p className="small mute" style={{ marginTop: 10 }}>La primera vez que la encuentres, haz una foto: la próxima la reconocerás de un vistazo. La foto se queda en este móvil.</p>
      </div>
      <div className="bottom">
        <a className="btn xl" href={href(back)}>
          Ya la tengo
        </a>
        {back === '/entreno' && (
          <a className="txt u" style={{ alignSelf: 'center' }} href={href('/entreno?ocupada=1')}>
            ¿No está o está ocupada? Ver alternativas
          </a>
        )}
      </div>
      <RoleNav client="hoy" trainer="ejercicios" />
    </div>
  );
}
