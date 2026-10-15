import { useEffect, useState } from 'react';
import { useApp, useAsync } from '../lib/app';
import { setMode } from '../lib/repo';
import { DEMO_CLIENT, DEMO_TRAINER, resetDemo } from '../lib/repo/demo';
import { hasFirebase } from '../firebaseConfig';
import { CENTERS, getExercise } from '../data/catalog';
import type { CenterId } from '../lib/types';
import { navigate } from '../lib/router';
import { IconTrash } from '../components/icons';

export function ProfilePage() {
  const { repo, me, setMe, toast } = useApp();
  const [name, setName] = useState(me.name);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const trainer = useAsync(async () => (me.trainerId ? repo.getProfile(me.trainerId) : null), [me.trainerId]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try { await fn(); } catch (e: any) { setErr(e?.message ?? 'Algo ha fallado'); } finally { setBusy(false); }
  }

  const notes = Object.entries(me.exerciseNotes);

  return (
    <div className="screen">
      <h1 className="display">Perfil</h1>
      <p className="lede">{me.role === 'trainer' ? 'Entrenador' : 'Cliente'}{me.email ? ` · ${me.email}` : ''}</p>

      <div className="stack">
        <label className="field">
          <span>Nombre</span>
          <div className="row">
            <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} />
            {name.trim() !== me.name && name.trim() && (
              <button className="btn" disabled={busy} onClick={() => run(async () => { setMe(await repo.updateMe({ name: name.trim() })); toast('Nombre guardado'); })}>Guardar</button>
            )}
          </div>
        </label>
        <label className="field">
          <span>Mi centro</span>
          <select className="input" value={me.center} onChange={(e) => run(async () => { setMe(await repo.updateMe({ center: e.target.value as CenterId })); toast('Centro cambiado'); })}>
            {CENTERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      {me.role === 'trainer' ? (
        <>
          <h2 className="section">Tu código de entrenador</h2>
          <div className="panel">
            <div className="code-box">{me.code}</div>
            <p className="muted small" style={{ margin: '4px 0 12px' }}>Tus clientes lo escriben en su Perfil para que puedas ponerles rutinas y ver sus entrenos.</p>
            {'share' in navigator && (
              <button className="btn small" onClick={() => navigator.share({ title: 'GymApp', text: `Vincúlate conmigo en GymApp con el código ${me.code}`, url: location.origin + location.pathname }).catch(() => {})}>Compartir código</button>
            )}
          </div>
        </>
      ) : (
        <>
          <h2 className="section">Entrenador</h2>
          {me.trainerId ? (
            <div className="panel row">
              <div className="grow">
                <strong>{trainer.data?.name ?? '…'}</strong>
                <div className="muted small">Ve tus entrenos y te pone las rutinas.</div>
              </div>
              <button className="btn small danger" disabled={busy} onClick={() => confirm('¿Desvincularte de tu entrenador? Dejará de ver tus entrenos.') && run(async () => { setMe(await repo.leaveTrainer()); toast('Te has desvinculado'); })}>Desvincular</button>
            </div>
          ) : (
            <div className="stack">
              <p className="lede small" style={{ margin: 0 }}>Pídele a tu entrenador su código de 6 letras.</p>
              <div className="row">
                <input className="input grow" placeholder="ABC123" value={code} maxLength={6} autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase())} />
                <button className="btn primary" disabled={busy || code.length < 6} onClick={() => run(async () => { setMe(await repo.joinTrainer(code)); setCode(''); toast('Vinculado con tu entrenador'); })}>Vincular</button>
              </div>
            </div>
          )}
          {err && <p className="error">{err}</p>}

          <h2 className="section">Ajustes de máquinas</h2>
          {notes.length ? (
            <div className="list">
              {notes.map(([id, text]) => (
                <div key={id} className="item">
                  <div className="grow">
                    <div className="name">{getExercise(id).name}</div>
                    <div className="meta">{text}</div>
                  </div>
                  <button className="icon-btn" aria-label="Borrar ajuste" onClick={() => run(async () => {
                    const n = { ...me.exerciseNotes };
                    delete n[id];
                    setMe(await repo.updateMe({ exerciseNotes: n }));
                  })}><IconTrash size={20} /></button>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">Durante el entreno, en el menú de cada ejercicio, apunta la altura del asiento o el agarre y te lo recordamos.</p>
          )}
        </>
      )}

      <InstallHint />

      {repo.mode === 'demo' && (
        <>
          <h2 className="section">Modo demo</h2>
          <p className="muted small" style={{ marginTop: 0 }}>Los datos viven solo en este dispositivo.</p>
          <div className="stack">
            <button className="btn" onClick={() => { (repo as any).loginAs(me.role === 'trainer' ? DEMO_CLIENT : DEMO_TRAINER); navigate('/', { replace: true }); }}>
              Ver como {me.role === 'trainer' ? 'cliente (Carlos)' : 'entrenador (Ángel)'}
            </button>
            <button className="btn ghost" onClick={() => { if (confirm('¿Borrar los datos de la demo y empezar de cero?')) { resetDemo(); location.reload(); } }}>Reiniciar datos de la demo</button>
            {hasFirebase && <button className="btn ghost" onClick={() => setMode('firebase')}>Usar cuentas reales</button>}
          </div>
        </>
      )}

      <button className="btn block danger" style={{ marginTop: 28 }} onClick={() => repo.signOut()}>Cerrar sesión</button>
    </div>
  );
}

function InstallHint() {
  const [prompt, setPrompt] = useState<any>(null);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  if (standalone) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <>
      <h2 className="section">Instalar en el móvil</h2>
      {prompt ? (
        <button className="btn block" onClick={() => prompt.prompt()}>Instalar GymApp</button>
      ) : ios ? (
        <p className="muted small" style={{ marginTop: 0 }}>En Safari pulsa Compartir y luego "Añadir a pantalla de inicio". Así se abre a pantalla completa y funciona sin cobertura.</p>
      ) : (
        <p className="muted small" style={{ marginTop: 0 }}>Abre el menú del navegador y pulsa "Instalar aplicación" o "Añadir a pantalla de inicio".</p>
      )}
    </>
  );
}
