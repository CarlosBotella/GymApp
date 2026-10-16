import { useState } from 'react';
import { useApp, useDoc, useMe } from '../../lib/app';
import { exportCsv, exportXlsx, bodyRows, workoutRows } from '../../lib/exporter';
import { getFile } from '../../lib/files';
import { useClientData } from '../../lib/hooks';
import { go } from '../../lib/router';
import { periodStart } from '../../lib/stats';
import type { Profile } from '../../lib/types';
import { download } from '../../lib/util';
import { IcCheck } from '../../ui/icons';
import { Loading, Seg, TopBar, toast } from '../../ui/kit';
import { RoleNav } from '../../ui/rolenav';

type Fmt = 'pdf' | 'xlsx' | 'csv';

export function Export({ clientId }: { clientId: string }) {
  useApp();
  const me = useMe();
  const client = useDoc<Profile>('users', clientId);
  const d = useClientData(clientId, me);
  const [wk, setWk] = useState(true);
  const [body, setBody] = useState(true);
  const [orig, setOrig] = useState(false);
  const [p, setP] = useState<'3m' | 'ano' | 'todo'>('3m');
  const [fmt, setFmt] = useState<Fmt>('pdf');
  if (!d.ready || client === undefined) return <Loading />;
  const name = `gymapp-${(client?.name || 'cliente').toLowerCase().replace(/\s+/g, '-')}`;
  const since = periodStart(p);
  const run = async () => {
    if (fmt === 'pdf') {
      go(`/informe/${clientId}?periodo=${p}&imprimir=1`);
      return;
    }
    const sheets = [];
    if (wk) sheets.push({ name: 'Entrenamientos', rows: workoutRows(d.workouts.filter((w) => w.startedAt >= since)) });
    if (body) sheets.push({ name: 'Cuerpo', rows: bodyRows(d.reports.filter((r) => r.date >= since || p === 'todo')) });
    if (!sheets.length && !orig) return toast('Elige qué incluir');
    if (sheets.length) (fmt === 'xlsx' ? exportXlsx : exportCsv)(name, sheets);
    if (orig) {
      let k = 0;
      for (const r of d.reports) {
        const f = await getFile(`visbody/${r.id}`);
        if (f) {
          download(`visbody-${r.dateStr.slice(0, 10)}.pdf`, f, 'application/pdf');
          k++;
        }
      }
      if (!k) toast('Los PDF originales solo están en el móvil donde los subiste');
    }
  };
  const Check = ({ on, set, t, s }: { on: boolean; set: (v: boolean) => void; t: string; s: string }) => (
    <label className="row" style={{ gridTemplateColumns: '30px minmax(0,1fr)', cursor: 'pointer', minHeight: 52 }}>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
      <span className="col">
        <span className="t">{t}</span>
        <span className="xs mute">{s}</span>
      </span>
    </label>
  );
  return (
    <div className="screen with-nav">
      <TopBar back={me.id === clientId ? '/progreso' : `/cliente/${clientId}`} backLabel={me.id === clientId ? 'Progreso' : client?.name || 'Cliente'} />
      <div className="main">
        <h1 className="h1" style={{ marginTop: 4 }}>Exportar</h1>
        {me.id !== clientId && <p className="small mute" style={{ marginTop: 6 }}>Datos de {client?.name}</p>}
        <span className="kicker" style={{ marginTop: 20 }}>Qué incluir</span>
        <Check on={wk} set={setWk} t="Entrenamientos" s="Sesiones, series, pesos y sensaciones" />
        <Check on={body} set={setBody} t="Cuerpo" s="Informes Visbody: composición, postura, perímetros" />
        {me.id === clientId && <Check on={orig} set={setOrig} t="PDFs originales" s="Los informes tal como los subiste" />}
        <span className="kicker" style={{ marginTop: 18 }}>Periodo</span>
        <Seg value={p} onChange={setP} label="Periodo" options={[['3m', '3 meses'], ['ano', 'Año'], ['todo', 'Todo']]} />
        <span className="kicker" style={{ marginTop: 14 }}>Formato</span>
        <div role="radiogroup" aria-label="Formato">
          {(
            [
              ['pdf', 'Informe PDF', 'Con gráficas, para leer o imprimir'],
              ['xlsx', 'Excel', 'Una hoja por tipo de dato, una fila por serie'],
              ['csv', 'CSV', 'Para otras apps'],
            ] as [Fmt, string, string][]
          ).map(([k, t, s]) => (
            <button key={k} type="button" role="radio" aria-checked={fmt === k} className="row" onClick={() => setFmt(k)}>
              <span className="col">
                <span className="t" style={fmt === k ? { color: 'var(--accent-text)', fontWeight: 600 } : undefined}>{t}</span>
                <span className="xs mute">{s}</span>
              </span>
              {fmt === k ? <IcCheck style={{ color: 'var(--accent-text)' }} /> : <span />}
            </button>
          ))}
        </div>
      </div>
      <div className="bottom">
        <button type="button" className="btn" onClick={run}>
          {fmt === 'pdf' ? 'Abrir informe para guardar en PDF' : fmt === 'xlsx' ? 'Descargar Excel' : 'Descargar CSV'}
        </button>
      </div>
      <RoleNav client="progreso" trainer="clientes" />
    </div>
  );
}
