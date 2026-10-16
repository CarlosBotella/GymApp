import { useRef, useState } from 'react';
import { useApp, useMe } from '../../lib/app';
import { deleteFile, getFile } from '../../lib/files';
import { useClientData } from '../../lib/hooks';
import { go, href } from '../../lib/router';
import type { BodyReport } from '../../lib/types';
import { CIRC_LABELS, COMPOSITION_LABELS, COMPOSITION_UNITS, POSTURE_LABELS } from '../../lib/visbody';
import { dateLong, dateShort, month, norm, time } from '../../lib/util';
import { RangeBar, num } from '../../ui/charts';
import { IcBack, IcChev, IcFile, IcUpload } from '../../ui/icons';
import { ClientNav, Loading, Seg, TopBar, toast } from '../../ui/kit';
import { ReportRow } from './progress';

const ORDER = ['peso', 'smm', 'bfp', 'grasaKg', 'visceral', 'masaMagra', 'masaMuscular', 'aguaTotal', 'proteina', 'tmb', 'imc', 'edadMetabolica', 'icc', 'sales', 'aguaIntra', 'aguaExtra', 'ecwTbw'];
const DEC: Record<string, number> = { ecwTbw: 3, icc: 2, tmb: 0, edadMetabolica: 0 };

function signedNum(v: number, dec: number): string {
  if (Math.abs(v) < 10 ** -dec / 2) return 'igual';
  return (v > 0 ? '+' : '−') + num(Math.abs(v), dec);
}

function changeLine(r: BodyReport, prev: BodyReport | undefined): string {
  if (!prev) return 'El primero';
  const parts: string[] = [];
  const d = (k: string) => (r.composition[k] && prev.composition[k] ? r.composition[k].value - prev.composition[k].value : null);
  const bf = d('bfp');
  const sm = d('smm');
  if (bf !== null) parts.push(`${signedNum(bf, 1)}${Math.abs(bf) >= 0.05 ? ' %' : ''} grasa`);
  if (sm !== null) parts.push(`${signedNum(sm, 1)}${Math.abs(sm) >= 0.05 ? ' kg' : ''} músculo`);
  return parts.length ? `${parts.join(' · ')} desde ${month(prev.date)}` : '';
}

/** Todos los informes Visbody subidos, del más nuevo al más antiguo */
export function BodyList() {
  const me = useMe();
  const d = useClientData(me.id, me);
  if (!d.ready) return <Loading />;
  const rs = d.reports;
  return (
    <div className="screen with-nav">
      <TopBar back="/progreso" backLabel="Progreso" />
      <div className="pad">
        <h1 className="h1" style={{ marginTop: 2, fontSize: 34 }}>Informes Visbody</h1>
        <p className="small mute" style={{ marginTop: 6 }}>
          {rs.length ? `${rs.length} ${rs.length === 1 ? 'informe' : 'informes'} · de ${month(rs[0].date)} ${new Date(rs[0].date).getFullYear()} a ${month(rs[rs.length - 1].date)} ${new Date(rs[rs.length - 1].date).getFullYear()}. Toca uno para verlo entero.` : 'Todavía no has subido ninguno.'}
        </p>
      </div>
      <div className="main" style={{ paddingTop: 10 }}>
        {rs.length > 0 && (
          <div className="sec">
            <span className="kicker">Del más nuevo al más antiguo</span>
            <span>puntuación</span>
          </div>
        )}
        {rs
          .map((r, i) => ({ r, sub: changeLine(r, rs[i - 1]) }))
          .reverse()
          .map(({ r, sub }) => (
            <ReportRow key={r.id} r={r} sub={sub} />
          ))}
      </div>
      <div className="bottom">
        <a className="btn2" href={href('/visbody')}>
          <IcUpload /> Subir informe
        </a>
      </div>
      <ClientNav active="progreso" />
    </div>
  );
}

const words = (t: string) => new Set(norm(t).split(' ').filter(Boolean));
/** La nota del PDF a veces repite el nombre con otras palabras en otro orden */
function sameWords(a: string, b: string): boolean {
  const A = words(a);
  const B = words(b);
  return [...A].every((w) => B.has(w)) && [...B].every((w) => A.has(w));
}

function ValueRow({ label, value, unit, delta, note, range, dec }: { label: string; value: number; unit: string; delta: string | null; note?: string; range?: [number, number] | null; dec: number }) {
  return (
    <div style={{ padding: '10px 0 8px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto 70px', columnGap: 10, alignItems: 'baseline' }}>
        <span style={{ fontSize: 15 }}>{label}</span>
        <span style={{ fontSize: 17, fontWeight: 600 }}>
          {num(value, dec)}
          {unit && <span className="xs mute" style={{ fontWeight: 400 }}> {unit}</span>}
        </span>
        <span className="small mute" style={{ textAlign: 'right' }}>{delta ?? '—'}</span>
      </div>
      {range && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 80px', columnGap: 10, alignItems: 'center', marginTop: 4 }}>
          <RangeBar value={value} min={range[0]} max={range[1]} dec={dec} />
          <span className="xs mute" style={{ textAlign: 'right' }}>
            {num(range[0], dec)}–{num(range[1], dec)}
          </span>
        </div>
      )}
      {note && !sameWords(note, label) && <span className="xs mute">{note}</span>}
    </div>
  );
}

function More({ total, shown, open, onToggle }: { total: number; shown: number; open: boolean; onToggle: () => void }) {
  if (total <= shown) return null;
  return (
    <button type="button" className="txt accent" style={{ fontSize: 14, minHeight: 44, alignSelf: 'flex-start' }} onClick={onToggle}>
      {open ? 'Ver menos' : `Ver ${total - shown === 1 ? 'el restante' : `los ${total - shown} restantes`}`}
    </button>
  );
}

/** Un informe Visbody entero; flechas o deslizar para pasar al anterior o al siguiente */
export function BodyReportView({ id }: { id: string }) {
  const { store } = useApp();
  const me = useMe();
  const d = useClientData(me.id, me);
  const [cmp, setCmp] = useState<'prev' | 'first'>('prev');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const touch = useRef<{ x: number; y: number } | null>(null);
  if (!d.ready) return <Loading />;
  const rs = d.reports;
  const i = rs.findIndex((r) => r.id === id);
  const r = rs[i];
  if (!r)
    return (
      <div className="screen with-nav">
        <TopBar back="/cuerpo" backLabel="Informes" />
        <div className="main">
          <p className="lead" style={{ marginTop: 20 }}>No encuentro este informe. Puede que lo hayas borrado.</p>
        </div>
        <ClientNav active="progreso" />
      </div>
    );
  const prev = rs[i - 1];
  const next = rs[i + 1];
  const base = cmp === 'first' ? (i > 0 ? rs[0] : undefined) : prev;
  const goTo = (x: BodyReport | undefined) => x && go(`/cuerpo/${x.id}`, true);
  const keys = ORDER.filter((k) => r.composition[k]).concat(Object.keys(r.composition).filter((k) => !ORDER.includes(k)));
  const postureKeys = Object.keys(POSTURE_LABELS).filter((k) => r.posture[k]).concat(Object.keys(r.posture).filter((k) => !(k in POSTURE_LABELS)));
  const circKeys = Object.keys(CIRC_LABELS).filter((k) => r.circumferences[k] !== undefined);
  const delta = (cur: number | undefined, old: number | undefined, dec: number) => (cur === undefined || old === undefined ? null : signedNum(cur - old, dec));
  const showN = (k: string, n0: number, total: number) => (open[k] ? total : n0);

  const openPdf = async () => {
    const b = await getFile(`visbody/${r.id}`);
    if (!b) return toast('El PDF original no está en este móvil');
    const url = URL.createObjectURL(b);
    const w = window.open(url, '_blank');
    if (!w) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `Visbody ${r.dateStr || dateLong(r.date)}.pdf`;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  const remove = async () => {
    if (!confirm(`¿Borrar el informe del ${dateLong(r.date)}? Se quita de tu historial${me.trainerId ? ' y de lo que ve tu entrenador' : ''}. No se puede deshacer.`)) return;
    await store.remove('bodyReports', r.id);
    await deleteFile(`visbody/${r.id}`);
    toast('Informe borrado');
    go(rs.length > 1 ? '/cuerpo' : '/progreso', true);
  };

  return (
    <div
      className="screen with-nav"
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const t = touch.current;
        touch.current = null;
        if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x;
        const dy = e.changedTouches[0].clientY - t.y;
        if (Math.abs(dx) > 70 && Math.abs(dy) < 50) goTo(dx > 0 ? prev : next);
      }}
    >
      <TopBar
        back="/cuerpo"
        backLabel="Informes"
        right={
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button type="button" className="icon-btn" aria-label={prev ? `Informe anterior, ${dateLong(prev.date)}` : 'No hay informe anterior'} disabled={!prev} onClick={() => goTo(prev)}>
              <IcBack />
            </button>
            <span className="small mute" style={{ minWidth: 48, textAlign: 'center' }}>
              {i + 1} de {rs.length}
            </span>
            <button type="button" className="icon-btn" aria-label={next ? `Informe siguiente, ${dateLong(next.date)}` : 'No hay informe siguiente'} disabled={!next} onClick={() => goTo(next)}>
              <IcChev />
            </button>
          </span>
        }
      />
      <div className="pad">
        <h1 className="h1" style={{ marginTop: 4, fontSize: 38 }}>{dateLong(r.date)}</h1>
        <p className="small mute" style={{ marginTop: 6 }}>{time(r.date)} · fecha leída del PDF</p>
      </div>
      <div className="main" style={{ paddingBottom: 28 }}>
        <div className="grid2" style={{ marginTop: 14, borderTop: '1px solid var(--ink)', borderBottom: '1px solid var(--line)', padding: '12px 0' }}>
          {[
            ['Puntuación', r.score, base?.score],
            ['Postura', r.postureScore, base?.postureScore],
          ].map(([t, v, o]) => (
            <div key={t as string} className="stack" style={{ gap: 2 }}>
              <span className="xs mute">{t}</span>
              <span className="stat" style={{ fontSize: 36 }}>
                {v ?? '—'}
                {v !== null && v !== undefined && <span className="small mute" style={{ fontWeight: 400 }}> / 100</span>}
              </span>
              <span className="xs mute">{typeof v === 'number' && typeof o === 'number' ? `${signedNum(v - o, 0)} desde ${dateShort(base!.date)}` : base ? 'sin dato anterior' : 'primera medida'}</span>
            </div>
          ))}
        </div>

        {i > 0 && (
          <div style={{ marginTop: 12 }}>
            <span className="xs mute">Comparar con</span>
            <Seg
              value={cmp}
              onChange={setCmp}
              label="Comparar con"
              options={[
                ['prev', `El anterior · ${dateShort(prev.date)}`],
                ['first', `El primero · ${month(rs[0].date)} ${String(new Date(rs[0].date).getFullYear()).slice(2)}`],
              ]}
            />
          </div>
        )}

        <div className="sec" style={{ marginTop: 18 }}>
          <span className="kicker">Composición</span>
          <span>{keys.length} datos{base ? ` · vs ${dateShort(base.date)}` : ''}</span>
        </div>
        {keys.slice(0, showN('comp', 8, keys.length)).map((k) => {
          const v = r.composition[k];
          const dec = DEC[k] ?? 1;
          return (
            <ValueRow
              key={k}
              label={COMPOSITION_LABELS[k] || k}
              value={v.value}
              unit={COMPOSITION_UNITS[k] || ''}
              dec={dec}
              delta={base ? delta(v.value, base.composition[k]?.value, dec) : null}
              range={v.min !== undefined && v.max !== undefined ? [v.min, v.max] : null}
            />
          );
        })}
        <More total={keys.length} shown={8} open={!!open.comp} onToggle={() => setOpen({ ...open, comp: !open.comp })} />

        {postureKeys.length > 0 && (
          <>
            <div className="sec" style={{ marginTop: 22 }}>
              <span className="kicker">Postura</span>
              <span>{postureKeys.length} datos</span>
            </div>
            {postureKeys.slice(0, showN('post', 4, postureKeys.length)).map((k) => {
              const v = r.posture[k];
              return <ValueRow key={k} label={POSTURE_LABELS[k] || k} value={v.value} unit={v.unit} dec={1} note={v.note} delta={base ? delta(v.value, base.posture[k]?.value, 1) : null} />;
            })}
            <More total={postureKeys.length} shown={4} open={!!open.post} onToggle={() => setOpen({ ...open, post: !open.post })} />
          </>
        )}

        {circKeys.length > 0 && (
          <>
            <div className="sec" style={{ marginTop: 22 }}>
              <span className="kicker">Perímetros</span>
              <span>{circKeys.length} datos</span>
            </div>
            {circKeys.slice(0, showN('circ', 4, circKeys.length)).map((k) => (
              <ValueRow key={k} label={CIRC_LABELS[k]} value={r.circumferences[k]} unit="cm" dec={1} delta={base ? delta(r.circumferences[k], base.circumferences[k], 1) : null} />
            ))}
            <More total={circKeys.length} shown={4} open={!!open.circ} onToggle={() => setOpen({ ...open, circ: !open.circ })} />
          </>
        )}

        <div className="sec" style={{ marginTop: 22 }}>
          <span className="kicker">Este informe</span>
        </div>
        <button type="button" className="row" style={{ gridTemplateColumns: '28px minmax(0,1fr) 18px', width: '100%', textAlign: 'left' }} onClick={openPdf}>
          <IcFile width={18} height={18} />
          <span className="col">
            <span className="t">Ver el PDF original</span>
            <span className="s">Guardado solo en el móvil donde lo subiste</span>
          </span>
          <IcChev className="chev" />
        </button>
        <button type="button" className="row" style={{ gridTemplateColumns: '28px minmax(0,1fr)', width: '100%', textAlign: 'left', color: 'var(--accent-text)' }} onClick={remove}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />
          </svg>
          <span className="col">
            <span className="t">Borrar este informe</span>
            <span className="s">Se quita de tu historial{me.trainerId ? ' y de lo que ve tu entrenador' : ''}</span>
          </span>
        </button>
        <p className="xs mute" style={{ marginTop: 12 }}>Desliza a los lados para pasar al informe anterior o al siguiente.</p>
      </div>
      <ClientNav active="progreso" />
    </div>
  );
}
