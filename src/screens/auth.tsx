import { useEffect, useState } from 'react';
import { useApp, useDoc } from '../lib/app';
import { authMessage, setSavedMode } from '../lib/db';
import { acceptInvite, createProfile } from '../lib/api';
import { askNotifications, isIOS, isStandalone } from '../lib/alerts';
import { seedDemo } from '../lib/demo';
import { go, href } from '../lib/router';
import type { Invite, Role } from '../lib/types';
import { IcAddHome, IcArrowFlat, IcBell, IcShare } from '../ui/icons';
import { Switch, TopBar } from '../ui/kit';

function startDemo(as: 'client' | 'trainer') {
  seedDemo(as);
  setSavedMode('local');
  location.hash = as === 'trainer' ? '#/clientes' : '#/hoy';
  location.reload();
}

export function Welcome() {
  const [demo, setDemo] = useState(false);
  return (
    <div className="screen">
      <div className="topbar">
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 14, height: 14, background: 'var(--accent)' }} />
          <span className="b">GymApp</span>
        </span>
      </div>
      <div className="main">
        <div className="grow" style={{ minHeight: 40 }} />
        <h1 className="h1" style={{ fontSize: 52, lineHeight: 0.98, letterSpacing: '-0.045em' }}>
          Entrena.
          <br />
          Sin papeles.
          <br />
          Sin pensar.
        </h1>
        <p className="lead" style={{ marginTop: 18, fontSize: 17 }}>
          Tu entrenador prepara la rutina; tú solo sigues la siguiente serie.
        </p>
        <div className="sec" style={{ marginTop: 40 }}>
          <span className="kicker">¿Quién eres?</span>
        </div>
        <a className="row" style={{ minHeight: 76 }} href={href('/registro?rol=client')}>
          <span className="col">
            <span className="t" style={{ fontSize: 20 }}>Me entreno</span>
            <span className="s">Con la invitación de tu entrenador o por tu cuenta</span>
          </span>
          <IcArrowFlat />
        </a>
        <a className="row" style={{ minHeight: 76 }} href={href('/registro?rol=trainer')}>
          <span className="col">
            <span className="t" style={{ fontSize: 20 }}>Soy entrenador</span>
            <span className="s">Crea tu biblioteca de rutinas e invita a tus clientes</span>
          </span>
          <IcArrowFlat />
        </a>
      </div>
      <div className="bottom" style={{ alignItems: 'center' }}>
        <a className="txt" href={href('/entrar')}>
          Ya tengo cuenta · <span className="accent-t b">Entrar</span>
        </a>
        {!demo ? (
          <button type="button" className="txt mute" onClick={() => setDemo(true)}>
            Probar sin cuenta
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 22 }}>
            <button type="button" className="txt accent" onClick={() => startDemo('client')}>
              Demo como Carlos
            </button>
            <button type="button" className="txt accent" onClick={() => startDemo('trainer')}>
              Demo como entrenador
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Login() {
  const { store } = useApp();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await store.signIn(email.trim(), pass);
    } catch (x) {
      setErr(authMessage(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="screen">
      <TopBar back="/bienvenida" />
      <form className="main" onSubmit={submit}>
        <h1 className="h1 xl" style={{ marginTop: 24 }}>
          Entrar
        </h1>
        <p className="lead" style={{ marginTop: 12 }}>
          Tus entrenamientos, rutinas e informes están en tu cuenta, no en el teléfono.
        </p>
        <div className="field" style={{ marginTop: 28 }}>
          <label htmlFor="em">Correo</label>
          <input id="em" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required />
        </div>
        <div className="field">
          <label htmlFor="pw">Contraseña</label>
          <input id="pw" className="input" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} required />
        </div>
        {err && <p className="error">{err}</p>}
        {sent && <p className="small mute" style={{ marginTop: 12 }}>Te hemos enviado un correo para cambiar la contraseña.</p>}
        <button className="btn" style={{ marginTop: 20 }} disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <button
          type="button"
          className="txt u"
          style={{ alignSelf: 'flex-start' }}
          onClick={async () => {
            if (!email) return setErr('Escribe tu correo y vuelve a pulsar.');
            try {
              await store.resetPassword(email.trim());
              setSent(true);
            } catch (x) {
              setErr(authMessage(x));
            }
          }}
        >
          He olvidado la contraseña
        </button>
        {store.mode === 'firebase' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', marginTop: 20 }} className="small mute">
              <span className="rule" />o<span className="rule" />
            </div>
            <button
              type="button"
              className="btn2"
              style={{ marginTop: 16 }}
              onClick={async () => {
                try {
                  await store.signInGoogle();
                } catch (x) {
                  setErr(authMessage(x));
                }
              }}
            >
              Continuar con Google
            </button>
          </>
        )}
        {store.mode === 'local' && <p className="small mute" style={{ marginTop: 16 }}>Modo demo: entra con carlos@demo o entrenador@demo (cualquier contraseña).</p>}
      </form>
    </div>
  );
}

export function Signup({ role: initial, invite }: { role: Role; invite: string | null }) {
  const { store } = useApp();
  const [role, setRole] = useState<Role>(invite ? 'client' : initial);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const u = await store.signUp(email.trim(), pass, name.trim());
      await createProfile(store, u.uid, name.trim(), u.email, role);
      go(invite ? `/unirse/${invite}` : role === 'trainer' ? '/clientes' : '/instalar', true);
    } catch (x) {
      setErr(authMessage(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="screen">
      <TopBar back="/bienvenida" />
      <form className="main" onSubmit={submit}>
        {invite && <span className="kicker accent" style={{ marginTop: 10 }}>Invitación {invite}</span>}
        <h1 className="h1" style={{ marginTop: 12 }}>
          {role === 'trainer' ? 'Cuenta de entrenador' : 'Crea tu cuenta'}
        </h1>
        {!invite && (
          <div className="seg" style={{ marginTop: 12 }} role="group" aria-label="Tipo de cuenta">
            <button type="button" aria-pressed={role === 'client'} onClick={() => setRole('client')}>
              Me entreno
            </button>
            <button type="button" aria-pressed={role === 'trainer'} onClick={() => setRole('trainer')}>
              Soy entrenador
            </button>
          </div>
        )}
        <div className="field">
          <label htmlFor="nm">Nombre</label>
          <input id="nm" className="input" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="em">Correo</label>
          <input id="em" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="pw">Contraseña (mínimo 6)</label>
          <input id="pw" className="input" type="password" autoComplete="new-password" minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} required />
        </div>
        {err && <p className="error">{err}</p>}
        <button className="btn" style={{ marginTop: 24 }} disabled={busy}>
          {busy ? 'Creando…' : 'Crear cuenta'}
        </button>
        <a className="txt" style={{ alignSelf: 'center' }} href={href('/entrar')}>
          Ya tengo cuenta · <span className="accent-t b">Entrar</span>
        </a>
      </form>
    </div>
  );
}

/** Usuario autenticado sin perfil (p. ej. primera vez con Google) */
export function CompleteProfile({ invite }: { invite: string | null }) {
  const { store, auth } = useApp();
  const [role, setRole] = useState<Role>('client');
  const [name, setName] = useState(auth?.name || '');
  const [busy, setBusy] = useState(false);
  if (!auth) return null;
  return (
    <div className="screen">
      <TopBar
        right={
          <button type="button" className="txt mute" onClick={() => store.signOut()}>
            Salir
          </button>
        }
      />
      <form
        className="main"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await createProfile(store, auth.uid, name.trim() || 'Sin nombre', auth.email, invite ? 'client' : role);
          go(invite ? `/unirse/${invite}` : role === 'trainer' ? '/clientes' : '/instalar', true);
        }}
      >
        <h1 className="h1" style={{ marginTop: 24 }}>
          Un último paso
        </h1>
        {!invite && (
          <div className="seg" style={{ marginTop: 16 }} role="group" aria-label="Tipo de cuenta">
            <button type="button" aria-pressed={role === 'client'} onClick={() => setRole('client')}>
              Me entreno
            </button>
            <button type="button" aria-pressed={role === 'trainer'} onClick={() => setRole('trainer')}>
              Soy entrenador
            </button>
          </div>
        )}
        <div className="field">
          <label htmlFor="nm">¿Cómo te llamas?</label>
          <input id="nm" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <button className="btn" style={{ marginTop: 24 }} disabled={busy}>
          Continuar
        </button>
      </form>
    </div>
  );
}

export function Join({ code }: { code: string }) {
  const { store, profile } = useApp();
  const inv = useDoc<Invite>('invites', code.toUpperCase());
  const [share, setShare] = useState(true);
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const me = profile!;
  if (inv === undefined) return <div className="screen"><div className="main" style={{ justifyContent: 'center' }}><p className="mute small">Buscando la invitación…</p></div></div>;
  const invalid = !inv || inv.expiresAt < Date.now() || (inv.usedBy && inv.usedBy !== me.id) || me.role !== 'client';
  return (
    <div className="screen">
      <TopBar back="/hoy" />
      <div className="main">
        <span className="kicker accent" style={{ marginTop: 10 }}>Invitación {code}</span>
        {invalid ? (
          <>
            <h1 className="h1" style={{ marginTop: 8 }}>Esta invitación no vale</h1>
            <p className="lead" style={{ marginTop: 12 }}>
              {me.role !== 'client' ? 'Las invitaciones son para cuentas de cliente.' : 'Puede que haya caducado o que ya se haya usado. Pide a tu entrenador un enlace nuevo.'}
            </p>
          </>
        ) : (
          <>
            <h1 className="h1" style={{ marginTop: 8, fontSize: 34 }}>{inv.trainerName} quiere entrenarte</h1>
            <p className="lead" style={{ marginTop: 10, fontSize: 15 }}>
              Te preparará las rutinas y verá cómo te van. Elige qué compartes; puedes cambiarlo en Ajustes cuando quieras.
            </p>
            <div className="sec">
              <span className="kicker">Qué verá</span>
            </div>
            <div className="row" style={{ minHeight: 60 }}>
              <span className="col">
                <span className="t">Tus entrenamientos</span>
                <span className="s xs">Series, pesos, sensaciones y notas</span>
              </span>
              <span className="small mute">Necesario</span>
            </div>
            <div className="row" style={{ minHeight: 60 }}>
              <span className="col">
                <span className="t">Tus datos de cuerpo</span>
                <span className="s xs">Informes Visbody: composición y postura</span>
              </span>
              <Switch on={share} onChange={setShare} label="Compartir datos de cuerpo" />
            </div>
            <div className="row" style={{ minHeight: 60 }}>
              <span className="col">
                <span className="t">Tus fotos de máquinas</span>
                <span className="s xs">Siempre privadas</span>
              </span>
              <span className="small mute">Nunca</span>
            </div>
            <label className="check" style={{ marginTop: 18 }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Acepto que se guarden mis datos de composición corporal, que son datos de salud. Puedo descargarlos o borrarlos en cualquier momento desde Ajustes.</span>
            </label>
          </>
        )}
      </div>
      <div className="bottom">
        {!invalid && inv && (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await acceptInvite(store, me, inv, share && consent);
              go(isStandalone() ? '/hoy' : '/instalar', true);
            }}
          >
            Unirme
          </button>
        )}
        <a className="txt" style={{ alignSelf: 'center' }} href={href('/hoy')}>
          Entrenar por mi cuenta
        </a>
      </div>
    </div>
  );
}

let deferredPrompt: { prompt: () => void; userChoice: Promise<unknown> } | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as unknown as typeof deferredPrompt;
});

export function Install() {
  const [ios] = useState(isIOS);
  const [installed, setInstalled] = useState(isStandalone);
  const [canPrompt, setCanPrompt] = useState(Boolean(deferredPrompt));
  useEffect(() => {
    const t = setInterval(() => setCanPrompt(Boolean(deferredPrompt)), 800);
    return () => clearInterval(t);
  }, []);
  const finish = async () => {
    await askNotifications();
    go('/', true);
  };
  return (
    <div className="screen">
      <TopBar
        right={
          <a className="txt" href={href('/')}>
            Ahora no
          </a>
        }
      />
      <div className="main">
        <span className="small mute">{ios ? 'Detectado: iPhone' : 'Detectado: Android u ordenador'}</span>
        <h1 className="h1" style={{ marginTop: 14, fontSize: 38 }}>
          {installed ? 'Activa los avisos' : ios ? 'Instálala en tu iPhone' : 'Instala la app'}
        </h1>
        <p className="lead" style={{ marginTop: 12 }}>
          {installed
            ? 'Así el aviso de fin de descanso te llega aunque bloquees el móvil.'
            : 'Así el aviso de fin de descanso te llega con el móvil bloqueado y la app funciona sin conexión.'}
        </p>
        {!installed && ios && (
          <ol style={{ margin: '24px 0 0', padding: 0, listStyle: 'none', borderTop: '1px solid var(--ink)' }}>
            {[
              ['Toca Compartir', 'El cuadrado con flecha, abajo en Safari', <IcShare key="i" />],
              ['«Añadir a pantalla de inicio»', 'Baja un poco en el menú si no lo ves', <IcAddHome key="i" />],
              ['Ábrela desde el icono', 'Y acepta los avisos cuando te lo pida', <IcBell key="i" />],
            ].map(([t, s, ic], i) => (
              <li key={i} style={{ display: 'grid', gridTemplateColumns: '36px minmax(0,1fr) 44px', columnGap: 10, alignItems: 'center', minHeight: 82, borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 28, fontWeight: 500, color: 'var(--accent-text)' }}>{i + 1}</span>
                <span className="col" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 17, fontWeight: 500 }}>{t}</span>
                  <span className="small mute">{s}</span>
                </span>
                <span style={{ width: 44, height: 44, border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ic}</span>
              </li>
            ))}
          </ol>
        )}
        {!installed && !ios && (
          <p className="small mute" style={{ marginTop: 20 }}>
            {canPrompt ? 'Pulsa «Instalar» y confirma.' : 'En Chrome: menú ⋮ › «Instalar aplicación» o «Añadir a pantalla de inicio».'}
          </p>
        )}
      </div>
      <div className="bottom">
        {!installed && !ios && canPrompt ? (
          <button
            type="button"
            className="btn"
            onClick={async () => {
              deferredPrompt?.prompt();
              await deferredPrompt?.userChoice;
              deferredPrompt = null;
              setInstalled(isStandalone());
              await finish();
            }}
          >
            Instalar
          </button>
        ) : (
          <button type="button" className="btn" onClick={finish}>
            {installed ? 'Activar avisos' : 'Ya la he añadido'}
          </button>
        )}
        <a className="txt" style={{ alignSelf: 'center' }} href={href('/')}>
          Seguir en el navegador
        </a>
      </div>
    </div>
  );
}
