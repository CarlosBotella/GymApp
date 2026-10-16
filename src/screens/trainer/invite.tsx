import { useState } from 'react';
import { useApp, useMe, useQuery } from '../../lib/app';
import { createInvite } from '../../lib/api';
import type { Invite as Inv } from '../../lib/types';
import { dateShort } from '../../lib/util';
import { Seg, TopBar, TrainerNav, toast } from '../../ui/kit';

function link(code: string) {
  return new URL(`#/unirse/${code}`, document.baseURI.split('#')[0]).href;
}

export function Invite() {
  const { store } = useApp();
  const me = useMe();
  const [name, setName] = useState('');
  const [days, setDays] = useState('3');
  const [inv, setInv] = useState<Inv | null>(null);
  const [busy, setBusy] = useState(false);
  const open = useQuery<Inv>('invites', [['trainerId', me.id]]);
  const pending = (open || []).filter((i) => !i.usedBy && i.expiresAt > Date.now()).sort((a, b) => b.createdAt - a.createdAt);
  const make = async () => {
    setBusy(true);
    const i = await createInvite(store, me, name.trim() || 'Cliente', +days);
    setInv(i);
    setBusy(false);
  };
  const text = inv ? `${inv.clientName}, te invito a entrenar conmigo en GymApp: ${link(inv.id)} (código ${inv.id})` : '';
  return (
    <div className="screen with-nav">
      <TopBar back="/clientes" backLabel="Clientes" />
      <div className="main">
        <h1 className="h1" style={{ marginTop: 2, fontSize: 34 }}>Invita a un cliente</h1>
        {!inv ? (
          <>
            <div className="field" style={{ marginTop: 18 }}>
              <label htmlFor="cn">Nombre</label>
              <input id="cn" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Carlos" />
            </div>
            <span className="xs mute" style={{ marginTop: 16 }}>Días que entrena (para proponerle rutinas)</span>
            <Seg value={days} onChange={setDays} label="Días por semana" options={[['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']]} />
            <p className="small mute" style={{ marginTop: 16 }}>Al unirse, decide qué datos comparte contigo. Sus datos de cuerpo solo los verás si él lo acepta.</p>
            {pending.length > 0 && (
              <>
                <div className="sec">
                  <span className="kicker">Invitaciones abiertas</span>
                  <span>{pending.length}</span>
                </div>
                {pending.map((p) => (
                  <button key={p.id} type="button" className="row" onClick={() => setInv(p)}>
                    <span className="col">
                      <span className="t">{p.clientName}</span>
                      <span className="s">Código {p.id} · caduca el {dateShort(p.expiresAt)}</span>
                    </span>
                    <span className="small accent-t b">Ver</span>
                  </button>
                ))}
              </>
            )}
          </>
        ) : (
          <>
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--ink)' }}>
              <span className="xs mute">Código para {inv.clientName}</span>
              <p style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 40, fontWeight: 500, letterSpacing: '0.04em', marginTop: 4 }}>{inv.id}</p>
              <p className="xs mute" style={{ marginTop: 4 }}>Que abra el enlace o, ya con cuenta, lo escriba en la app. Caduca el {dateShort(inv.expiresAt)}.</p>
            </div>
            <div className="row" style={{ marginTop: 16, borderTop: '1px solid var(--line)' }}>
              <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link(inv.id)}</span>
              <button
                type="button"
                className="txt accent"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link(inv.id));
                    toast('Enlace copiado');
                  } catch {
                    toast('No se pudo copiar');
                  }
                }}
              >
                Copiar
              </button>
            </div>
            <button type="button" className="txt" onClick={() => setInv(null)}>
              Invitar a otra persona
            </button>
          </>
        )}
      </div>
      <div className="bottom">
        {!inv ? (
          <button type="button" className="btn" disabled={busy} onClick={make}>
            Crear invitación
          </button>
        ) : (
          <>
            <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
              Enviar por WhatsApp
            </a>
            {'share' in navigator && (
              <button type="button" className="txt" style={{ alignSelf: 'center' }} onClick={() => navigator.share({ text, url: link(inv.id) }).catch(() => undefined)}>
                Otras apps…
              </button>
            )}
          </>
        )}
      </div>
      <TrainerNav active="clientes" />
    </div>
  );
}
