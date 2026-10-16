import { useMemo, useRef, useState } from 'react';
import { DAY_GROUP_NAMES, ex } from '../../data/catalog';
import { buildDraft, type Draft } from '../../lib/quicknotes';
import type { RoutineDay } from '../../lib/types';
import { n } from '../../lib/util';
import { IcPlay } from '../../ui/icons';

// Editor «como en tus notas»: se escribe libre y debajo se ve cómo queda.
export function NotesEditor({
  text,
  setText,
  choices,
  setChoices,
  lastWeight,
  prevDays,
  audience,
}: {
  text: string;
  setText: (t: string) => void;
  choices: Record<number, string>;
  setChoices: (c: Record<number, string>) => void;
  lastWeight: (id: string) => number | null;
  prevDays?: RoutineDay[];
  audience: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const draft: Draft = useMemo(() => buildDraft(text, choices, lastWeight, {}, prevDays), [text, choices, lastWeight, prevDays]);
  const [caret, setCaret] = useState(0);
  const total = draft.days.reduce((a, d) => a + d.exercises.reduce((b, p) => b + p.sets, 0), 0);
  const count = draft.days.reduce((a, d) => a + d.exercises.length, 0);
  const insert = (s: string) => {
    const el = ref.current;
    if (!el) return;
    const a = el.selectionStart ?? text.length;
    const b = el.selectionEnd ?? text.length;
    const next = text.slice(0, a) + s + text.slice(b);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + s.length, a + s.length);
    });
  };
  const lineAtCaret = text.slice(0, caret).split('\n').length - 1;

  return (
    <>
      <label htmlFor="notas" className="kicker" style={{ display: 'block' }}>
        Escribe como en tus notas
      </label>
      <textarea
        id="notas"
        ref={ref}
        className="notes"
        rows={Math.max(5, Math.min(12, text.split('\n').length + 1))}
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCaret(e.target.selectionStart || 0);
        }}
        onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart || 0)}
        placeholder={'Pierna:\nprensa 4x10 120\nbulgara 3x10 2x16\ncurl fem 3x12 40'}
        style={{ marginTop: 6 }}
      />
      <div role="toolbar" aria-label="Atajos de escritura" className="grid3" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))', borderBottom: '1px solid var(--line)' }}>
        {[
          ['×', 'x', 'Insertar por'],
          ['kg', ' kg', 'Insertar kg'],
          ['Igual', ' igual', 'Igual que el ejercicio anterior'],
          ['Nuevo día', '\nDía:\n', 'Empezar un día nuevo'],
        ].map(([t, ins, aria], i) => (
          <button key={t} type="button" aria-label={aria} onClick={() => insert(ins)} style={{ background: 'none', border: 0, borderLeft: i ? '1px solid var(--line)' : 0, height: 46, fontSize: 15, color: i === 3 ? 'var(--accent-text)' : undefined, fontWeight: i === 3 ? 600 : 400 }}>
            {t}
          </button>
        ))}
      </div>

      <div className="sec" style={{ marginTop: 18 }}>
        <span className="kicker">Así lo verá {audience}</span>
        <span>
          {count} ejercicios · {total} series
        </span>
      </div>
      {draft.days.length === 0 && <p className="small mute" style={{ padding: '14px 0' }}>Escribe arriba: un ejercicio por línea.</p>}
      {draft.days.map((d, di) => (
        <div key={d.id}>
          {draft.days.length > 1 && (
            <div style={{ padding: '12px 0 4px', display: 'flex', justifyContent: 'space-between' }}>
              <span className="b">{d.name}</span>
              <span className="xs mute">{DAY_GROUP_NAMES[d.group]}</span>
            </div>
          )}
          {draft.lines
            .map((l, li) => ({ l, li }))
            .filter(({ l }) => l.dayIndex === di && (l.kind === 'exercise' || l.kind === 'unknown'))
            .map(({ l, li }, k) => {
              const plan = d.exercises.find((p) => p.id === l.planId);
              const x = ex(plan?.exerciseId);
              const writing = li === lineAtCaret && document.activeElement === ref.current;
              return (
                <div key={li} style={{ display: 'grid', gridTemplateColumns: '22px minmax(0,1fr) auto', columnGap: 8, alignItems: 'center', minHeight: 52, borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
                  <span className={`small ${l.ambiguous || !x ? 'b accent-t' : 'mute'}`}>{k + 1}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span className="m">{x ? x.name : `«${l.name}»`}</span>
                    <span className="small mute">
                      {plan ? `${plan.sets} × ${plan.reps}` : ''}
                      {plan && plan.weight !== null ? ` · ${x?.load === 'dumbbell' ? '2 × ' : ''}${n(plan.weight)} kg` : ''}
                      {plan && plan.weight !== null && l.weight === null ? ', como la última vez' : ''}
                      {!x ? ' · no lo reconozco: se guardará así y tu entrenador podrá asignarlo' : ''}
                    </span>
                    {l.ambiguous && l.matches && (
                      <span role="group" aria-label={`Variante de ${l.name}`} style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                        {l.matches.slice(0, 3).map((m) => {
                          const on = (choices[li] || l.matches![0].exercise.id) === m.exercise.id;
                          return (
                            <button
                              key={m.exercise.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setChoices({ ...choices, [li]: m.exercise.id })}
                              style={{ background: 'none', border: 0, padding: 0, minHeight: 40, fontSize: 14, fontWeight: on ? 600 : 400, color: on ? 'var(--ink)' : 'var(--mute)', textDecoration: on ? 'underline' : 'none', textDecorationColor: 'var(--accent)', textDecorationThickness: 2, textUnderlineOffset: 6 }}
                            >
                              {m.exercise.name}
                            </button>
                          );
                        })}
                      </span>
                    )}
                  </span>
                  {l.ambiguous ? (
                    <span className="xs b accent-t">Elige una</span>
                  ) : writing ? (
                    <span className="xs mute">Escribiendo…</span>
                  ) : x ? (
                    <span className="xs mute" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <IcPlay width={11} height={11} /> Vídeo · {x.alts.length} alt.
                    </span>
                  ) : (
                    <span />
                  )}
                </div>
              );
            })}
        </div>
      ))}
    </>
  );
}

export function useDraft(text: string, choices: Record<number, string>, lastWeight: (id: string) => number | null, prevDays?: RoutineDay[]) {
  return useMemo(() => buildDraft(text, choices, lastWeight, {}, prevDays), [text, choices, lastWeight, prevDays]);
}
