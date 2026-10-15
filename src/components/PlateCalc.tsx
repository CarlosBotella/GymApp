import { useEffect, useState } from 'react';
import { PLATES } from '../data/catalog';
import { fmtKg, parseNum } from '../lib/util';
import { Sheet } from './ui';

/** Calculadora de discos: tocas los discos de UN lado y suma ambos lados + la palanca. */
export function PlateCalc({ open, onClose, base, onUse }: { open: boolean; onClose(): void; base: number; onUse(kg: number): void }) {
  const [side, setSide] = useState<number[]>([]);
  const [baseStr, setBaseStr] = useState(String(base));
  useEffect(() => {
    if (open) { setSide([]); setBaseStr(String(base)); }
  }, [open, base]);

  const total = (parseNum(baseStr) ?? 0) + side.reduce((a, b) => a + b, 0) * 2;

  return (
    <Sheet open={open} onClose={onClose} title="Discos por lado">
      <div className="plate-total" aria-live="polite">{fmtKg(total)} kg</div>
      <p className="muted small" style={{ textAlign: 'center', margin: '0 0 14px', minHeight: 20 }}>
        {side.length ? `Cada lado: ${side.map(fmtKg).join(' + ')}` : 'Toca los discos que pones en un lado'}
      </p>
      <div className="plates">
        {PLATES.map((p) => (
          <button key={p} onClick={() => setSide([...side, p])}>{fmtKg(p)}</button>
        ))}
        <button onClick={() => setSide(side.slice(0, -1))} aria-label="Quitar el último disco" style={{ fontFamily: 'var(--body)', fontSize: 15 }}>Quitar</button>
      </div>
      <label className="field" style={{ marginTop: 14 }}>
        <span>Peso de la palanca o barra (kg)</span>
        <input className="input" inputMode="decimal" value={baseStr} onChange={(e) => setBaseStr(e.target.value)} />
      </label>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn ghost grow" onClick={() => setSide([])}>Vaciar</button>
        <button className="btn primary grow" onClick={() => { onUse(total); onClose(); }}>Usar {fmtKg(total)} kg</button>
      </div>
    </Sheet>
  );
}
