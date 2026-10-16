import { useState } from 'react';
import { EXERCISES, ex } from '../../data/catalog';
import { useApp, useMe } from '../../lib/app';
import { go } from '../../lib/router';
import type { Suggestion } from '../../lib/types';
import { n, uid } from '../../lib/util';
import { IcCheck } from '../../ui/icons';
import { Loading, Sec, TopBar, TrainerNav, toast } from '../../ui/kit';
import { useDismiss, useTrainerData } from './data';

interface Draft {
  dayId: string;
  planId: string;
  from: string;
  to: string;
  reason: string;
}

export function Suggest({ routineId }: { routineId: string }) {
  const { store } = useApp();
  const me = useMe();
  const td = useTrainerData();
  const dismiss = useDismiss();
  const [open, setOpen] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [more, setMore] = useState(false);
  if (!td.ready) return <Loading />;
  const r = td.routines.find((x) => x.id === routineId);
  if (!r || !td.clients.some((c) => c.id === r.ownerId))
    return (
      <div className="screen with-nav">
        <TopBar back="/clientes" backLabel="Clientes" />
        <div className="main">
          <p className="lead" style={{ marginTop: 20 }}>No encuentro esta rutina.</p>
        </div>
        <TrainerNav active="clientes" />
      </div>
    );
  const client = td.clients.find((c) => c.id === r.ownerId);
  const pending = td.suggestions.filter((s) => s.routineId === r.id && s.status === 'pending');
  const answered = td.suggestions.filter((s) => s.routineId === r.id && s.status !== 'pending').sort((a, b) => (b.answeredAt || 0) - (a.answeredAt || 0));
  const count = Object.keys(drafts).length;
  const send = async () => {
    for (const d of Object.values(drafts)) {
      const s: Suggestion = {
        id: uid(),
        routineId: r.id,
        dayId: d.dayId,
        planId: d.planId,
        clientId: r.ownerId,
        trainerId: me.id,
        fromExerciseId: d.from,
        toExerciseId: d.to,
        reason: d.reason.trim(),
        status: 'pending',
        createdAt: Date.now(),
      };
      await store.set('suggestions', s.id, s);
    }
    await dismiss(`routine:${r.id}:${r.updatedAt}`);
    toast(count === 1 ? 'Sugerencia enviada' : `${count} sugerencias enviadas`);
    go(`/cliente/${r.ownerId}`, true);
  };
  const statusText: Record<Suggestion['status'], string> = { pending: 'Pendiente', accepted: 'Aceptada', tryonce: 'La probará una vez', rejected: 'Prefiere la suya' };
  return (
    <div className="screen with-nav">
      <TopBar back={`/cliente/${r.ownerId}`} backLabel={client?.name || 'Cliente'} right={<span className="small mute">Solo lectura</span>} />
      <div className="pad">
        <span className="kicker" style={{ display: 'block', marginTop: 4 }}>Creada por {client?.name || 'el cliente'}</span>
        <h1 className="h1" style={{ marginTop: 6, fontSize: 32 }}>{r.name}</h1>
        <p className="small mute" style={{ marginTop: 6, fontSize: 14 }}>Tus cambios le llegan como sugerencia. Decide {client?.name ? 'él' : 'el cliente'}.</p>
      </div>
      <div className="main">
        {r.days.map((d) => (
          <div key={d.id}>
            {r.days.length > 1 && <Sec title={d.name} />}
            <div style={{ borderTop: r.days.length > 1 ? 0 : '1px solid var(--ink)', marginTop: r.days.length > 1 ? 0 : 14 }}>
              {d.exercises.map((p, i) => {
                const x = ex(p.exerciseId);
                const isOpen = open === p.id;
                const dr = drafts[p.id];
                const pend = pending.find((s) => s.planId === p.id);
                const alts = [...new Set([...(x?.alts || []), ...EXERCISES.filter((e2) => e2.group === x?.group && e2.id !== x?.id).map((e2) => e2.id)])].slice(0, more ? 12 : 3);
                return (
                  <div key={p.id} style={{ borderBottom: '1px solid var(--line)', padding: isOpen ? '8px 0 14px' : 0 }}>
                    <div className="row num" style={{ borderBottom: 0 }}>
                      <span className={`small ${dr || pend ? 'b accent-t' : 'mute'}`}>{i + 1}</span>
                      <span className="col">
                        <span className="t">{x?.name || p.rawName}</span>
                        <span className="s">
                          {dr ? `→ ${ex(dr.to)?.name}` : pend ? `Sugerido: ${ex(pend.toExerciseId)?.name}` : `${p.sets} × ${p.reps}${p.weight !== null ? ` · ${x?.load === 'dumbbell' ? '2 × ' : ''}${n(p.weight)} kg` : ''}`}
                        </span>
                      </span>
                      {pend ? (
                        <span className="xs mute">Pendiente</span>
                      ) : (
                        <button type="button" className="txt mute" style={{ fontSize: 13 }} onClick={() => setOpen(isOpen ? null : p.id)}>
                          {isOpen ? 'Cerrar' : dr ? 'Cambiar' : 'Cambiar por'}
                        </button>
                      )}
                    </div>
                    {isOpen && x && (
                      <div style={{ marginLeft: 30 }}>
                        <span className="kicker">Cambiar por</span>
                        <div role="radiogroup" aria-label={`Cambiar ${x.name} por`} style={{ marginTop: 4 }}>
                          {alts.map((id) => {
                            const a = ex(id)!;
                            const on = dr?.to === id;
                            return (
                              <button key={id} type="button" role="radio" aria-checked={on} onClick={() => setDrafts({ ...drafts, [p.id]: { dayId: d.id, planId: p.id, from: x.id, to: id, reason: dr?.reason || '' } })} style={{ background: 'none', border: 0, borderBottom: '1px solid var(--line)', padding: 0, width: '100%', textAlign: 'left', minHeight: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="stack" style={{ gap: 1 }}>
                                  <span style={{ fontSize: 15, fontWeight: on ? 600 : 500, color: on ? 'var(--accent-text)' : undefined }}>{a.name}</span>
                                  <span className="xs mute">{a.equipment}</span>
                                </span>
                                {on && <IcCheck style={{ color: 'var(--accent-text)' }} />}
                              </button>
                            );
                          })}
                        </div>
                        {!more && (
                          <button type="button" className="txt mute" style={{ fontSize: 13 }} onClick={() => setMore(true)}>
                            Ver más del mismo grupo
                          </button>
                        )}
                        {dr && (
                          <>
                            <label htmlFor={`m-${p.id}`} className="xs mute" style={{ display: 'block', marginTop: 12 }}>
                              Motivo para {client?.name || 'el cliente'} (opcional)
                            </label>
                            <input id={`m-${p.id}`} className="input" style={{ fontSize: 15, height: 40 }} value={dr.reason} onChange={(e) => setDrafts({ ...drafts, [p.id]: { ...dr, reason: e.target.value } })} placeholder="Mantiene la tensión en todo el recorrido." />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {answered.length > 0 && (
          <>
            <Sec title="Respuestas" />
            {answered.slice(0, 5).map((s) => (
              <div key={s.id} className="row" style={{ minHeight: 48 }}>
                <span className="col">
                  <span className="m" style={{ fontSize: 15 }}>
                    {ex(s.fromExerciseId)?.name} → {ex(s.toExerciseId)?.name}
                  </span>
                </span>
                <span className="small mute">{statusText[s.status]}</span>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="bottom">
        <button type="button" className="btn" disabled={!count} onClick={send}>
          {count ? `Enviar ${count} ${count === 1 ? 'sugerencia' : 'sugerencias'}` : 'Elige un ejercicio para cambiar'}
        </button>
      </div>
      <TrainerNav active="clientes" />
    </div>
  );
}
