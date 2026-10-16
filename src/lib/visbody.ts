// Lector de informes Visbody en PDF (versión en español, 3 páginas:
// composición corporal, postura y circunferencias).
// pdf.js da cada trozo de texto con su posición; buscamos cada etiqueta y
// cogemos el número que está en su misma fila, en la columna de valores.

export interface TextItem {
  s: string;
  x: number;
  y: number;
}

export interface ParsedBody {
  date: number | null;
  dateStr: string | null;
  score: number | null;
  postureScore: number | null;
  height: number | null;
  composition: Record<string, { value: number; min?: number; max?: number }>;
  posture: Record<string, { value: number; unit: string; note?: string }>;
  circumferences: Record<string, number>;
  segmental: { fat: Record<string, number>; lean: Record<string, number> } | null;
  issues: { key: string; label: string; kind: 'missing' | 'suspicious'; read?: number; guess?: number }[];
  isVisbody: boolean;
}

export const COMPOSITION_LABELS: Record<string, string> = {
  peso: 'Peso',
  smm: 'Músculo esquelético',
  masaMuscular: 'Masa muscular',
  masaMagra: 'Masa magra',
  grasaKg: 'Grasa',
  bfp: 'Grasa corporal',
  imc: 'IMC',
  icc: 'Índice cintura-cadera',
  tmb: 'Metabolismo basal',
  edadMetabolica: 'Edad metabólica',
  visceral: 'Grasa visceral',
  aguaTotal: 'Agua corporal',
  aguaIntra: 'Agua intracelular',
  aguaExtra: 'Agua extracelular',
  ecwTbw: 'Relación ECW/TBW',
  proteina: 'Proteína',
  sales: 'Sales inorgánicas',
};

export const COMPOSITION_UNITS: Record<string, string> = {
  peso: 'kg', smm: 'kg', masaMuscular: 'kg', masaMagra: 'kg', grasaKg: 'kg', bfp: '%', imc: '', icc: '', tmb: 'kcal',
  edadMetabolica: 'años', visceral: '', aguaTotal: 'kg', aguaIntra: 'kg', aguaExtra: 'kg', ecwTbw: '', proteina: 'kg', sales: 'kg',
};

export const POSTURE_LABELS: Record<string, string> = {
  cabezaAdelantada: 'Cabeza adelantada',
  inclinacionCabeza: 'Inclinación de la cabeza',
  hombroIzq: 'Hombro izquierdo redondeado',
  hombroDer: 'Hombro derecho redondeado',
  hombrosDesiguales: 'Hombros desiguales',
  pelvis: 'Pelvis adelantada',
  rodillaIzq: 'Rodilla izquierda',
  rodillaDer: 'Rodilla derecha',
  piernaIzq: 'Pierna izquierda',
  piernaDer: 'Pierna derecha',
};

export const CIRC_LABELS: Record<string, string> = {
  cuello: 'Cuello',
  brazoIzq: 'Brazo izquierdo',
  brazoDer: 'Brazo derecho',
  busto: 'Pecho',
  cinturaAlta: 'Cintura alta',
  cinturaMedia: 'Cintura media',
  cinturaBaja: 'Cintura baja',
  cadera: 'Cadera',
  musloIzq: 'Muslo izquierdo',
  musloDer: 'Muslo derecho',
  musloMinIzq: 'Muslo izq. (mínimo)',
  musloMinDer: 'Muslo der. (mínimo)',
  gemeloIzq: 'Gemelo izquierdo',
  gemeloDer: 'Gemelo derecho',
};

const num = (s: string): number | null => {
  const m = s.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

const range = (s: string): [number, number] | null => {
  const m = s.replace(/,/g, '.').match(/\[\s*(-?\d+(?:\.\d+)?)\s*~\s*(-?\d+(?:\.\d+)?)\s*\]/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
};

const isNumItem = (s: string) => /^-?\d+(?:[.,]\d+)?\s*(cm|°|kg|%)?(\s*\[.*\])?$/.test(s.trim());

function findLabel(items: TextItem[], test: (s: string) => boolean, maxX = 100): TextItem | undefined {
  return items.filter((i) => i.x < maxX && test(i.s.trim())).sort((a, b) => b.y - a.y)[0];
}

function valueNear(items: TextItem[], label: TextItem | undefined, xMin: number, xMax: number, yTol = 10): TextItem | undefined {
  if (!label) return undefined;
  return items
    .filter((i) => i.x >= xMin && i.x <= xMax && Math.abs(i.y - label.y) <= yTol && isNumItem(i.s))
    .sort((a, b) => Math.abs(a.y - label.y) - Math.abs(b.y - label.y))[0];
}

function pageOf(pages: TextItem[][], title: RegExp): TextItem[] | undefined {
  return pages.find((p) => p.some((i) => title.test(i.s)));
}

function parseDate(pages: TextItem[][]): { ms: number; str: string } | null {
  for (const p of pages) {
    for (const i of p) {
      const m = i.s.match(/(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
      if (m && p.some((j) => /Fecha de informe/i.test(j.s) && Math.abs(j.y - i.y) < 6)) {
        const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 12), +(m[5] || 0), +(m[6] || 0));
        return { ms: d.getTime(), str: m[0] };
      }
      const e = i.s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
      if (e && p.some((j) => /Fecha/i.test(j.s) && Math.abs(j.y - i.y) < 6)) {
        const d = new Date(+e[3], +e[2] - 1, +e[1], +(e[4] || 12), +(e[5] || 0));
        return { ms: d.getTime(), str: e[0] };
      }
    }
  }
  return null;
}

export function parseVisbody(pages: TextItem[][]): ParsedBody {
  const out: ParsedBody = {
    date: null,
    dateStr: null,
    score: null,
    postureScore: null,
    height: null,
    composition: {},
    posture: {},
    circumferences: {},
    segmental: null,
    issues: [],
    isVisbody: false,
  };
  const comp = pageOf(pages, /composici[oó]n corporal/i);
  const post = pageOf(pages, /An[aá]lisis de postura/i);
  const circ = pageOf(pages, /circunferencia corporal/i);
  out.isVisbody = Boolean(comp || post || circ) && pages.some((p) => p.some((i) => /Fecha de informe/i.test(i.s)));
  const d = parseDate(pages);
  if (d) {
    out.date = d.ms;
    out.dateStr = d.str;
  }
  const hItem = pages.flat().find((i) => /^\d{2,3}\s*cm$/.test(i.s.trim()));
  if (hItem) out.height = num(hItem.s);

  if (comp) {
    const sc = comp.find((i) => /^Resultado\s+\d+/.test(i.s.trim()));
    if (sc) out.score = num(sc.s.replace('Resultado', ''));
    const put = (key: string, labelTest: (s: string) => boolean, xMin = 88, xMax = 240, tol = 10) => {
      const lab = findLabel(comp, labelTest);
      const v = valueNear(comp, lab, xMin, xMax, tol);
      if (!v) return;
      const value = num(v.s);
      if (value === null) return;
      let r = range(v.s);
      if (!r && lab) {
        const ri = comp.find((i) => i.x > 240 && i.x < 300 && Math.abs(i.y - v.y) <= 8 && range(i.s));
        if (ri) r = range(ri.s);
      }
      out.composition[key] = r ? { value, min: r[0], max: r[1] } : { value };
    };
    put('peso', (s) => s === 'Peso');
    put('smm', (s) => s === 'SMM');
    put('grasaKg', (s) => s === 'Masa corporal grasa');
    put('bfp', (s) => s === 'BFP');
    put('imc', (s) => s === 'IMC');
    put('icc', (s) => s === 'ICC');
    put('tmb', (s) => /^Tasa metab/i.test(s), 88, 240, 12);
    put('edadMetabolica', (s) => /^Edad Metab/i.test(s));
    put('visceral', (s) => /grasa visceral/i.test(s), 88, 240);
    put('aguaIntra', (s) => /^Agua intracelular/i.test(s));
    put('aguaExtra', (s) => /^Agua extracelular/i.test(s));
    put('ecwTbw', (s) => /ECW\/TBW/i.test(s));
    put('masaMuscular', (s) => s === 'Masa muscular');
    put('masaMagra', (s) => s === 'Masa corporal');
    put('aguaTotal', (s) => /^Agua en el cuerpo/i.test(s));
    // Proteína y sales: columnas bajo su cabecera
    const col = (key: string, header: RegExp) => {
      const h = comp.find((i) => header.test(i.s));
      if (!h) return;
      const v = comp
        .filter((i) => i.y < h.y && i.y > h.y - 80 && i.x >= h.x - 30 && i.x <= h.x + 40 && isNumItem(i.s))
        .sort((a, b) => b.y - a.y)[0];
      if (!v) return;
      const value = num(v.s);
      const r = range(v.s);
      if (value !== null) out.composition[key] = r ? { value, min: r[0], max: r[1] } : { value };
    };
    col('proteina', /^Prote[ií]na$/i);
    col('sales', /^Sales inorg/i);
    // Segmentos (grasa y masa magra por brazo, tronco y pierna)
    const seg = (header: RegExp): Record<string, number> | null => {
      const h = comp.find((i) => header.test(i.s));
      if (!h) return null;
      const vs = comp.filter((i) => i.x > 380 && i.y < h.y - 15 && i.y > h.y - 105 && /^\d+(?:[.,]\d+)?$/.test(i.s.trim()));
      if (vs.length < 5) return null;
      const byY = [...vs].sort((a, b) => b.y - a.y);
      const arms = byY.filter((v) => Math.abs(v.y - byY[0].y) < 5).sort((a, b) => a.x - b.x);
      const legsY = byY[byY.length - 1].y;
      const legs = byY.filter((v) => Math.abs(v.y - legsY) < 5).sort((a, b) => a.x - b.x);
      const trunk = byY.find((v) => !arms.includes(v) && !legs.includes(v));
      if (arms.length < 2 || legs.length < 2 || !trunk) return null;
      return {
        brazoIzq: num(arms[0].s)!,
        brazoDer: num(arms[arms.length - 1].s)!,
        tronco: num(trunk.s)!,
        piernaIzq: num(legs[0].s)!,
        piernaDer: num(legs[legs.length - 1].s)!,
      };
    };
    const fat = seg(/segmentado de grasa/i);
    const lean = seg(/segmentado de masa/i);
    if (fat && lean) out.segmental = { fat, lean };
  }

  if (post) {
    const sc = post.find((i) => /^Resultado\s+\d+/.test(i.s.trim()));
    if (sc) out.postureScore = num(sc.s.replace('Resultado', ''));
    const put = (key: string, labelTest: (s: string) => boolean, unit: string) => {
      const lab = findLabel(post, labelTest);
      const v = valueNear(post, lab, 140, 215, 10);
      if (!lab || !v) return;
      const value = num(v.s);
      if (value === null) return;
      const notes = post
        .filter((i) => i.x >= 240 && i.x < 345 && i.y <= lab.y + 20 && i.y >= lab.y - 16)
        .sort((a, b) => b.y - a.y)
        .map((i) => i.s.trim());
      out.posture[key] = { value, unit, note: notes.join(' ').replace(/\s+/g, ' ') || undefined };
    };
    put('cabezaAdelantada', (s) => /^Postura de la cabeza/i.test(s), 'cm');
    put('inclinacionCabeza', (s) => /^Inclinaci[oó]n de cabeza/i.test(s), '°');
    put('hombroIzq', (s) => /^\(lado izquierdo\)/i.test(s), 'cm');
    put('hombroDer', (s) => /^\(lado derecho\)/i.test(s), 'cm');
    put('hombrosDesiguales', (s) => /^Hombros desiguales/i.test(s), '°');
    put('pelvis', (s) => /^Desplazamiento p[eé]lvico/i.test(s), 'cm');
    put('rodillaIzq', (s) => s === 'izquierda', '°');
    put('rodillaDer', (s) => s === 'derecha', '°');
    for (const i of post) {
      const m = i.s.match(/Pierna (izquierda|derecha)\s*[:：]\s*(-?\d+(?:[.,]\d+)?)/i);
      if (m) out.posture[m[1].toLowerCase() === 'izquierda' ? 'piernaIzq' : 'piernaDer'] = { value: parseFloat(m[2].replace(',', '.')), unit: '°' };
    }
  }

  if (circ) {
    const put = (key: string, labelTest: (s: string) => boolean) => {
      const lab = findLabel(circ, labelTest, 330);
      const v = valueNear(circ, lab, 340, 400, 10);
      if (!v) return;
      const value = num(v.s);
      if (value !== null) out.circumferences[key] = value;
    };
    put('cuello', (s) => /^Circunferencia del cuello/i.test(s));
    put('brazoIzq', (s) => s === 'Brazo izquierdo');
    put('brazoDer', (s) => s === 'Brazo derecho');
    put('busto', (s) => s === 'Busto');
    put('cinturaAlta', (s) => s === 'Cintura alta');
    put('cinturaMedia', (s) => s === 'Cintura media');
    put('cinturaBaja', (s) => s === 'Cintura baja');
    put('cadera', (s) => /^L[ií]nea superior/i.test(s) || /^Cadera/i.test(s));
    put('musloIzq', (s) => s === 'Muslo izquierdo');
    put('musloDer', (s) => /^Circunferencia del muslo$/i.test(s));
    put('musloMinIzq', (s) => /^del muslo izquierdo/i.test(s));
    put('musloMinDer', (s) => /^del muslo derecho/i.test(s));
    put('gemeloIzq', (s) => /^pantorrilla izquierda/i.test(s));
    put('gemeloDer', (s) => /^pantorrilla derecha/i.test(s));
  }

  // Revisión: datos clave que faltan y valores fuera de toda lógica (p. ej. «6,23 kg» en vez de 62,3)
  for (const key of ['peso', 'smm', 'bfp', 'grasaKg', 'visceral']) {
    const v = out.composition[key];
    if (!v) {
      out.issues.push({ key, label: COMPOSITION_LABELS[key], kind: 'missing' });
      continue;
    }
    if (v.min !== undefined && v.max !== undefined) {
      if (v.value < v.min / 3 || v.value > v.max * 3) {
        const guess = [v.value * 10, v.value / 10].find((g) => g >= v.min! / 1.6 && g <= v.max! * 1.6);
        out.issues.push({ key, label: COMPOSITION_LABELS[key], kind: 'suspicious', read: v.value, guess });
      }
    }
  }
  if (!out.date) out.issues.unshift({ key: 'date', label: 'Fecha del informe', kind: 'missing' });
  return out;
}

/** Saca el texto de cada página de un PDF con pdf.js (se carga solo al usarlo) */
export async function extractPdf(data: ArrayBuffer): Promise<TextItem[][]> {
  const g = Math as unknown as { sumPrecise?: (a: number[]) => number };
  if (!g.sumPrecise) g.sumPrecise = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', document.baseURI).href;
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;
  const pages: TextItem[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items: TextItem[] = [];
    for (const it of tc.items as { str?: string; transform?: number[] }[]) {
      if (!it.str || !it.str.trim() || !it.transform) continue;
      items.push({ s: it.str, x: Math.round(it.transform[4]), y: Math.round(it.transform[5]) });
    }
    pages.push(items);
  }
  try {
    await task.destroy();
  } catch {
    /* da igual: ya tenemos el texto */
  }
  return pages;
}
