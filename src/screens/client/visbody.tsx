import { useRef, useState } from 'react';
import { useApp, useMe } from '../../lib/app';
import { putFile } from '../../lib/files';
import { useClientData } from '../../lib/hooks';
import { go } from '../../lib/router';
import type { BodyReport } from '../../lib/types';
import { dateLong, n, time } from '../../lib/util';
import { CIRC_LABELS, COMPOSITION_LABELS, COMPOSITION_UNITS, POSTURE_LABELS, extractPdf, parseVisbody, type ParsedBody } from '../../lib/visbody';
import { IcCheck, IcDown, IcFile, IcUp, IcUpload } from '../../ui/icons';
import { Loading, TopBar, toast } from '../../ui/kit';
import { RoleNav } from '../../ui/rolenav';

interface Item {
  file: File;
  parsed: ParsedBody | null;
  error: string | null;
  fixes: Record<string, number | null>;
  date: number | null;
}

const MAIN_KEYS = ['peso', 'smm', 'masaMuscular', 'bfp', 'grasaKg', 'visceral', 'masaMagra', 'aguaTotal', 'tmb', 'imc'];

export function VisbodyImport() {
  const { store } = useApp();
  const me = useMe();
  const d = useClientData(me.id, me);
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string>('comp');
  const [editDate, setEditDate] = useState(false);

  if (!d.ready) return <Loading />;

  const pick = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(true);
    const out: Item[] = [];
    for (const f of Array.from(files)) {
      try {
        const pages = await extractPdf(await f.arrayBuffer());
        const parsed = parseVisbody(pages);
        out.push({ file: f, parsed, error: parsed.isVisbody ? null : 'Este PDF no parece un informe de Visbody.', fixes: {}, date: parsed.date });
      } catch (e) {
        console.error(e);
        out.push({ file: f, parsed: null, error: 'No he podido leer este PDF.', fixes: {}, date: null });
      }
    }
    out.sort((a, b) => (a.date || 0) - (b.date || 0));
    setItems(out);
    setIdx(0);
    setBusy(false);
  };

  const cur = items[idx];
  const dup = cur?.date ? d.reports.find((r) => Math.abs(r.date - cur.date!) < 60000) : undefined;
  const isOldest = cur?.date && d.reports.length ? cur.date < d.reports[0].date : false;

  const next = () => {
    if (idx + 1 < items.length) {
      setIdx(idx + 1);
      setOpen('comp');
      setEditDate(false);
    } else {
      toast(items.length > 1 ? 'Informes guardados en tu historial' : 'Informe guardado en tu historial');
      go('/cuerpo', true);
    }
  };

  const save = async () => {
    if (!cur?.parsed || !cur.date) return;
    const p = cur.parsed;
    const comp = { ...p.composition };
    for (const [k, v] of Object.entries(cur.fixes)) {
      if (v === null) delete comp[k];
      else comp[k] = { ...(comp[k] || {}), value: v };
    }
    const id = `${me.id}_${cur.date}`;
    const r: BodyReport = {
      id,
      clientId: me.id,
      trainerId: me.shareBody && me.trainerId ? me.trainerId : null,
      date: cur.date,
      dateStr: p.dateStr || dateLong(cur.date),
      score: p.score,
      postureScore: p.postureScore,
      height: p.height,
      composition: comp,
      posture: p.posture,
      circumferences: p.circumferences,
      segmental: p.segmental,
      createdAt: Date.now(),
    };
    await store.set('bodyReports', id, r);
    void putFile(`visbody/${id}`, cur.file).catch(() => undefined);
    next();
  };

  if (!items.length)
    return (
      <div className="screen with-nav">
        <TopBar back="/progreso" backLabel="Progreso" />
        <div className="main">
          <span className="kicker accent" style={{ marginTop: 10 }}>Informe Visbody</span>
          <h1 className="h1" style={{ marginTop: 8, fontSize: 36 }}>Sube el PDF</h1>
          <p className="lead" style={{ marginTop: 12 }}>
            Leo la fecha del propio informe y saco la composición corporal, la postura y los perímetros. Valen informes antiguos: cada uno va a su fecha del historial.
          </p>
          <p className="small mute" style={{ marginTop: 12 }}>Puedes elegir varios a la vez. El PDF original se guarda solo en este dispositivo.</p>
          <input ref={input} type="file" accept="application/pdf,.pdf" multiple className="sr" onChange={(e) => pick(e.target.files)} />
        </div>
        <div className="bottom">
          <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Leyendo…' : (
              <>
                <IcUpload /> Elegir PDF
              </>
            )}
          </button>
        </div>
        <RoleNav client="progreso" />
      </div>
    );

  if (!cur.parsed || cur.error)
    return (
      <div className="screen with-nav">
        <TopBar back="/progreso" backLabel="Progreso" right={<span className="small mute">{idx + 1} de {items.length}</span>} />
        <div className="main">
          <span className="kicker accent" style={{ marginTop: 10 }}>No se ha guardado</span>
          <h1 className="h1" style={{ marginTop: 8, fontSize: 32 }}>{cur.error}</h1>
          <p className="small mute" style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <IcFile /> {cur.file.name}
          </p>
          <p className="lead" style={{ marginTop: 16, fontSize: 15 }}>Comprueba que es el informe que da la máquina Visbody (en español), no una captura o una foto.</p>
        </div>
        <div className="bottom">
          <button type="button" className="btn" onClick={next}>
            {idx + 1 < items.length ? 'Siguiente PDF' : 'Volver'}
          </button>
        </div>
        <RoleNav client="progreso" />
      </div>
    );

  const p = cur.parsed;
  const issues = p.issues.filter((i) => i.key !== 'date' || !cur.date);
  const needsReview = issues.length > 0;
  const allComp = Object.keys(p.composition);
  const shown = MAIN_KEYS.filter((k) => p.composition[k] || cur.fixes[k] !== undefined);
  const Section = ({ id, title, count, preview, children }: { id: string; title: string; count: number; preview: string; children: React.ReactNode }) => (
    <>
      <button type="button" aria-expanded={open === id} onClick={() => setOpen(open === id ? '' : id)} style={{ background: 'none', border: 0, borderTop: '1px solid var(--ink)', padding: '8px 0', width: '100%', textAlign: 'left', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', columnGap: 12, alignItems: 'center', minHeight: 50 }}>
        <span className="stack" style={{ gap: 2 }}>
          <span className="b">{title}</span>
          {open !== id && <span className="small mute">{preview}</span>}
        </span>
        <span className="small mute" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {count} {open === id ? <IcUp /> : <IcDown />}
        </span>
      </button>
      {open === id && children}
    </>
  );

  return (
    <div className="screen with-nav">
      <TopBar back="/progreso" backLabel="Progreso" right={<span className="small mute" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><IcFile /> {items.length > 1 ? `${idx + 1} de ${items.length} PDFs` : 'Informe Visbody'}</span>} />
      <div className="pad">
        <span className="kicker accent" style={{ display: 'block', marginTop: 6 }}>{needsReview ? 'Necesita tu ojo' : 'Leído · revisa y guarda'}</span>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginTop: 6 }}>
          <div className="stack" style={{ gap: 4 }}>
            {editDate ? (
              <input
                type="datetime-local"
                className="input"
                aria-label="Fecha del informe"
                defaultValue={cur.date ? new Date(cur.date - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                onChange={(e) => {
                  const ms = new Date(e.target.value).getTime();
                  if (!Number.isNaN(ms)) setItems(items.map((x, i) => (i === idx ? { ...x, date: ms } : x)));
                }}
              />
            ) : (
              <h1 className="h1" style={{ fontSize: 34 }}>{cur.date ? dateLong(cur.date) : 'Sin fecha'}</h1>
            )}
            <span className="small mute">{cur.date ? `${time(cur.date)} · ${p.date === cur.date ? 'fecha tomada del PDF' : 'fecha corregida a mano'}` : 'No encuentro la fecha en el PDF: escríbela'}</span>
          </div>
          <button type="button" className="txt u" style={{ fontSize: 14 }} onClick={() => setEditDate(!editDate)}>
            {editDate ? 'Hecho' : 'Cambiar fecha'}
          </button>
        </div>
        {dup ? (
          <p className="small accent-t" style={{ marginTop: 10 }}>Ya tenías este informe ({dateLong(dup.date)}). Si lo guardas, se reemplaza; no se duplica.</p>
        ) : (
          <p className="small mute" style={{ marginTop: 10 }}>{isOldest ? 'Es anterior a todos tus informes: irá al principio del historial y las gráficas se recalculan.' : 'Cada informe se coloca en su fecha del historial.'}</p>
        )}
      </div>
      <div className="main" style={{ paddingTop: 14 }}>
        {issues.map((i) => (
          <div key={i.key} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)', borderTop: '1px solid var(--line)' }}>
            <div className="row-actions" style={{ alignItems: 'baseline' }}>
              <span className="b">{i.label}</span>
              <span className="xs b accent-t">{i.kind === 'missing' ? 'No se pudo leer' : 'Parece mal leído'}</span>
            </div>
            {i.kind === 'suspicious' && <p className="small mute" style={{ marginTop: 4 }}>El PDF dice «{n(i.read!, 2)}». {i.guess ? `¿Era ${n(i.guess, 1)}?` : ''}</p>}
            {i.key !== 'date' && (
              <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                {i.guess && (
                  <button type="button" className="txt accent" onClick={() => setItems(items.map((x, k) => (k === idx ? { ...x, fixes: { ...x.fixes, [i.key]: i.guess! } } : x)))}>
                    {cur.fixes[i.key] === i.guess ? <IcCheck /> : null} Sí, {n(i.guess, 1)}
                  </button>
                )}
                <label className="sr" htmlFor={`fix-${i.key}`}>Valor de {i.label}</label>
                <input
                  id={`fix-${i.key}`}
                  className="input"
                  inputMode="decimal"
                  placeholder="Escribe el valor del PDF"
                  style={{ fontSize: 16, height: 44, maxWidth: 200 }}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value.replace(',', '.'));
                    setItems(items.map((x, k) => (k === idx ? { ...x, fixes: { ...x.fixes, [i.key]: Number.isNaN(v) ? undefined! : v } } : x)));
                  }}
                />
                <button type="button" className="txt mute" onClick={() => setItems(items.map((x, k) => (k === idx ? { ...x, fixes: { ...x.fixes, [i.key]: null } } : x)))}>
                  Dejarlo vacío
                </button>
              </div>
            )}
          </div>
        ))}

        <Section id="comp" title="Composición corporal" count={allComp.length} preview={`Peso ${n(p.composition.peso?.value)} kg · grasa ${n(p.composition.bfp?.value)} %`}>
          <dl className="grid2" style={{ margin: 0 }}>
            {shown.map((k) => {
              const v = cur.fixes[k] !== undefined ? cur.fixes[k] : p.composition[k]?.value;
              return (
                <div key={k} style={{ padding: '7px 0', borderTop: '1px solid var(--line)' }}>
                  <dt className="xs mute">{COMPOSITION_LABELS[k]}</dt>
                  <dd style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>
                    {v === null || v === undefined ? '—' : `${n(v, k === 'ecwTbw' ? 2 : 1)} ${COMPOSITION_UNITS[k]}`}
                  </dd>
                </div>
              );
            })}
            {p.score !== null && (
              <div style={{ padding: '7px 0', borderTop: '1px solid var(--line)' }}>
                <dt className="xs mute">Puntuación</dt>
                <dd style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>{p.score}</dd>
              </div>
            )}
          </dl>
        </Section>
        <Section id="post" title={`Postura${p.postureScore !== null ? ` · ${p.postureScore}` : ''}`} count={Object.keys(p.posture).length} preview={Object.entries(p.posture).slice(0, 2).map(([k, v]) => `${POSTURE_LABELS[k]} ${n(v.value)}${v.unit}`).join(' · ') || 'Sin datos'}>
          {Object.entries(p.posture).map(([k, v]) => (
            <div key={k} className="row" style={{ minHeight: 48 }}>
              <span className="col">
                <span className="m" style={{ fontSize: 15 }}>{POSTURE_LABELS[k]}</span>
                {v.note && <span className="xs mute">{v.note}</span>}
              </span>
              <span>{n(v.value)} {v.unit}</span>
            </div>
          ))}
        </Section>
        <Section id="circ" title="Perímetros" count={Object.keys(p.circumferences).length} preview={Object.entries(p.circumferences).slice(0, 2).map(([k, v]) => `${CIRC_LABELS[k]} ${n(v)} cm`).join(' · ') || 'Sin datos'}>
          <dl className="grid2" style={{ margin: 0 }}>
            {Object.entries(p.circumferences).map(([k, v]) => (
              <div key={k} style={{ padding: '7px 0', borderTop: '1px solid var(--line)' }}>
                <dt className="xs mute">{CIRC_LABELS[k]}</dt>
                <dd style={{ margin: 0, fontSize: 17, fontWeight: 500 }}>{n(v)} cm</dd>
              </div>
            ))}
          </dl>
        </Section>
        <div style={{ borderTop: '1px solid var(--ink)' }} />
      </div>
      <div className="bottom">
        <button type="button" className="btn" disabled={!cur.date} onClick={save}>
          {needsReview ? 'Guardar y seguir' : 'Guardar en mi historial'}
        </button>
        <button type="button" className="txt" style={{ alignSelf: 'center' }} onClick={next}>
          {idx + 1 < items.length ? 'Descartar este PDF' : 'Descartar'}
        </button>
      </div>
      <RoleNav client="progreso" />
    </div>
  );
}
