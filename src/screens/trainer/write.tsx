import { useCallback, useEffect, useState } from 'react';
import { useApp, useDoc, useMe } from '../../lib/app';
import { assignRoutine } from '../../lib/api';
import { toNotes } from '../../lib/quicknotes';
import { go } from '../../lib/router';
import { exerciseSeries } from '../../lib/stats';
import type { Profile, Routine } from '../../lib/types';
import { uid } from '../../lib/util';
import { Loading, TopBar, toast } from '../../ui/kit';
import { NotesEditor, useDraft } from '../shared/notes';
import { useTrainerData } from './data';

export function Write({ forClient, routineId }: { forClient: string | null; routineId: string | null }) {
  const { store } = useApp();
  const me = useMe();
  const td = useTrainerData();
  const client = useDoc<Profile>('users', forClient);
  const existing = routineId ? td.routines.find((r) => r.id === routineId && r.ownerId === me.id) : undefined;
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [keep, setKeep] = useState(true);
  const [loaded, setLoaded] = useState(!routineId);
  useEffect(() => {
    if (loaded || !existing) return;
    setName(existing.name);
    setText(toNotes(existing.days));
    setLoaded(true);
  }, [existing, loaded]);
  const lastWeight = useCallback(
    (id: string) => {
      if (!forClient) return null;
      const s = exerciseSeries(td.workouts.filter((w) => w.clientId === forClient), id);
      return s.length ? s[s.length - 1].weight : null;
    },
    [td.workouts, forClient],
  );
  const draft = useDraft(text, choices, lastWeight, existing?.days);
  if (!td.ready || client === undefined || (routineId && !loaded && !existing && td.ready)) {
    if (td.ready && routineId && !existing) return <Missing />;
    return <Loading />;
  }
  const save = async () => {
    if (!draft.days.length) return toast('Escribe al menos un ejercicio');
    const now = Date.now();
    const base: Routine = existing
      ? { ...existing, name: name.trim() || existing.name, days: draft.days, updatedAt: now }
      : {
          id: uid(),
          ownerId: me.id,
          ownerRole: 'trainer',
          clientId: null,
          trainerId: me.id,
          name: name.trim() || draft.days.map((d) => d.name.split(' · ')[0]).join(' / '),
          days: draft.days,
          template: true,
          week: 1,
          createdAt: now,
          updatedAt: now,
          uses: 0,
        };
    if (existing || keep || !forClient) await store.set('routines', base.id, base);
    if (forClient && client) {
      await assignRoutine(store, me, base, forClient);
      if (!keep && !existing) await store.remove('routines', base.id);
      toast(`Enviada a ${client.name}`);
      go(`/cliente/${forClient}`, true);
    } else {
      toast('Guardada en tu biblioteca');
      go('/biblioteca', true);
    }
  };
  return (
    <div className="screen">
      <TopBar
        back={forClient ? `/cliente/${forClient}` : '/biblioteca'}
        backLabel={client?.name || 'Rutinas'}
        right={
          existing ? (
            <button
              type="button"
              className="txt mute"
              onClick={async () => {
                if (!confirm('¿Borrar esta rutina de tu biblioteca?')) return;
                await store.remove('routines', existing.id);
                go('/biblioteca', true);
              }}
            >
              Borrar
            </button>
          ) : (
            <span className="small mute">Se guarda al enviar</span>
          )
        }
      />
      <div className="main">
        <div className="field" style={{ marginTop: 2 }}>
          <label htmlFor="rn">Nombre</label>
          <input id="rn" className="input" style={{ fontSize: 26, fontWeight: 500 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Pierna / Torso" />
        </div>
        {client && <p className="small mute" style={{ marginTop: 6 }}>Para {client.name}</p>}
        <div style={{ marginTop: 16 }}>
          <NotesEditor text={text} setText={setText} choices={choices} setChoices={setChoices} lastWeight={lastWeight} prevDays={existing?.days} audience={client ? client.name : 'tus clientes'} />
        </div>
      </div>
      <div className="bottom">
        {forClient && !existing && (
          <label className="check" style={{ alignItems: 'center', minHeight: 44 }}>
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            <span>Guardar también en tu biblioteca</span>
          </label>
        )}
        <button type="button" className="btn" onClick={save}>
          {forClient && client ? `Enviar a ${client.name}` : existing ? 'Guardar cambios' : 'Guardar en tu biblioteca'}
        </button>
      </div>
    </div>
  );
}

function Missing() {
  return (
    <div className="screen">
      <TopBar back="/biblioteca" backLabel="Rutinas" />
      <div className="main">
        <p className="lead" style={{ marginTop: 20 }}>No encuentro esta rutina.</p>
      </div>
    </div>
  );
}
