import { useState } from 'react';
import { useApp, useMe } from '../lib/app';
import { deleteAccountData, deleteClientData, setShareBody, unlinkTrainer, type DeleteWhat } from '../lib/api';
import { canVibrate, isStandalone } from '../lib/alerts';
import { authMessage, setSavedMode } from '../lib/db';
import { deleteAllFiles, deleteFilesWithPrefix } from '../lib/files';
import { go, href } from '../lib/router';
import type { Settings as S } from '../lib/types';
import { dateShort, mmss, n } from '../lib/util';
import { IcChev } from '../ui/icons';
import { ClientNav, Seg, Sheet, Switch, TopBar, TrainerNav, toast } from '../ui/kit';

export function Settings() {
  const { store, settings } = useApp();
  const me = useMe();
  const [sheet, setSheet] = useState<null | 'rest' | 'alert' | 'inc' | 'delete'>(null);
  const set = (patch: Partial<S>) => store.update('users', me.id, { settings: { ...(me.settings || {}), ...patch } });
  const client = me.role === 'client';
  const alertLabel: Record<S['alert'], string> = { both: 'Vibración y sonido', vibrate: 'Solo vibración', sound: 'Solo sonido', none: 'Sin aviso' };
  return (
    <div className="screen with-nav">
      <TopBar back={client ? '/hoy' : '/clientes'} backLabel={client ? 'Hoy' : 'Clientes'} />
      <div className="pad">
        <h1 className="h1" style={{ marginTop: 2 }}>Ajustes</h1>
        <p className="small mute" style={{ marginTop: 6 }}>
          {me.name} · {me.email || 'sin correo'}
          {store.mode === 'local' ? ' · modo demo' : ''}
        </p>
      </div>
      <div className="main" style={{ paddingTop: 12 }}>
        {client && (
          <>
            <span className="kicker" style={{ color: 'var(--ink)', paddingBottom: 6, borderBottom: '1px solid var(--ink)', marginTop: 8 }}>Entreno</span>
            <button type="button" className="row" onClick={() => setSheet('rest')}>
              <span className="t" style={{ fontWeight: 400, fontSize: 15 }}>Descanso por defecto</span>
              <span className="mute">{mmss(settings.restSec)}</span>
            </button>
            <button type="button" className="row" onClick={() => setSheet('alert')}>
              <span className="t" style={{ fontWeight: 400, fontSize: 15 }}>Aviso de fin de descanso</span>
              <span className="mute">{alertLabel[settings.alert]}</span>
            </button>
            <button type="button" className="row" onClick={() => setSheet('inc')}>
              <span className="t" style={{ fontWeight: 400, fontSize: 15 }}>Saltos de peso</span>
              <span className="small mute" style={{ textAlign: 'right' }}>
                Máquina y barra {n(settings.incMachine)} · mancuerna {n(settings.incDumbbell)} kg
              </span>
            </button>
          </>
        )}

        <span className="kicker" style={{ color: 'var(--ink)', paddingBottom: 6, borderBottom: '1px solid var(--ink)', marginTop: 22 }}>Pantalla</span>
        <div className="row">
          <span style={{ fontSize: 15 }}>Tema</span>
          <Seg value={settings.theme} onChange={(v) => set({ theme: v })} label="Tema" options={[['auto', 'Auto'], ['light', 'Claro'], ['dark', 'Oscuro']]} />
        </div>
        {client && (
          <div className="row">
            <span style={{ fontSize: 15 }}>Pantalla encendida al entrenar</span>
            <Switch on={settings.wakeLock} onChange={(v) => set({ wakeLock: v })} label="Pantalla encendida al entrenar" />
          </div>
        )}

        {client && (
          <>
            <span className="kicker" style={{ color: 'var(--ink)', paddingBottom: 6, borderBottom: '1px solid var(--ink)', marginTop: 22 }}>Tu entrenador · qué ve</span>
            {me.trainerId ? (
              <div className="row">
                <span className="col">
                  <span className="t" style={{ fontSize: 15 }}>{me.trainerName || 'Tu entrenador'}</span>
                  {me.linkedAt && <span className="xs mute">Vinculado desde {dateShort(me.linkedAt)}</span>}
                </span>
                <button
                  type="button"
                  className="txt u"
                  style={{ fontSize: 13 }}
                  onClick={async () => {
                    if (!confirm('¿Desvincularte? Dejará de ver tus entrenos y tus datos.')) return;
                    await unlinkTrainer(store, me);
                    toast('Te has desvinculado');
                  }}
                >
                  Desvincular
                </button>
              </div>
            ) : (
              <p className="small mute" style={{ padding: '12px 0' }}>Sin entrenador. Abre el enlace de invitación que te mande para vincularte.</p>
            )}
            <div className="row">
              <span className="col">
                <span style={{ fontSize: 15 }}>Entrenamientos</span>
                <span className="xs mute">Necesario para que te entrene</span>
              </span>
              <span className="small mute">{me.trainerId ? 'Siempre' : '—'}</span>
            </div>
            <div className="row">
              <span className="col">
                <span style={{ fontSize: 15 }}>Datos de cuerpo (Visbody)</span>
                <span className="xs mute">Datos de salud</span>
              </span>
              <Switch on={me.shareBody !== false} onChange={(v) => setShareBody(store, me, v)} label="Compartir datos de cuerpo con tu entrenador" />
            </div>
            <div className="row">
              <span className="col">
                <span style={{ fontSize: 15 }}>Fotos y notas de máquinas</span>
                <span className="xs mute">Solo para ti</span>
              </span>
              <span className="small mute">Nunca</span>
            </div>
          </>
        )}
        <span className="kicker" style={{ color: 'var(--ink)', paddingBottom: 6, borderBottom: '1px solid var(--ink)', marginTop: 22 }}>Tus datos</span>
        {client && (
          <a className="row" href={href('/exportar')}>
            <span className="col">
              <span className="t" style={{ fontSize: 15 }}>Descargar mis datos</span>
              <span className="xs mute">Excel, CSV o informe PDF</span>
            </span>
            <IcChev className="chev" />
          </a>
        )}
        {client && (
          <button type="button" className="row" style={{ width: '100%', textAlign: 'left' }} onClick={() => setSheet('delete')}>
            <span className="col">
              <span className="t" style={{ fontSize: 15 }}>Borrar mi información</span>
              <span className="xs mute">Entrenos, informes Visbody, rutinas, máquinas o notas</span>
            </span>
            <IcChev className="chev" />
          </button>
        )}
        <button
          type="button"
          className="row"
          style={{ width: '100%', textAlign: 'left', color: 'var(--accent-text)' }}
          onClick={async () => {
            if (!confirm('¿Borrar tu cuenta y todos tus datos? No se puede deshacer.')) return;
            try {
              await deleteAccountData(store, me);
              await deleteAllFiles();
              await store.deleteAuthUser();
              localStorage.removeItem('gym:active');
              go('/bienvenida', true);
            } catch (e) {
              alert(authMessage(e));
            }
          }}
        >
          <span className="col">
            <span className="t" style={{ fontSize: 15 }}>Borrar la cuenta entera</span>
            <span className="xs mute">Todo, también tu acceso. No se puede deshacer</span>
          </span>
        </button>

        <a className="row" href={href('/instalar')} style={{ marginTop: 14, borderTop: '1px solid var(--ink)' }}>
          <span className="col">
            <span className="t" style={{ fontSize: 15 }}>Avisos y app instalada</span>
            <span className="xs mute">
              {isStandalone() ? 'Instalada' : 'Sin instalar: los avisos no llegan con el móvil bloqueado'}
              {'Notification' in window ? ` · avisos ${Notification.permission === 'granted' ? 'activados' : 'desactivados'}` : ''}
            </span>
          </span>
          <IcChev className="chev" />
        </a>
        <button
          type="button"
          className="txt"
          style={{ marginTop: 10 }}
          onClick={async () => {
            await store.signOut();
            if (store.mode === 'local') {
              setSavedMode('firebase');
              localStorage.removeItem('gym:local-db');
              history.replaceState(null, '', '#/bienvenida');
              location.reload();
            }
          }}
        >
          {store.mode === 'local' ? 'Salir del modo demo' : 'Cerrar sesión'}
        </button>
      </div>
      {client ? <ClientNav active="hoy" /> : <TrainerNav active="clientes" />}

      {sheet === 'rest' && (
        <Sheet label="Descanso por defecto" onClose={() => setSheet(null)}>
          <h2 className="h2" style={{ margin: '16px 0 8px', fontSize: 24 }}>Descanso por defecto</h2>
          {[60, 90, 120, 150, 180, 240].map((v) => (
            <button key={v} type="button" className="row" onClick={() => (set({ restSec: v }), setSheet(null))}>
              <span className="t" style={{ fontWeight: settings.restSec === v ? 600 : 400 }}>{mmss(v)}</span>
              {settings.restSec === v ? <span className="accent-t b small">Actual</span> : <span />}
            </button>
          ))}
        </Sheet>
      )}
      {sheet === 'alert' && (
        <Sheet label="Aviso de fin de descanso" onClose={() => setSheet(null)}>
          <h2 className="h2" style={{ margin: '16px 0 8px', fontSize: 24 }}>Aviso de fin de descanso</h2>
          {(['both', 'vibrate', 'sound', 'none'] as S['alert'][]).map((v) => (
            <button key={v} type="button" className="row" onClick={() => (set({ alert: v }), setSheet(null))}>
              <span className="t" style={{ fontWeight: settings.alert === v ? 600 : 400 }}>{alertLabel[v]}</span>
              {settings.alert === v ? <span className="accent-t b small">Actual</span> : <span />}
            </button>
          ))}
          {!canVibrate() && <p className="xs mute" style={{ marginTop: 10 }}>Este móvil no permite vibrar desde una web (iPhone): usa el sonido con auriculares o los avisos de la app instalada.</p>}
        </Sheet>
      )}
      {sheet === 'delete' && <DeleteSheet onClose={() => setSheet(null)} />}
      {sheet === 'inc' && (
        <Sheet label="Saltos de peso" onClose={() => setSheet(null)}>
          <h2 className="h2" style={{ margin: '16px 0 8px', fontSize: 24 }}>Saltos de peso</h2>
          <div className="row">
            <span>Máquina y barra</span>
            <Seg value={String(settings.incMachine)} onChange={(v) => set({ incMachine: +v })} label="Salto en máquina" options={[['1.25', '1,25'], ['2.5', '2,5'], ['5', '5']]} />
          </div>
          <div className="row">
            <span>Mancuernas</span>
            <Seg value={String(settings.incDumbbell)} onChange={(v) => set({ incDumbbell: +v })} label="Salto en mancuernas" options={[['1', '1'], ['2', '2'], ['2.5', '2,5']]} />
          </div>
          <button type="button" className="btn" style={{ marginTop: 16 }} onClick={() => setSheet(null)}>
            Hecho
          </button>
        </Sheet>
      )}
    </div>
  );
}

function DeleteSheet({ onClose }: { onClose: () => void }) {
  const { store } = useApp();
  const me = useMe();
  const [what, setWhat] = useState<DeleteWhat>({ workouts: false, reports: false, routines: false, machines: false, notes: false });
  const [busy, setBusy] = useState(false);
  const opts: [keyof DeleteWhat, string, string][] = [
    ['workouts', 'Entrenamientos', 'Todas tus sesiones, series y récords'],
    ['reports', 'Informes Visbody', 'Los datos y los PDF guardados en este móvil'],
    ['routines', 'Mis rutinas', 'Las que has creado tú (no las de tu entrenador)'],
    ['machines', 'Fotos y notas de máquinas', 'Dónde está cada máquina y tus ajustes'],
    ['notes', 'Notas a mi entrenador', 'Lo que le has dejado escrito en las sesiones'],
  ];
  const any = Object.values(what).some(Boolean);
  const run = async () => {
    const names = opts.filter(([k]) => what[k]).map(([, t]) => t.toLowerCase());
    if (!confirm(`¿Borrar ${names.join(', ')}? No se puede deshacer.`)) return;
    setBusy(true);
    try {
      await deleteClientData(store, me, what);
      if (what.reports) await deleteFilesWithPrefix('visbody/');
      if (what.machines) await deleteFilesWithPrefix('photo/');
      toast('Borrado');
      onClose();
    } catch (e) {
      alert(authMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet label="Borrar mi información" onClose={onClose}>
      <h2 className="h2" style={{ margin: '16px 0 4px', fontSize: 24 }}>Borrar mi información</h2>
      <p className="small mute" style={{ marginBottom: 8 }}>Marca lo que quieres borrar. Tu cuenta sigue activa.</p>
      {opts.map(([k, t, sub]) => (
        <label key={k} className="row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto', cursor: 'pointer' }}>
          <span className="col">
            <span className="t" style={{ fontSize: 15 }}>{t}</span>
            <span className="xs mute">{sub}</span>
          </span>
          <input type="checkbox" checked={what[k]} onChange={(e) => setWhat({ ...what, [k]: e.target.checked })} style={{ width: 22, height: 22, accentColor: 'var(--accent)' }} />
        </label>
      ))}
      <button type="button" className="btn" style={{ marginTop: 16 }} disabled={!any || busy} onClick={run}>
        {busy ? 'Borrando…' : 'Borrar lo marcado'}
      </button>
      <button type="button" className="txt" style={{ display: 'flex', margin: '6px auto 0' }} onClick={onClose}>
        Cancelar
      </button>
    </Sheet>
  );
}
