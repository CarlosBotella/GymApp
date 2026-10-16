import { useMemo, useState } from 'react';
import { DAY_GROUP_NAMES } from '../../data/catalog';
import { BASES, routineFromBase } from '../../data/templates';
import { useApp, useDoc, useMe } from '../../lib/app';
import { assignRoutine } from '../../lib/api';
import { go, href } from '../../lib/router';
import { learnWeek } from '../../lib/stats';
import type { Profile, Routine } from '../../lib/types';
import { DOW_SHORT } from '../../lib/util';
import { IcSearch } from '../../ui/icons';
import { Loading, Seg, TopBar, TrainerNav, toast } from '../../ui/kit';
import { useTrainerData } from './data';

/** Coloca los días de la rutina en los días de la semana en que suele entrenar el cliente */
function placeDays(r: Routine, learned: ReturnType<typeof learnWeek>, perWeek: number): (string | null)[] {
  const out: (string | null)[] = Array(7).fill(null);
  const used = new Set<number>();
  if (learned.ready) {
    for (const d of r.days) {
      const i = learned.days.findIndex((x, k) => x.group === d.group && !used.has(k));
      if (i >= 0) {
        out[i] = DAY_GROUP_NAMES[d.group].split(' ')[0];
        used.add(i);
      }
    }
    learned.days.forEach((x, k) => {
      if (x.group && out[k] === null && !r.days.some((d) => d.group === x.group)) out[k] = 'Suya';
    });
  }
  const free = [0, 2, 4, 1, 3, 5, 6];
  let di = 0;
  const target = Math.max(perWeek, r.days.length);
  for (const k of free) {
    if (out.filter((v) => v && v !== 'Suya').length >= target) break;
    if (out[k] === null && !used.has(k)) {
      const d = r.days[di % r.days.length];
      out[k] = DAY_GROUP_NAMES[d.group].split(' ')[0];
      di++;
    }
  }
  return out;
}

export function Library({ forClient }: { forClient: string | null }) {
  const { store } = useApp();
  const me = useMe();
  const td = useTrainerData();
  const client = useDoc<Profile>('users', forClient);
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<'fit' | '3' | '4' | 'all'>(forClient ? 'fit' : 'all');
  const [q, setQ] = useState('');
  const ws = useMemo(() => td.workouts.filter((w) => w.clientId === forClient), [td.workouts, forClient]);
  const learned = useMemo(() => learnWeek(ws), [ws]);
  if (!td.ready || client === undefined) return <Loading />;
  const perWeek = client?.days || 3;
  const prevCycle = forClient ? td.routines.filter((r) => r.clientId === forClient && r.ownerId === me.id && !r.template) : [];
  let list = [...td.templates];
  if (q) list = list.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  if (filter === 'fit') list = list.filter((r) => r.days.length <= perWeek);
  if (filter === '3') list = list.filter((r) => r.days.length <= 3);
  if (filter === '4') list = list.filter((r) => r.days.length >= 2 && r.days.length <= 4);
  const options = forClient ? [...prevCycle.map((r) => ({ ...r, name: `Ciclo anterior de ${client?.name}`, _prev: true })), ...list] : list;
  const chosen = options.find((r) => r.id === sel) || (forClient ? options[0] : undefined);

  if (td.templates.length === 0 && !prevCycle.length) {
    return (
      <div className="screen with-nav">
        <TopBar back={forClient ? `/cliente/${forClient}` : '/clientes'} backLabel={client?.name || 'Clientes'} />
        <div className="main">
          <h1 className="h1" style={{ marginTop: 2, fontSize: 32 }}>{forClient ? 'Elegir rutina' : 'Rutinas'}</h1>
          <div style={{ marginTop: 40, borderTop: '1px solid var(--ink)', paddingTop: 20 }}>
            <span className="kicker">Tu biblioteca · 0</span>
            <p style={{ marginTop: 12, fontSize: 28, lineHeight: 1.15, fontWeight: 500, letterSpacing: '-0.02em' }}>Todavía no tienes rutinas.</p>
            <p className="lead" style={{ marginTop: 10, fontSize: 15 }}>Escribe la primera como en tus notas. Se guardará aquí y la próxima vez solo tendrás que elegirla.</p>
            <a className="btn" style={{ marginTop: 18, height: 56 }} href={href(`/escribir${forClient ? `?para=${forClient}` : ''}`)}>
              Escribir la primera
            </a>
          </div>
          <div className="sec" style={{ marginTop: 36 }}>
            <span className="kicker">O empieza con una base</span>
            <span>editables</span>
          </div>
          {BASES.map((b) => (
            <button
              key={b.key}
              type="button"
              className="row"
              style={{ minHeight: 60 }}
              onClick={async () => {
                const r = routineFromBase(b, me.id);
                await store.set('routines', r.id, r);
                toast(`«${b.name}» copiada a tu biblioteca`);
              }}
            >
              <span className="col">
                <span className="t">{b.name}</span>
                <span className="s">
                  {b.daysLabel} · {b.build().reduce((a, d) => a + d.exercises.length, 0)} ejercicios
                </span>
              </span>
              <span className="small b accent-t">Usar</span>
            </button>
          ))}
          <p className="xs mute" style={{ marginTop: 12 }}>Al usar una base se copia a tu biblioteca: cámbiala a tu manera y será tuya.</p>
        </div>
        <TrainerNav active="rutinas" />
      </div>
    );
  }

  return (
    <div className="screen with-nav">
      <TopBar back={forClient ? `/cliente/${forClient}` : '/clientes'} backLabel={client?.name || 'Clientes'} right={forClient ? <span className="small mute">Entrena {perWeek} días</span> : undefined} />
      <div className="pad">
        <h1 className="h1" style={{ marginTop: 2, fontSize: 32 }}>{forClient ? 'Elegir rutina' : 'Rutinas'}</h1>
      </div>
      <div className="main" style={{ paddingTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--ink)', color: 'var(--mute)' }}>
          <IcSearch />
          <label htmlFor="bq" className="sr">Buscar rutina</label>
          <input id="bq" type="search" placeholder="Buscar en tu biblioteca" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 auto', minWidth: 0, height: 44, border: 0, background: 'transparent', fontSize: 16, outline: 'none' }} />
        </div>
        <div style={{ marginTop: 4 }}>
          <Seg value={filter} onChange={setFilter} label="Filtrar" options={forClient ? [['fit', 'Encajan'], ['3', '3 días'], ['4', '4 días'], ['all', 'Todas']] : [['all', 'Todas'], ['3', '3 días'], ['4', '4 días']]} />
        </div>
        <div className="sec" style={{ marginTop: 10, borderBottomColor: 'var(--line)' }}>
          <span className="kicker">Tu biblioteca · {td.templates.length}</span>
          <span>Más usadas primero</span>
        </div>
        <div role={forClient ? 'radiogroup' : undefined} aria-label="Rutina">
          {options.map((r) => {
            const on = forClient && chosen?.id === r.id;
            const placed = on ? placeDays(r, learned, perWeek) : null;
            const isPrev = (r as Routine & { _prev?: boolean })._prev;
            return (
              <button
                key={r.id}
                type="button"
                role={forClient ? 'radio' : undefined}
                aria-checked={forClient ? Boolean(on) : undefined}
                onClick={() => (forClient ? setSel(r.id) : go(`/escribir?rutina=${r.id}`))}
                style={{ background: 'none', border: 0, borderTop: on ? '2px solid var(--accent)' : '1px solid var(--line)', marginTop: on ? 12 : 0, padding: '12px 0', width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}
              >
                <span className="row-actions" style={{ alignItems: 'baseline' }}>
                  <span style={{ fontSize: 17, fontWeight: on ? 600 : 500 }}>{r.name}</span>
                  {on && <span className="xs b accent-t">Elegida</span>}
                </span>
                <span className="small mute">
                  {isPrev ? `Semana ${r.week} · copiar y seguir progresando` : `${r.days.length} ${r.days.length === 1 ? 'día' : 'días'} · ${r.days.reduce((a, d) => a + d.exercises.length, 0)} ejercicios · usada con ${r.uses || 0} ${r.uses === 1 ? 'cliente' : 'clientes'}`}
                </span>
                {placed && (
                  <>
                    <span className="week" style={{ marginTop: 10 }}>
                      {placed.map((g, i) => (
                        <span key={i} className={g && g !== 'Suya' ? 'on' : ''} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6, borderBottom: `2px solid ${g && g !== 'Suya' ? 'var(--accent)' : 'var(--line)'}` }}>
                          <span className="xs mute">{DOW_SHORT[i]}</span>
                          <span className="xs" style={{ fontWeight: g && g !== 'Suya' ? 500 : 400, color: g && g !== 'Suya' ? undefined : 'var(--mute)' }}>{g || '—'}</span>
                        </span>
                      ))}
                    </span>
                    <span className="xs mute" style={{ marginTop: 6 }}>{learned.ready ? `Días colocados según cuándo entrena ${client?.name}` : 'Días propuestos; se ajustarán cuando la app aprenda sus hábitos'}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        <p className="small mute" style={{ marginTop: 12 }}>Cada rutina que escribes o asignas se guarda aquí, y la próxima vez solo tienes que elegirla.</p>
      </div>
      <div className="bottom">
        {forClient && chosen ? (
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const isPrev = (chosen as Routine & { _prev?: boolean })._prev;
              if (isPrev) {
                await store.update('routines', chosen.id, { week: chosen.week + 1, updatedAt: Date.now() });
              } else await assignRoutine(store, me, chosen, forClient);
              toast(`Rutina asignada a ${client?.name}`);
              go(`/cliente/${forClient}`, true);
            }}
          >
            Asignar a {client?.name}
          </button>
        ) : null}
        <a className={forClient ? 'txt u' : 'btn'} style={forClient ? { alignSelf: 'center' } : undefined} href={href(`/escribir${forClient ? `?para=${forClient}` : ''}`)}>
          Escribir una nueva
        </a>
      </div>
      <TrainerNav active="rutinas" />
    </div>
  );
}
