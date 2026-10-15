import { useState, type FormEvent } from 'react';
import type { Repo } from '../lib/repo';
import { setMode } from '../lib/repo';
import { DEMO_CLIENT, DEMO_TRAINER } from '../lib/repo/demo';
import { hasFirebase } from '../firebaseConfig';
import { CENTERS } from '../data/catalog';
import type { CenterId, Role } from '../lib/types';

export function Auth({ repo }: { repo: Repo }) {
  const [tab, setTab] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('client');
  const [center, setCenter] = useState<CenterId>('ruzafa');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message ?? 'Algo ha fallado.');
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (tab === 'in') run(() => repo.signIn(email, password));
    else {
      if (!name.trim()) return setError('Escribe tu nombre.');
      if (password.length < 6) return setError('La contraseña necesita al menos 6 caracteres.');
      run(() => repo.signUp({ email, password, name, role, center }));
    }
  }

  const demo = repo.mode === 'demo';

  return (
    <div className="auth">
      <div className="brand">GymApp</div>
      <p className="lede">Las rutinas de tu entrenador, tus pesos y tu progreso, en el bolsillo.</p>

      {demo && (
        <div className="panel stack" style={{ marginBottom: 20 }}>
          <div>
            <strong>Modo demo</strong>
            <div className="muted small">Los datos se guardan solo en este dispositivo. Entra con un usuario de ejemplo:</div>
          </div>
          <button className="btn primary" onClick={() => (repo as Repo & { loginAs(id: string): void }).loginAs(DEMO_CLIENT)}>Entrar como Carlos (cliente)</button>
          <button className="btn" onClick={() => (repo as Repo & { loginAs(id: string): void }).loginAs(DEMO_TRAINER)}>Entrar como Ángel (entrenador)</button>
          {hasFirebase && <button className="btn ghost small" onClick={() => setMode('firebase')}>Usar cuentas reales</button>}
        </div>
      )}

      <div className="segmented" style={{ marginBottom: 16 }}>
        <button aria-pressed={tab === 'in'} onClick={() => setTab('in')}>Entrar</button>
        <button aria-pressed={tab === 'up'} onClick={() => setTab('up')}>Crear cuenta</button>
      </div>

      <form className="stack" onSubmit={submit}>
        {tab === 'up' && (
          <>
            <label className="field">
              <span>Nombre</span>
              <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="field">
              <span>Uso la app como</span>
              <div className="segmented">
                <button type="button" aria-pressed={role === 'client'} onClick={() => setRole('client')}>Cliente</button>
                <button type="button" aria-pressed={role === 'trainer'} onClick={() => setRole('trainer')}>Entrenador</button>
              </div>
            </div>
            <label className="field">
              <span>Centro</span>
              <select className="input" value={center} onChange={(e) => setCenter(e.target.value as CenterId)}>
                {CENTERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </>
        )}
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input className="input" type="password" autoComplete={tab === 'in' ? 'current-password' : 'new-password'} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        {info && <div className="muted small" role="status">{info}</div>}
        <button className="btn primary block" disabled={busy}>{tab === 'in' ? 'Entrar' : 'Crear cuenta'}</button>
        {tab === 'in' && !demo && (
          <button type="button" className="btn ghost small" disabled={busy} onClick={() => {
            if (!email) return setError('Escribe tu email y vuelve a pulsar.');
            run(async () => { await repo.resetPassword(email); setInfo('Te hemos enviado un correo para cambiar la contraseña.'); });
          }}>He olvidado la contraseña</button>
        )}
      </form>

      {!demo && (
        <button className="btn ghost small" style={{ marginTop: 24 }} onClick={() => setMode('demo')}>Probar sin cuenta (modo demo)</button>
      )}
    </div>
  );
}
